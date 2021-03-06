/**
 * Created by Paweł Krawczyk on 04/09/2014.
 */

cspControllers.controller('CspReportsController', ['$scope', '$rootScope', 'cornercouch', '$window', '$http',
    function ($scope, $rootScope, cornercouch, $window, $http) {
        "use strict";

        console.log('CspReportsController owner_id=' + $rootScope.owner_id);

        $scope.blocked = true; // for infinite scroll
        $('#reports-prev-button').addClass('disabled');
        $scope.index = 0;

        $scope.db_name = get_db_for_user($rootScope.owner_id);
        $scope.db = cornercouch(couchdb_url, 'GET').getDB($scope.db_name);
        $scope.db.query("reports", "1200_all",
            {
                include_docs: true,
                key: $rootScope.owner_id,
                limit: screen_rows('#reports-left-list') // need to compensate for spacing
            })
            .success(function () {
                console.log('data loading finished');
                $scope.blocked = false;
                $scope.detail_show(0);
            })
            .error(function (resp) {
                $scope.blocked = false;
                $scope.error = resp;
            });


        $scope.detail_show = function (index) {
            console.log('detail_show ' + index);

            // report list highlight cycling
            $('#reports-li-' + $scope.index).removeClass('bg-info'); // remove highlight from previous
            $scope.index = index; // update scope index
            $('#reports-li-' + $scope.index).addClass('bg-info'); // highlight

            $scope.id = $scope.db.rows[index].id;
            $scope.csp = $scope.db.rows[index].doc['csp-report'];
            $scope.meta = $scope.db.rows[index].doc['meta'];
            $scope.review = $scope.db.rows[index].doc['review'];
            $scope.raw = 0;

            // shortcut variables for use in the details view
            $scope.blocked_uri = $scope.csp['blocked-uri'];
            if ($scope.csp['effective-directive']) {
                $scope.violated_directive = $scope.csp['effective-directive'];
            } else {
                $scope.violated_directive = $scope.csp['violated-directive'].split(' ')[0];
            }

            // previous/next buttons showing
            if ($scope.index == 0) {
                $('#reports-prev-button').addClass('disabled');
            } else {
                $('#reports-prev-button').removeClass('disabled');
            }
            if ($scope.index == ($scope.db.rows.length - 1)) {
                $('#reports-next-button').addClass('disabled');
            } else {
                $('#reports-next-button').removeClass('disabled');
            }


        };

        $scope.detail_prev = function () {
            console.log('detail_prev ' + $scope.index);
            if ($scope.index > 0) {
                $scope.detail_show($scope.index - 1);
            }
        };

        $scope.detail_next = function () {
            console.log('detail_next ' + $scope.index);
            if ($scope.index < $scope.db.rows.length) {
                $scope.detail_show($scope.index + 1);
            }
        };

        $scope.load_next_page = function () {
            console.log('load next page');
            $scope.db.queryMore();
        };

        $scope.open_raw = function (index) {
            console.log('open_raw');
            $scope.show_raw = true;
            $scope.show_original = false;
            $scope.show_violated = false;
        };
        $scope.open_original = function (index) {
            $scope.show_raw = false;
            $scope.show_original = true;
            $scope.show_violated = false;
        };
        $scope.open_violated = function (index) {
            $scope.show_raw = false;
            $scope.show_original = false;
            $scope.show_violated = true;
        };

        $scope.delete_all = function () {

            if (!confirm('Are you sure?')) {
                return
            }

            $http.delete('/api/' + $rootScope.owner_id + '/all');


        };

        $scope.delete_this = function () {
            $http.delete('/api/' + $rootScope.owner_id + '/' + $scope.id);

        };


    }
]);
