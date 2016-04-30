# Office Bot Autocomplete

This module does some basic autocomplete stuff using either local or remote data sources. Ths module exposes a single directive.

# Getting Started

The first step is to include the library into your Angular application. We use [Browserify](https://github.com/substack/node-browserify) to bundle our application together, so our application usually looks something like this:

```
var angular = require('angular');

angular
	.module('application-root', [
		require('officebot-autocomplete')
	]);

```

If you are including this code directly from your HTML, be sure to use the files in `/dist`.

```
<script src='/node_modules/officebot-sdk/dist/js/officebot-autocomplete.js'></script>
```

Optionally, you may want to include the styles from this module, either from the `/styles` folder (if you want to link the LESS into your project) or the `/dist/css` for the compiled CSS.

```
<link href='/node_modules/officebot-autocomplete/dist/css/officebot-autocomplete.css' rel='stylesheet'>
```

# Basic Usage

Use this module like you would any other directive. Here's a quick example of using a function as your data source (assuming the function returns an array of objects)

```
	<autocomplete src='dataSource' using='objectFieldName'></autocomplete>
```

# Options

| Name            | Type         | Default     | Descriptions 																																									 |
|:----------------|:-------------|:------------|:-------------------------------------------------------------------------------------------------|
| class           | string       | ""          | A list of class names to apply to the autocomplete input box																		 |
| contentTemplate | string       | ''          | You can pass a custom, interpolated string into the directive to tell it how you would like each matched item rendered. For more information, see the section on custom templates. |
| debounce        | number       | 0           | The number of milliseconds to wait before re-invoking the 'src' expression. If set to 0, it will fire each time a new character is entered into the autocomplete's input box. |
| limit           | number       | 100         | The maximum number of records to show in the dropdown                                           |
| minLength       | number       | 0           | The minimum number of characters the user must enter before the autocomplete starts checking.   |
| onClick         | expression   | null        | An expression to invoke when an item in the autocomplete is clicked. This is typically a function in your local scope. |
| onMouseover     | expression   | null        | An expression that is invoked each time a user hovers over an item in the autocomplete dropdown.|
| onSubmit        | expression   | null        | An expression to invoke when the enter key is pressed on the autcomplete input box. The current content of the input box will be passed to this function. |
| src             | mixed        | null        | This can be a local array in your scope, a reference to a syncronous function, or a reference to an asyncronous function that returns a promise (it MUST return a promise). |
| using           | string       | null        | If your data source is an array of objects, this field should indicate which object property to use for matching and rendering your data source. |


# Events

Event handlers are functions in your local scope that you pass into the directive. There are three events you can watch for: `onClick`, `onMouseover`, and `onSubmit`. This next section will give a quick run-through of those events and how to use them.

## .onClick(item)

When this function is invoked, it will pass in a single parameter containing the item that was clicked on.

```
item = {
	target : {}, //the element that was clicked
	preMatch : "", //The string portion that appears before the matched text
	match : "", //The string portion matching the user input
	postMatch :	"" //The string portion that appears after the matched text
}

```

## .onMouseover(item)

When this function is invoked, it will pass in a single parameter containing the item that was clicked on.

```
item = {
	target : {}, //the element that was clicked
	preMatch : "", //The string portion that appears before the matched text
	match : "", //The string portion matching the user input
	postMatch :	"" //The string portion that appears after the matched text
}
```

## .onSubmit(matchText)

This function receives a single string that equals the contents of the autocomplete's text box.

```
	@param {string} matchText
```

# Custom item template

Be default, each matched item is rendered using the following template:
```
<span>{{item.preMatch}}<strong>{{item.match}}</strong>{{item.postMatch}}</span>
```

You can pass a string into the directive that represents a custom template. The string can be an interpolated string (like the default template). The template will receive the following parameters:

```
index : The zero-index position this entry appears in the autocomplete dropdown
item : The object representation of the entry in the autocomplete dropdown. This is the same object that is passed to the onClick and onMouseover events
```

# Common Mistakes

## Event handlers

When passing event handler functions into the onClick, onMouseover, or onSubmit parameters, make sure you are passing in the names of the functions, and not the invocation of those functions.

```
Right:
   on-click="someFn"
Wrong:
   on-click="someFn(item)"
```

## Directive attributes

Remember that directives convert camelCase into spine-case. So, for the `onSubmit` attribute, the directive attribute would be 'on-submit'.

```
Right:
   content-template=""
Wrong:
   contentTemplate=""
```

# Building

There are a few options for using this directive in your project (such as linking to the compiled resources in the `/dist` folder or importing the module into your project), but if you make changes to the source and you need to rebuild things, make sure you have the dependencies installed and then simply run `gulp`. This will re-output the built components to `/dist`.

```bash
$ npm install
$ gulp
```

You may be wondering why there are two `index.js` files. The file in the root project directory is used by `gulp` to ensure that Angular is loaded from the `window` object. The file in `/src` is used when linking the module into your build process. This version of the file uses `browserify`'s `extern` functionality to link to a version of Angular that has been converted to a javascript module.


# Todo

* Write unit tests

# License

MIT 
