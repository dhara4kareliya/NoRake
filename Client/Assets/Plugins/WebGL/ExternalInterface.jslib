var ExternalInterfacePlugin = {

	$contextObject: {
		toUnityString: function (str) {
			var bufferSize = lengthBytesUTF8(str) + 1;
			var buffer = _malloc(bufferSize);
			stringToUTF8(str, buffer, bufferSize);
			return buffer;
		},
	},

	GetGameServer: function () {
		var _gs = window.gs || "http://127.0.0.1:3000";
		console.log("GetGameServer: gs: ", _gs);
		return contextObject.toUnityString(_gs);
	},

	GetThread: function () {
		var _thread = window.thread || "test_thread";
		console.log("GetThread: token: ", _thread);
		return contextObject.toUnityString(_thread);
	},

	GetUser: function () {
		var _user = window.user || "test_user1_token";
		console.log("GetUser: user: ", _user);
		return contextObject.toUnityString(_user);
	},

	SetTableName: function (str) {
		window.document.title = Pointer_stringify(str);
	},

	Leave: function () {
		window.close();
	},
};

autoAddDeps(ExternalInterfacePlugin, '$contextObject'); // tell emscripten about this dependency, using the file name and communicator object name as parameters.
mergeInto(LibraryManager.library, ExternalInterfacePlugin);
