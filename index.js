/**
	* @desc This function will help shim out our angular object in cases where
	* we just want to use this as a stand-alone without building it with our project
	*/
(function(angular) {
	'use strict';

	var moduleName = 'officebot-autocomplete';
	
	angular
		.module(moduleName, [])
		.directive('autocomplete',require('./src/autocomplete.directive.js'));

	module.exports = moduleName;

})(angular);