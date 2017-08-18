(function(){

    'use strict';

    angular.module('predixApp')
           .controller('dashboardCtrl', dashboardCtrl);

    dashboardCtrl.inject = ['$scope', '$websocket']
    function dashboardCtrl($scope, $http, $timeout){

    	//UAA vars

    	$scope.uaaform = {
    		'uaaURL': 'https://c2b4d7c7-af50-4c49-a03f-00a004102c69.predix-uaa.run.aws-usw02-pr.ice.predix.io',
    		'credentials':'dGVzdDp0ZXN0'
    	}
        $scope.token = '';

        //TimeSeries vars
        $scope.timeseriesVars = {
        	'zoneId':'6c00dc1b-c459-4726-a640-4f85fd4762d5',
        	'frequency': 1,
        	'datapoints': 1
        }

        //Result vars
        $scope.ingested = 0;

        //Status vars
        $scope.status = '';

        $scope.startDisabled = true;

        $scope.getToken = function(){
        	$http.get($scope.uaaform.uaaURL+'/oauth/token?grant_type=client_credentials',{
                headers:{
                    'Authorization': 'Basic '+$scope.uaaform.credentials
                }
            }).then(function(response){
            	$scope.token = response.data.access_token;
            	$scope.startDisabled = false;
            });
        }

        $scope.start = function(){
            
            for(var i=1; i<=$scope.timeseriesVars.datapoints; i++){
                (function(i) {
                    $timeout(function() { 
                        if(i<10)
                            ingest("SENSOR_0"+i);
                        else
                            ingest("SENSOR_"+i);
                    }, i * $scope.timeseriesVars.frequency * 1000);
                })(i);        
            }

            function ingest(sensor){
                $http.post('/api/timeseries',{
                    data:{
                        sensorId: sensor,
                        token: $scope.token,
                        zoneId: $scope.timeseriesVars.zoneId
                    }
                }).then(function(res){
                    console.log(res);
                    if(res.status === 200)
                        $scope.ingested++;
                    else
                        alert("There was an error");
                });
            }

        }

        $scope.stop = function(){
        	//TODO: Stop ingestion
        }
    }

})();