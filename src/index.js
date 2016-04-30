var angular = require('angular');
var moduleName = 'officebot-autocomplete';

angular
	.module(moduleName, [])
	.directive('autocomplete',require('./autocomplete.directive.js'));


module.exports = moduleName;
