/*
 ok-peerhub.js
-----------------------------------------------------------------------------------------
 (c) Olli Kekäläinen, Rajahyöty Oy


	Initialization 

		const OkPeerHub = require("ok-peerhub");
		new OkPeerHub(params);

			options:
				httpServer: nodeHttpServer|nodeHttpsServer,
				deboutEnabled: boolean,
				encryptionKey: string
				pingInterval: number, default: 10000 ms
				nudgeInterval: number, default: 10000 ms
					Helps OkPeerConnection to reconnect after waking up from sleep


	Properties

		deboutEnabled	boolean
		nudgeInterval 	number
		pingInterval 	number


	Methods

		getPeerConnectionSource( onError, onSuccess )

			onError 	function(error)
			onSuccess	function(source)




 20230303
-----------------------------------------------------------------------------------------
*/

const PeerHub = require("./peerhub/peerhub");

class OkPeerHub extends PeerHub {
	constructor( options = {}) {
		super( options );
	}

	static get OkPeerConnection() {
		// For node client
		return require("./browserside/ok-peerconnection.js");
	}

	get deboutEnabled() {
		return super.deboutEnabled;
	}

	set deboutEnabled(deboutEnabled) {
		super.deboutEnabled = !!deboutEnabled;
		return !!deboutEnabled;
	}

	get nudgeInterval() {
		return super.nudgeInterval;
	}

	set nudgeInterval(value) {
		super.nudgeInterval = value;
		return value;
	}

	get pingInterval() {
		return super.pingInterval;
	}

	set pingInterval(value) {
		super.pingInterval = value;
		return value;
	}

	getPeerConnectionSource( onError, onSuccess, minimized = true ) {
		// To the the browser side via for example  ok-server API.
		const helper = require("./peerhub/helper");
		const filename = __dirname + "/browserside/ok-peerconnection";
		helper.fileRead( onError, onSuccess, filename + (minimized ? "-min.js" : ".js"));
	}
}

module.exports = OkPeerHub;
