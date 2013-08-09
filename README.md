parse-helpers
=============

Parse Helper Function for code cleanness and sanity
### Get the code:
At the root of your project, add this as a submodule:

`git submodule add git@github.com:icangowithout/parse-ph.git cloud/libs/parse-ph`

or just clone:

`git clone git@github.com:icangowithout/parse-ph.git cloud/libs/parse-ph`


##Parse.PH.js

in your main, just include **at the very beginning**:

	require("cloud/libs/parse-ph/Parse.PH.js");


Helper methods for registering afterSave and beforeSave methods in CloudCode, reusing some blocking code as checking if the request user is logged in, or other highly repeatable function.

###Extensions for All Parse Objects:

`withoutData()` returns the object without the content (perfect to improve save time)

`bareObject()` returns a base JSON representation { "_className" : this.className, "_id" : this.id}

`objectId` return the id value


### Parse.PH:

#### afterSave and beforeSave at Class Level
	
	var MyObject = Parse.Object.extend("MyObject", {
		// Instance methods
	}, {
		// Class Methods
		
		// Simple afterSave
		afterSave: function(request){
			// do some stuff
		
		},
		// Complex beforeSave
		beforeSave: {
			filters: [
				// ensures a user is logged in
				Parse.PH.ensureLogin(),
				// ensures the object to be saved has a property matching with the current user
			],
			action: function(request, response){
				// Do what you want here
				return response.success();
			},
		}
		
	});


Then register your object

	Parse.PH(MyObject)
	
	
You can import all your models in the main.js and then register all your hooks at once:

	
	Parse.PH(MyObject, MyOtherObject);
	

Do not register two times the same Class, your deployment will fail!

#### Cloud Code functions

You can use Parse.PH to define Cloud Code functions and take advantage of the synchronous filter architecture

	var myFunction = {
		name : "myFunction",
		filters : [],
		action: function(request, response){
			response.success("it Works!");
		}
	}
	
	Parse.PH(myFunction);
	
You can mix Classes and functions in the same call:
	
	Parse.PH(ClassA, ClassB, functionA, functionB, ClassC );


###Execution order

1. *filters*  are **EVER** executed first and in declaration order! Returning something else than `true` will **STOP** the further execution the rest of the *filters* and *main action*! the  it's recommended to return an error message so it's more comprehensive. ** ATTENTION ** stop the exection of your hook with `return response.success()` will trigger a `response.error(undefined)` as 
2. *action* the main action for your beforeSave or afterSave, where the main logic should be


By design, the *filters* actions don't support callbacks so it speeds up the execution and helps.

If you have any question regarding the code, usage… please email me to florent < at > icangowithout.com 

###Predefined filters

#### direct filters
`Parse.PH.ensureLogin()` will abort execution is no user is logged in or continue to the next filter

`Parse.PH.ensureMaster()` will abort execution if using a client key or continue to the next filter

`Parse.PH.skipFiltersOnMasterKey()` will skip the filters to the main action if using Master Key or continue to the next filter

`Parse.PH.exitOnMasterKey()` will return a success immediately if using a Master Key

`Parse.PH.requiredProperties(properties)` will abort exection and return an error if one of the required key is missing in the object or continue to the next filter

`Parse.PH.preventChanges(properties)` will abort execution if a Parse.Op is returned on one of the key or continue to the next filter


#### custom filters

the custom filters take 

	aFunction = function(request, response){
		/*
			Not returning the funciton will break further execution
			returning true  will continue to the next filter
			returning anything else than true will break execution and fire the response.error with the returned value
		*/
		if(ok)
			return true
		else
			return "There was an error"
	}



`Parse.PH.onUserRequest(aFunction)` will call aFunction when a user is set

`Parse.PH.onMasterRequest(aFunction)` will call aFunction if the request if from masterkey

`Parse.PH.onAnonymousRequest(aFunction)` will call aFunction if the request is anonymous

`Parse.PH.onExisted(aFunction)` will call aFunction when the request.object existed

`Parse.PH.onNew(aFunction)` will call aFunction when the request.object is new

aFunction is a Cloud function that takes the form `function(request, response){}` 
aFunction should `return true` to keep going

You can skip the remaining filters by returning `Parse.PH.skipFilters`

