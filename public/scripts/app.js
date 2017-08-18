
angular.module('predixApp', ['ui.router','ngMaterial', 'ngWebSocket','ngWebsocket'])
       .config(config)
       .run(run)


config.$inject = ['$stateProvider','$urlRouterProvider','$locationProvider'];

function config($stateProvider, $urlRouterProvider, $locationProvider) {
  // Any garbage link will go to home
  $urlRouterProvider.otherwise('dashboard');

  $stateProvider
    .state('container',{
        url:'/',
        templateUrl:'views/container.html',
        controller:'navbarCtrl'
    })
    .state('dashboard',{
        url:'dashboard',
        parent:'container',
        templateUrl: 'views/dashboard.html',
        controller:'dashboardCtrl'
    })
    .state('about',{
        url:'about',
        parent:'container',
        templateUrl: 'views/about.html'
    });

    $locationProvider.html5Mode({
      enabled:false,
      requireBase: false
    });

    $locationProvider.hashPrefix('!');
}

function run(){
    console.log('App started');
}