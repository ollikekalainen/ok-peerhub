//# sourceURL=loadOkPeerConnection.js
/*
----------------------------------------------------------------------------------------------------
 loadOkPeerConnection.js


	
	 loadOkPeerConnection( onError, onSuccess, url )
	
	 	Makes PeerConnection class accessible as a property of the window object.
	
	 	Arguments
	 		onError		function (error)
	 		onSuccess	function (responseContent) 
	 		url			string, default: location.protocol + "	" + location.host + "/api"
	 		minimized	boolean, defult: false
	 
	


 20230216
----------------------------------------------------------------------------------------------------
*/
(() => {

	window.loadOkPeerConnection = ( onError, onSuccess, url, minimized = true ) => {
		apiRequestGetPeerSource({ onError: onError, onSuccess: (source) => { 
				DOMEval( source );
				onSuccess();
		   	},
		   	url: url,
		   	minimized: minimized
	   	});
	}

	function apiRequestGetPeerSource( params = {}) {

		const xhr = new XMLHttpRequest();
		
		xhr.addEventListener( "error", () => { params.onError( new Error( "E_LOAD" ));});
		xhr.addEventListener( "abort", () => { params.onError( new Error( "E_ABORT" ));});
		xhr.addEventListener( "load", () => {
			let response;
			try {
				response = JSON.parse(xhr.responseText);
			}
			catch (error) {
				params.onError( new Error("E_PARSE: " + error.message ));
			}
			if (response) {
				if (response.succeed) {
					params.onSuccess(response.content);
				}
				else {
					params.onError(response.error);
				}
			}
		});
		xhr.open( "POST", params.url || (location.protocol + "//" + location.host + "/api"));
		xhr.setRequestHeader( "X-Requested-With", "XMLHttpRequest" );
		xhr.setRequestHeader( "Content-Type", "application/json; charset=utf-8" );
		xhr.send( JSON.stringify({ 
			name: "getpeersource", 
			parameters: { minimized: params.minimized }
		}));
	}

	function DOMEval( scriptSource, params = {} ) {
		const script = document.createElement("script");
		params.nonce && (script.nonce = nonce);
		params.type && (script.type = params.type);
		script.text = scriptSource;
		document.head.appendChild(script).parentNode.removeChild(script);
	}

})();