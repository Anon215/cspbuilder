/**
 * Created by pawelkrawczyk on 04/09/2014.
 */

cspControllers.controller('CspPolicyController', ['$scope', 'cornercouch', '$rootScope',
    function ($scope, cornercouch, $rootScope) { "use strict";

        console.log('CspPolicyController owner_id=' + $rootScope.owner_id);

        $scope.csp_config = {
            'enforce': false,
            'default': false,
            'referrer': 'none',
            'reflected_xss': 'block',
            'header_format': 'standard',
            'plugin_types': [
                'application/pdf',
                'application/x-shockwave-flash',
                'application/java'
            ],
            'plugin_choice': []
        };

        $scope.db = cornercouch(couchdb_url, 'GET').getDB('csp');
        $scope.db.query("csp", "known_list", { key: $rootScope.owner_id })
            .success(function () {
                console.log('data loading finished');
                $scope.approved_list = [];
                var current_type = null;
                var current_list = {};
                // rewrite the list of accepted items into a dictionary
                $scope.db.rows.forEach(function (item) {
                    // {"id":"00b68742da0e40848f0982f95dfdf8dc","key":"9018643792216450862","value":["script-src","about","reject",null]},
                    var type = item.value[0];
                    var src = item.value[1];
                    var action = item.value[2];

                    if (action == 'accept') {

                        if (current_type == type) {
                            // item inside one type - add to "sources" dictionary
                            current_list[src] = true;
                        } else {
                            // new type - open new dictionary
                            if (current_type && current_list) { // save items added previously
                                $scope.approved_list.push({
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
                    }

                });
                if(current_type && current_list) {
                    // save items added as last, intentionally stays outside of the forEach loop
                    $scope.approved_list.push({
                        'type': current_type,
                        'sources': current_list
                    });
                }
                // finally generate the generic CSP on the page
                $scope.generate_csp();

            }
        );

        // TODO: add various types from https://www.owasp.org/index.php/Content_Security_Policy
        // https://w3c.github.io/webappsec/specs/content-security-policy/#csp-request-header
        function ror_generator() {
            // TODO: https://github.com/twitter/secureheaders
            return null;
        }

        function django_generator() {
            // TODO: https://github.com/kravietz/django-security
            return null;
        }

        // Cycle between default (empty) policy and original, generated policy array
        $scope.default_policy = function () {
            // check if we're not cycling back from default policy
            if ($scope.approved_list_backup) {
                $scope.approved_list = $scope.approved_list_backup;
                delete $scope.approved_list_backup;
                return
            }
            $scope.approved_list_backup = $scope.approved_list;
            $scope.approved_list = [];
            // report-uri and default-src will be added automatically
            var types = ['connect-src', 'child-src', 'font-src', 'form-action', 'frame-ancestors', 'frame-src',
                'img-src', 'media-src', 'object-src', 'script-src', 'style-src'];
            types.forEach(function (type) {
                $scope.approved_list.push(
                    {'type': type, 'sources': {'\'none\'': true}}
                );
            });
        };

        $scope.generate_csp = function (format) {

            // select CSP header format
            switch ($scope.csp_config.header_format) {
                case 'xcsp':
                    var header = 'X-Content-Security-Policy';
                    break;
                case 'webkit':
                    var header = 'X-WebKit-CSP';
                    break;
                default:
                    var header = 'Content-Security-Policy';
            }

            // append RO if enforcenement is not selected
            if (!$scope.csp_config.enforce) {
                header += '-Report-Only';
            }

            var policy = 'report-uri http://cspbuilder.info/report/' + $rootScope.owner_id + '/; ';

            for (var i = 0; i < $scope.approved_list.length; i++) {
                var src_list = $scope.approved_list[i];
                policy += src_list.type + ' ';
                var sources = Object.keys(src_list.sources);
                for (var j = 0; j < sources.length; j++) {
                    if (src_list.sources[sources[j]]) {
                        policy += ' ' + sources[j];
                    }
                }
                policy += '; ';
            }

            // https://w3c.github.io/webappsec/specs/content-security-policy/#directive-reflected-xss
            switch($scope.reflected_xss) {
                case 'block':
                    policy += 'reflected-xss block; ';
                    break;
                case 'filter':
                    policy += 'reflected-xss filter; ';
                    break;
                case 'allow':
                    policy += 'reflected-xss allow; ';
                    break;
            }

            // https://w3c.github.io/webappsec/specs/content-security-policy/#directive-referrer
            switch($scope.csp_config.referrer) {
                case 'no-referrer':
                    policy += 'referrer no-referrer; '
                    break;
                case 'no-referrer-when-downgrade':
                    policy += 'referrer no-referrer-when-downgrade; '
                    break;
                case 'origin':
                    policy += 'referrer origin; '
                    break;
                case 'origin-when-cross-origin':
                    policy += 'referrer origin-when-cross-origin; '
                    break;
                case 'unsafe-url':
                    policy += 'referrer unsafe-url; '
                    break;
                default: // none
                    // do nothing, do not add the directive
            }

            // https://w3c.github.io/webappsec/specs/content-security-policy/#directive-plugin-types
            if($scope.csp_config.plugin_choice.length) {
                policy += 'plugin-types ';
                for (var i = 0; i < $scope.csp_config.plugin_choice.length; i++) {
                    policy += $scope.csp_config.plugin_choice[i];
                    policy += ' ';
                }
                policy += '; ';
            }

            // add default source
            policy += 'default-src \'none\';';

            // produce final formatted output depending on requested format
            switch (format) {
                case 'nginx':
                    $scope.policy = 'add_header ' + header + ' "' + policy + '";';
                    break;
                case 'apache':
                    $scope.policy = 'Header set ' + header + ' "' + policy + '"';
                    break;
                case 'php':
                    $scope.policy = 'header("' + header + ': ' + policy + '");';
                    break;
                case 'ror':
                    $scope.policy_message = 'Use <a href="https://github.com/twitter/secureheaders">secureheaders</a>.';
                    $scope.policy = ror_generator();
                    break;
                case 'django':
                    $scope.policy_message = 'Use <a href="https://github.com/kravietz/django-security">django-security</a>.';
                    $scope.policy = django_generator();
                default:
                    $scope.policy = header + ': ' + policy;
            }

        };

    }
]);