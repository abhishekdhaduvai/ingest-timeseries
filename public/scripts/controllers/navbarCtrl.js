(function(){

    'use strict';

    angular.module('predixApp')
           .controller('navbarCtrl', navbarCtrl);

    navbarCtrl.$inject = ['$scope', '$state'];

    function navbarCtrl($scope, $state){
        
        $scope.reload = function(){
            location.reload();
        };

        $scope.goToAbout = function(){
            $state.go('about');
        }

        //The current state, set on scope
        $scope.state = $state.current;

    };

})();    
    
    