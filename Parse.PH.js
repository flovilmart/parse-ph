
Parse.Object.prototype.withoutData = function(){
  var obj = new Parse.Object(this.className);
  obj.id = this.id;
  return obj;
};

Parse.Object.prototype.bareObject = function(){
  return {
    "_className" : this.className,
    "_id" : this.id
  };
};


Object.defineProperty(Parse.Object.prototype, "objectId", {
  get: function(){
    return this.id;
  }
});

var _ = require("underscore");

var PH = function(options) {
	_.each(arguments, function(option){
		if (typeof option == "function") {
			registerClass(option);
		}else if (typeof option == "object") {
			registerFunction(option);
		}
	});
};






var registerClass = function(objectClass){
	var afterSave = objectClass.afterSave;
	var beforeSave = objectClass.beforeSave;
	_.each([beforeSave, afterSave], function(hook){
		if (hook) {
			var finalFunction;
			if (typeof hook == "function") {
				finalFunction = hook;
			}else if(typeof hook == "object"){
				finalFunction = processHookWithOptions(hook);
			}
			if (hook == afterSave) {
				Parse.Cloud.afterSave(objectClass, finalFunction);
			}else if(hook == beforeSave){
				Parse.Cloud.beforeSave(objectClass, finalFunction);
			}
		}
	});
}

PH.register = function(classes) {
	if (typeof classes == "function") {
		classes = [classes];
	}
	_.each(classes, function(className){
		registerClass(className);
	});
};
var registerFunction = function(hook){
	if (hook) {
		var finalFunction;
		if(typeof hook == "object"){
			finalFunction = processHookWithOptions(hook);
		}
		Parse.Cloud.define(hook.name, finalFunction);
	}
};
PH.registerFunction = registerFunction;

var silentError = false;
module.exports.silentErrors = function(silent){
	if (typeof silent == 'undefined') {
		silent = true;
	}
	silentError = silent;
};
SKIPPER = "__SKIP__";
SUCCESS_EXIT = "__EXIT__";
PH.SkipFilters = SKIPPER;
PH.Success = SUCCESS_EXIT;

PH.ensureLogin = function(){
	return isLoggedInFunction;
};

PH.onUserRequest = function(aFunction){
	return function(request, response){
		if (request.user && !request.master) {
			return aFunction.apply(null, [request, response]); 
		}
		return true;
	};
}

PH.matchUserWithKey = function(key){
	return {
		action: matchLoggedInUserFunction,
		args: [key]
	};
};

PH.ensureMaster = function(){
	return function(request, response){
		if (!request.master) {
			return "Request not executed as Master";
		}
		return true;
	};
};

PH.onMasterRequest = function(aFunction){
	return function(request, response){
		if (request.master) {
			return aFunction.apply(null, [request, response]);
		}else{
			return true;
		}
	};
};

PH.onAnonymousRequest = function(aFunction){
	return function(request, response){
		if (!request.master && !request.user) {
			return aFunction.apply(null, [request, response]);
		}
		return true;
	};
};

PH.onExisted = function(aFunction){
	return checkNew(aFunction, true);
};

PH.onNew = function(aFunction){
	return checkNew(aFunction, false);
};

PH.skipFiltersOnMasterKey = function(){
	return function(request, response){
		if (request.master) {
			return SKIPPER;
		}
		return true;
	};
};

PH.exitOnMasterKey = function(){
	return function(request, response){
		if (request.master) {
			return SUCCESS_EXIT;
		}
		return true;
	};
};

PH.requiredProperties = function(properties){
	return function(request, response){
		var missingProperties = [];
		var obj = request.object;
		// Test the object property as no other way to distinguish
		if (obj) {
			_.each(properties, function(property){
				if(!obj.has(property)){
					missingProperties.push(property);
				}
			});
		}else{
			obj = request.params;
			_.each(properties, function(property){
				if (obj[property] === undefined) {
					missingProperties.push(property);
				}
			});
		}
		if (missingProperties.length) {
			return "Missing properties: "+missingProperties.join(", ");
		}
		return true;
	};
};

PH.preventChanges = function(properties){
	return function(request, response){
		if (!request.object) {
			return "Only use Prevent Changed in afterSave or beforeSave";
		}
		var changes =[];
		var retVal = _.every(properties, function(property){
			if(request.object.op(property)){
				changes.push(property);
			}
		});
		//console.log("Some changes!");
		//console.log(changes);
		if (changes.length) {
			return "Forbidden property changes "+changes.join(", ");
		}
		return true;
	};
};

PH.error = function(){
	console.error(arguments);
	return arguments[0];
};

var checkNew = function(aFunction, existed){
	return function(request, response){
		if (request.object.existed() === existed) {
			return aFunction.apply(null, [request, response]);
		}else{
			return true;
		}
	};
};

var isLoggedInFunction = function(request, response){
	if (!request.user) {
		return "No user set";
	}
	return true;
};

var matchLoggedInUserFunction = function(request, response, key){
	var err = isLoggedInFunction(request, response);
	if (err === true){
		if (request.user.id == request.object.get(key).id) {
			return true;
		}
		return "Logged in user don't match";
	}else{
		return err;
	}
};

var wrapFunction = function(chain) {
	return function(request, response) {
		var errno;
		var main = chain[chain.length-1];
		var functionIndex;
		chain.every(function(chainObject, index) {
			var chainFunction = chainObject.action;
			functionIndex = index;
			if (chainFunction) {
				var args = [request, response];
				Array.prototype.push.apply(args, chainObject.args || []);
				errno = chainFunction.apply(null, args);
				if (errno !== true) {
					return false;
				}else{
					return true;
				}
			}else{
				return true;
			}
		});
		if (errno === undefined && functionIndex == chain.length-1) {
			errno = true;
		}
		if (errno == SUCCESS_EXIT) {
			return response.success();
		}
		if (errno == SKIPPER) {
			var args = [request, response];
			Array.prototype.push.apply(args, main.args || []);
			main.action.apply(null, args);
			return;
		}
		if (errno !== true || errno === false) {
			if (response){
				var pre = "Hook Filter "+functionIndex;
				if (functionIndex == (chain.length -1)) {
					pre = "Main function";
				}
				var _responseText = pre+": "+errno;
				if (silentError === true) {
					console.error(_responseText);
					response.error();
				}else{
					response.error(_responseText);
				}
			}else{
				console.warn("Hooks.js - AfterSave execution aborted...");
				console.warn("Hooks.js - "+errno);
			}
		}
	};
};

var processHookWithOptions = function(hook){
	var chain = [];
	_.each(hook.filters, function(object, index){
		if (typeof object == "object") {
			chain.push(object);
		}else if(typeof object == "function"){
			chain.push({action: object});
		}
	});
	if (hook.action) {
		chain.push({action:hook.action});
	}else{
		chain.push({action: function(request, response){
			if (response) {
				return response.success();
			}
		}});
	}
	return wrapFunction(chain);
};


Parse.PH = PH;