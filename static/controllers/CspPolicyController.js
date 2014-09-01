cspControllers.controller('CspPolicyController', ['$scope', '$routeParams', 'cornercouch',
    function($scope, $routeParams, cornercouch) {

        $scope.csp_config = {
            'enforce' : false,      // Content-Security-Policy-Read-Only
            'webserver'  : 'generic',  /* 'generic' = just CSP header
                                       'nginx' = Nginx add_header format
                                       'apache' = Apache
                                       'ruby'
                                       'django'
                                       'php'
                                     */
            'header' : 'standard', /* 'xcsp', 'chrome' */
        };

        $scope.owner_id = $routeParams.owner_id;
        $scope.db = cornercouch(couchdb_url, 'GET').getDB('csp');
        $scope.db.query("csp", "approved_sources_owner",
            {
                startkey: [$scope.owner_id],
                endkey: [$scope.owner_id,{}],
                group: true
            }).success( function() {
                    console.log('data loading finished');
                    $scope.approved_list = [];
                    current_type = null;
                    current_list = {};
                    // rewrite the list of accepted items into a dictionary
                    $scope.db.rows.forEach(function(item) {
                            type = item.key[1];
                            src = item.key[2];
                            if(current_type==type) {
                                // item inside one type - add to "sources" dictionary
                                current_list[src] = true;
                            } else {
                                // new type - open new dictionary
                                if(current_type && current_list) {
                                    $scope.approved_list.push( {
                                            'type': current_type,
                                            'sources': current_list
                                            });
                                }
                                current_type = type;
                                current_list = {};
                                // by default all sources are checked - the list is built
                                // from items accepted by user in Analysis tab
                                current_list[src] = true;
                            }

                        });

                }
            );

        $scope.generate_csp = function() {
            if($scope.csp_config.enforce) {
                header = 'Content-Security-Policy';
            } else {
                header = 'Content-Security-Policy-Report-Only';
            }
            $scope.policy = header + ': ';
            for (i=0; i<$scope.approved_list.length; i++) {
                src_list = $scope.approved_list[i];
                console.log('sources=' + JSON.stringify(src_list.sources));
                console.log('keys=' + Object.keys(src_list.sources));
                $scope.policy += src_list.type + ':';
                for (src in src_list.sources) {
                    console.log('src=' + src);
                    $scope.policy += ' ' + src;
                }
                $scope.policy += '; ';
            }

        };

    }
]);