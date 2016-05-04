/**
	* @name AutocompleteDirective
	* @desc This directive does exactly what it sounds like. It places a text box on the page
	* that actes as a search/typeahead/autocomplete system
	* @namespace Autcomplete
	* @param {provider} $timeout
	*/
module.exports = ['$timeout','$compile', function autocompleteDirective($timeout, $compile) {
	'use strict';

	var fs = require('fs');
	var $ = require('jquery');

	var directiveDef = {
		restrict : 'E',
		replace : true,
		scope : {
			onClick : '&',
			onSubmit : '&',
			onMouseover : '&',
			src : '=',
			minLength : '@',
			limit : '@',
			debounce : '@',
			using : '@'
		},
		compile : function() {
			return {
				pre : function(scope, elem, attrs) {
					var defaultItemTemplate = '<span>{{item.preMatch}}<strong>{{item.match}}</strong>{{item.postMatch}}</span>';
					var contentTemplate = $(elem).attr('content-template') || defaultItemTemplate;

					/*jshint multistr: true */
					elem.html('\
						<div>\
							<input ng-model="searchVal" >\
							<div class="autocomplete-list" ng-show="items.length">\
								<a href \
									ng-click="set(item)" \
									ng-mouseover="mouseover(item);setHoverItem(item)" \
									ng-mouseleave="resetHoverItem()" \
									ng-repeat="item in items | limitTo: limit">\
									<p class="autocomplete-item">\
									' + contentTemplate+ '\
									</p>\
								</a>\
							</div>\
						</div>');

					var contents = $compile(elem.contents())(scope);
					elem.append(contents);
				},
				post : linkFn
			};
		}
	};

	return directiveDef;

	/**
		* @desc Link function
		* @memberof Autocomplete.Directive
		* @param {object} scope
		* @param {object} DOM Element
		* @param {object} attrs
		*/

	function linkFn(scope, elem, attrs, ctrl, transclude) {
		init();

		var input = $(elem).find('input');
		var currentSelector = -1;
		input.on('keyup', onInputKeyup);
		input.on('click', onInputFocus);

		$(document).on('click', onDocumentClick);

		/**************************************************
		* Public methods
		***************************************************/
		scope.setHoverItem = setHoverItem;
		scope.resetHoverItem = resetHoverItem;
		scope.set = setItem;
		scope.mouseover = mouseoverProxy;

		/**************************************************
		* Scope watches
		***************************************************/
		scope.$watch('src', updateSource);

		/**************************************************
		* Private methods
		***************************************************/

		/**
			* @desc This just gets called a little higher up. I wanted to isolate all of our load out functionality in case
			* I needed to test this code with other default values. Doing it this way makes it so I don't have to edit code
			* later to do that
			* @memberof Autocomplete.Directive
			* @returns {null}
			* @api private
			*/
		function init() {
			if ('undefined' === typeof scope.minLength) {
				scope.minLength = 3;
			} else {
				try {
					scope.minLength = parseInt(scope.minLength, 10);
				} catch(e) {
					scope.minLength = 3;
				}
			}
			if ('undefined' == typeof scope.limit) {
				scope.limit = 100;
			} else {
				try {
					scope.limit = parseInt(scope.limit, 10);
				} catch(e) {
					scope.limit = 100;
				}
			}

			if ('undefined' === typeof scope.debounce) {
				scope.debounce = 0;
			} else {
				try {
					scope.debounce = parseInt(scope.debounce, 10);
				} catch(e) {
					scope.debounce = 0;
				}
			}

			//This is used to set/reset after hovering over a "fake" value
			scope.realValue = '';
			//Copy any class names from our directive object to the input tag of this object
			elem.find('input').attr('class', elem.find('input').attr('class') + ' ' + attrs.class);
			//Clear the directive tag of classes so we don't have weird nesting issues with our style
			$(elem).removeClass();
			//Lastly, set the items to an empty array so we don't get "length of undefined" errors
			scope.items = [];
		}

		/**
			* @desc This is a stub and likely won't be the function that actually gets called. That function is built up at the
			* bottom of this file (in our scope.$watch listener function for scope.src); We have this stub here in case that
			* value is never initialized
			* @memberof Autocomplete.Directive
			* @returns {promise}
			* @api private
			*/
		function searchProxy() {
			return $timeout(function() {
				return scope.items;
			},0);
  	}

  	/**
  		* @desc This function is bound to the keyup event on the directive's input element. Originally, this functionality
  		* was split into a few functions, but since we are doing some editing/blocking of event propogation, I was having a
  		* really hard time getting this to reliable work in the order I needed them to. As an easy work around, they are all
  		* now in the same function, which seems to have resolved all of those issues
			* @memberof Autocomplete.Directive
			* @param {object} event
			* @returns {null}
			* @api private
  		*/
		function onInputKeyup(e) {

			/*
				First step in the process is checking to see if the user has pressed entered. If so, we need to first see if they
				pressed entered while highlighting an item in the list. If so, treat it like a click on that function. If not, then
				check to see if there is the appropriate function bound to scope (that came in on our decleration in the view) and
				if so, call it with the text contents of our search box. After that, make sure to reset items back to an empty array
				so the autcomplete list is hidden again.
				*/
			if (e.which === 13) {
				//If we are submitted because we have a selected item, submit that
				if (currentSelector !== -1) {
					return $('.autocomplete-item').eq(currentSelector).trigger('click');
				} else if ('function' === typeof scope.onSubmit()) {
					scope.onSubmit(elem.find('input').val());
					/*
						This design pattern is everywhere in our code. It ensures that the scope.items = [] is only called on the next
						digest cycle without having to check to see if we're in one currently (which sucks and can't be trusted). That
						is, this replaces wrapping the code in $scope.$apply (that can break easily)
					*/
					return $timeout(function() {
						scope.items = [];
					},0);
				}
			}

			/*
				Since we are binding all of our functionality inside of this one event handler, we need to check really fast to
				see if the user is pressing up or down on the keyboard. If so, we want the view to reflect that by walking through
				the list of available options. CurrentSelector is a private attribute that tracks the selected element, which makes
				this easy - just de/increment that value and then call selectItem. Make sure to return after that, since we don't
				want to trigger a re-search (further down in the code)
				*/
			if (e.which === 38) { //up
				currentSelector--;
				return selectItem(currentSelector);
			} else if (e.which === 40) { //down
				currentSelector++;
				return selectItem(currentSelector);
			}

			/*jshint validthis:true */
			var val = this.value;

			/*
				* Debounce code. We want to make sure to not thrash the server (if we're using a remote data source). This libary
				* doesn't try to do any guessing to see if that's the case. Instead, this directive has a value on scope that
				* determins the debounce rate
				*/

			debounce(runSearch, scope.debounce)();

			function runSearch() {

				if (val.length < scope.minLength) {
					return $timeout(function() {
						scope.items = [];
					},0);
				}
				/*
					* An important note here before we move on. This search proxy function is almost certainly not the one defined
					* higher up in this file. Instead, it is likely a function that was created inside of handler function for our
					* watch on scope.src. That function rewrites this proxy function depending on the type of data source we
					* passed in to our scope
				*/
				searchProxy(val).then(function(values) {
					/*
						* Reset the private attribute of currentSelector. This helps with both sane bound checking, but it feels more natural
						* to have the arrow down function select the first item after each search, instead of some arbitrary item later in the
						* list that was selected before the search
					*/
					currentSelector = -1;
					/*
						* Cache the searches. For performance, we aren't pushing directly into a scope variable, as that can cause a digest
						* cycle each time we .push. Instead, this will trigger ONE cycle whne we assing the value of matches[] to scope
					*/
					var matches = [];

					values.forEach(function(item) {
						var textItem = '';

						if ('string' === typeof item) {
							textItem = item;
						} else if ('string' === typeof scope.using && 'object' === typeof item && 'string' === typeof item[scope.using]) {
							/*
								For arrays of objects, we need to know what path in the object should be used to render. That's
								found in scope.using
								*/
							textItem = item[scope.using];
						}
						var matchString = textItem.toLowerCase();
							var matchValue = val.toLowerCase();
							var matchStartIndex = matchString.indexOf(matchValue);
							var matchEndIndex = matchStartIndex + matchValue.length;

							//If our data source is a simple array, do some filtering
							if (Array.isArray(scope.src) && textItem.indexOf(val) == -1) {
								return;
							}
							var match = textItem.substring( matchStartIndex, matchEndIndex );

							var preMatch = textItem.substring( 0, matchStartIndex );
							var postMatch = textItem.substring( matchEndIndex );
						matches.push({
							target : item, //The original item from the provided data source
							preMatch : preMatch,
	 						match : match, //The matched portion of the input text. This is for styling
	 						postMatch : postMatch
						});
					});
					//Queue this up for the next digest cycle
					$timeout(function() {
						scope.items = matches;
					},0);
				});
			}
		}

		/**
			* @desc Simply fire off the normal search functionality when the user clicks on the text box
			* This will make it so the user doesn't have ot modify the text if they want to resubmit a
			* search (after the text box loses focus, of course)
			* @memberof Autocomplete.Directive
			* @param {object} event
			* @returns {null}
			* @api private
			*/
		function onInputFocus(e) {
			/*jshint validthis:true */
			var text = this.value;
			if (text.length) {
				input.trigger('keyup');
			}
		}

		/**
			* @desc This function gets called whenever the user clicks on *anything*. Because of how
			* event bubbling works, this will either get called after we've already clicked on something
			* in the autcomplete list or whenever we click on anything that's not in our list
			* @memberof Autocomplete.Directive
			* @param {object} event
			* @returns {null}
			* @api private
			*/
		function onDocumentClick(e) {
			if (e.target == elem.find('input')[0]) {
				return;
			}
			//In case you've not seen the other notes, this pattern makes it easy to hook into the digest loop
			//without the risk of breaking anything
			$timeout(function() {
				scope.items = [];
			},0);
		}

		/**
			* @desc This function is called whenever the user hovers over an item in the autocomplete
			* list. When this function is called, it caches the previously entered text from the search
			* box and the set the search box content to reflect what the user is hovering over.
			* @memberof Autocomplete.Directive
			* @param {object} item that is being hovered over
			* @returns {null}
			* @api private
			*/
		function setHoverItem(item) {
			if (!item) {
				return;
			}
			scope.realValue = scope.searchVal;
  		scope.searchVal = item.preMatch + item.match + item.postMatch;
		}

		/**
			*	@desc Cleares the temporary values we were using to render the hovered over item. That
			* is, once the hoverItem is cleared, return the search box text to what it was before the
			* hover stuff started. NOTE: The hover functions are also used for the arrow up and arrow down functions.
			* By design, they don't call this function, instead leaving the hover object as the active object. This
			* needs to happen for a few reasons (like hitting enter and still having that data available to pass back
			* to the scope.onClick). Anyway, just leave this alone unless you have a compelling reason not to.
			* @memberof Autocomplete.Directive
			* @returns {null}
			* @api private
			*/
		function resetHoverItem() {
			scope.searchVal = scope.realValue;
		}

		/**
			* @desc Proxy function for the onClick event. This function is called from the view
			* when the user clicks on an item in the dropdown menu. If there is a function bound
			* to scope to handle this, delegate to that function, passing in the selected item.
			* Then, set the scope.searchVal variable (which represents the text content on our input)
			* to the string content of the selected item
			* @memberof Autocomplete.Directive
			* @param {object} item that was clicked on
			* @returns {null}
			* @api private
			*/
		function setItem(item) {
			if ('function' === typeof scope.onClick()) {
				scope.onClick()(item);
			}
			scope.searchVal = item.preMatch + item.match + item.postMatch;
		}

		/**
			* @desc We need to have a proxy function for the mouse over (hover) events so
			* we can reliably call this from the view without breaking anything. This function
			* will then check to see if there's a custom function bound to the scope and call that
			* @memberof Autocomplete.Directive
			* @param {object} item that was hovered over
			* @returns {null}
			* @api private
			*/
		function mouseoverProxy(item) {
			if ('function' === typeof scope.onMouseover()) {
				scope.onMouseover(item);
			}
		}

		/**
			* @desc This function is bound to the scope.$watch on src. In this function, we do some
			* typechecking to see what the data source is. Currently supported are simple arrays,
			* sync functions that return an array, and async functions that return a promise. Once
			* the source type is established, it is wrapped in an async promise-based function so we
			* can normalize out the functionality of unwrapping the response and placing the contents
			* into the view.
			* @memberof Autocomplete.Directive
			* @param {array|function} data source
			* @returns {null}
			* @api private
			*/
		function updateSource(newSource) {
			if (Array.isArray(newSource) && newSource.length) {
				searchProxy = function() {
					return $timeout(function() {
						return newSource;
					},0);
				};
			} else if ('function' === typeof newSource) {
				//This will actually invoke the function once without params. This is bad, and
				//should be redone to inspect the function in a better fashion. Not sure how best
				//to do that at the moment, though
				if ( 'function' === typeof newSource().then ) {
					//This is a promise, so hook into it
					searchProxy = function(input) {
						return newSource(input).then(function(response) {
							return response;
						});
					};
				} else {
					//this is a sync function
					searchProxy = function(input) {
						return $timeout(function() {
							return newSource.call(this, input);
						},0);
					};
				}
			}
		}

		/**
			* @desc This function will take in an index and use that to look up a given autocomplete
			* item in our autocomplete list. That item will then be flagged as active (using a CSS)
			* class. It will then call the internal setHoverItem function will set the text in the
			* search box to the contents of the currently selected item **without issuing a new search**!
			* This is important because we don't want to change the list of values that show up in our
			* autocomplete when we are selecting through them (using the arrow keys, for example)
			* @memberof Autcomplete.Directive
			* @param {number} index
			* @returns {promise}
			* @api private
			*/
		function selectItem(index) {
			$('.autocomplete-item.active').removeClass('active');

			if (index > $('.autocomplete-item').length -1) {
				index = 0;
			}
			if (index < 0) {
				index = $('.autocomplete-item').length - 1;
			}
			currentSelector = index;
			$('.autocomplete-item').eq(index).addClass('active');
			//Use timeout here to make sure that we issue this on the next digest cycle. There are hacks
			//around this, but all of them are sure to break in newer releases of angular. This works just
			//fine, even if it looks a little hacky
			return $timeout(function() {
				setHoverItem(scope.items[index]);
			},0);
		}

		/**
			* @desc This was taken from the underscore library
			*
			* Returns a function, that, as long as it continues to be invoked, will not
		  * be triggered. The function will be called after it stops being called for
		  * N milliseconds. If `immediate` is passed, trigger the function on the
		  * leading edge, instead of the trailing.
		  */
		function debounce(func, wait, immediate) {
			var timeout;
			return function() {
				var context = this, args = arguments;
				var later = function() {
					timeout = null;
					if (!immediate) func.apply(context, args);
				};
				var callNow = immediate && !timeout;
				// clearTimeout(timeout);
				$timeout.cancel(timeout);
				timeout = $timeout(later, wait);
				if (callNow) func.apply(context, args);
			};
		}

	} //End LinkFn
}]; //End Directive
