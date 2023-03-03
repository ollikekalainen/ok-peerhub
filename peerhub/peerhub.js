/*
 ok-peerhub.js
-----------------------------------------------------------------------------------------
 (c) Olli Kekäläinen, Rajahyöty Oy

 
	Initialization 

		const PeerHub = require("peerhub");
		new PeerHub(params);

			params:
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

		---


 20230303
-----------------------------------------------------------------------------------------
*/

const WS = require("ws");
const helper = require("./helper");
const EventEmitter = require("events");

const __DEBUG = true;

const P = "__public__";
const _P = "__private__";

const MESSAGETYPE_NUDGE = "nudge";
const MESSAGETYPE_LEAVE = "leave";
const MESSAGETYPE_NOTIFY = "notify";
const MESSAGETYPE_REQUEST = "request";
const MESSAGETYPE_RESPONSE = "response";
const MESSAGETYPE_MESSAGE = "message";
const MESSAGETYPE_ACCEPT = "accept";
const MESSAGETYPE_PRESENCE = "presence";
const MESSAGETYPE_ALTER = "alter";
const MESSAGETYPE_CONFIRM = "confirm";

const DEBOUT_CHANNEL = "w2dutnc-k7vsj2og";
const DEBOUT_TYPES = {
	CLIENT2HUB: "client2hub",
	HUB2CLIENT: "hub2client",
	TERMINATE: "terminate",
	CLIENTDEBOUT: "clientdebout",
	CONNECTED: "connected"
};

class PeerHub extends EventEmitter {

	#__clients = {};
	#encryptionKeyMissingNotified = false;
	#nudgeTimer;
	#options = {
		nudgeInterval: 10000,
		pingInterval: 10000
	};
	#pinger;
	#wsServer;

	constructor( options = {}) {
		super();
		//this.channels = {};
		Object.assign( this.#options, options );
		this.#wsServer = new WS.Server({ server: this.#options.httpServer });
		this.#wsServer.on( "connection", ( client, request )=>{ this.onConnection( client, request );});
		this.#wsServer.on( "error", (error) => { this.onError(error); });
		this.#startPinger();
		this.#startNudge();
		this.on( "messagein", ( client, message ) => { this.onMessageIn( client, message );});
		this.on( "messageout", ( client, message ) => { this.onMessageOut( client, message );});
	}

	get clients() { 
		return this.#wsServer.clients; 
	}

	get deboutEnabled() {
		return !!this.#options.deboutEnabled;
	}

	set deboutEnabled(deboutEnabled) {
		this.#options.deboutEnabled = !!deboutEnabled;
		return !!deboutEnabled;
	}

	get nudgeInterval() {
		return this.#options.nudgeInterval;
	}

	set nudgeInterval(value) {
		this.#options.nudgeInterval = value;
		this.#startNudge();
		return value;
	}

	get pingInterval() {
		return this.#options.pingInterval;
	}

	set pingInterval(value) {
		this.#options.pingInterval = value;
		this.#startPinger();
		return value;
	}

	onAddTag( client, message ) {
		helper.arrify(message.content).forEach((tag) => { 
			(client[P].tags.indexOf(tag) < 0) && client[P].tags.push(tag); 
		});
		this.#alter( client );
	}

	onConnection( client, request ) {
		this.#prepareClient( client, helper.getRemoteAddress(request));
		this._debout( DEBOUT_TYPES.CONNECTED, client, "" );
		client.on( "message", (message) => { this.emit( "messagein", client, message );});
		this.#accept(client);
 		client.alive = true;
  		client.on( "pong", ()=>{ client.alive = true; });	
	}

	onDebout( client, message ) {
		this._debout( DEBOUT_TYPES.CLIENTDEBOUT, client, message.content );
	}

	onDeboutSelection( client, message ) {
		const selection = {};
		if (typeof message.content == "object") {
			for (let type in message.content) {
				if (this.#isDeboutType(type)) {
					selection[type] = !!message.content[type];
				}
			}
		}
		Object.assign( client[_P].deboutSelection, selection );
		this.#alter( client );
	}

	onError(error) {
		this.#logError(error);
	}

	onInitiate( client,  message ) {
		const content = message.content;
		client[P].userid = content.userid ? helper.stringToHex( this.#encrypt( content.userid )) : "";
		client[P].linkageKey = content.linkageKey ? content.linkageKey : "";
		client[P].startTime = content.startTime;
		content.id && (client[P].id = content.id);	// in case of reconnection
		client[P].deboutCluster = content.deboutCluster;
		Object.assign( client[P].properties, content.properties||{} );
		Object.assign( client[_P].options, content.options||{} );
		helper.arrify(content.tags).forEach((tag) => { 
			(client[P].tags.indexOf(tag) < 0) && client[P].tags.push(tag); 
		});
		this.#confirm( client );	// Send the confirm message to the peer just initialized
		this.#presence( client );	// Informs other peers for the presence of the peer initialized
									// for checking for the case server is deleted client
	}

	onLeave( client, message ) {
		__DEBUG && console.log( "PeerHub.onLeave by " + (client[P]||{}).id );
		client.close(1000);
		const begin = Date.now();
		const timeout = 20000;
		const timer = setInterval(() => {
		    if ([WS.OPEN, WS.CLOSING].includes(client.readyState)) {
    			__DEBUG && console.log( "Terminate client " + client[P].id + "." );
      			client.terminate();
      			clearInterval(timer);
    		}
    		else if(Date.now() - begin > timeout) {
    			__DEBUG && console.log( "Failed to terminate client " + client[P].id + " (timeout)." );
      			clearInterval(timer);
    		}
  		}, 50 );
		this.#leave(client);
	}

	onMessageIn( client, message ) {
		try {
			const msg = JSON.parse(message);
			const type = msg.type + "";
			type == "debout" || this._debout( DEBOUT_TYPES.CLIENT2HUB, client, msg );
			if (type) {
				const method = "on" + type[0].toUpperCase()+ type.substr(1);
				if (typeof this[method] == "function") {
					this[method]( client, msg );
				}
				else {
					this.#logError( new Error( "E_INCORRECTACTION" ), client, message );
				}
			}
			else {
				this.#logError( new Error( "E_INADEQUATEMESSAGE" ), client, message );
			}
		}
		catch (error) {
			this.#logError( error, client, message );
		}
	}

	onMessageOut( client, message ) {
		try {
			this._debout( DEBOUT_TYPES.HUB2CLIENT, client, message );
			client.send( JSON.stringify( message ));
		}
		catch (error) {
			this.#logError( error, client, message );
		}
	}

	onNotify( client, message ) {
		helper.arrify(message.peer).forEach((p) => {
			const peer = this.#getClientById(p);
			if (peer) {
				this.#newMessageOut( peer, {
					type: MESSAGETYPE_NOTIFY,
					peer: client[P].id,
					messageid: message.messageid,
					name: message.name,
					content: message.content
				}).send();
			}
		});
	}

	onPublish( client, message ) {
		const content = message.content;
		if (content.channel && content.message) {
			this.clients.forEach( (_client) => {
				if (_client[_P].channels.indexOf(content.channel) >= 0) {
					this.#newMessageOut( _client, {
						type: MESSAGETYPE_MESSAGE,
						peer: client[P].id,
						messageid: message.messageid,
						content: content
					}).send();
				}
			});
		}
	}

	onRemoveTag( client, message ) {
		helper.arrify(message.content).forEach((tag) => { 
			const index = client[P].tags.indexOf(tag);
			(index < 0) || client[P].tags.splice( index, 1 );
		});
		this.#alter( client );
	}

	onRequest( client, message ) {
		const peer = this.#getClientById(message.peer);
		if (peer) {
			// forward request message to the target peer
			this.#newMessageOut( peer, {
				type: MESSAGETYPE_REQUEST,
				peer: client[P].id,
				name: message.name,
				messageid: message.messageid,
				content: message.content
			}).send();
		}
	}

	onResponse( client, message ) {
		const peer = this.#getClientById(message.peer);
		if (peer) {
			// forward response message
			this.#newMessageOut( peer, {
				type: MESSAGETYPE_RESPONSE,
				peer: client[P].id,
				messageid: message.messageid,
				name: message.name,
				content: message.content
			}).send();
		}
	}

	onRetrievePeers( client,  message ) {
		const peers = [];
		const requesterId = client[P].id;
		const linkageKey = client[P].linkageKey;
		const isValid = (client) => {
			return client[P].id !== requesterId
				&& client[P].linkageKey == linkageKey
				&& !this.#isDeboutReceiver(client);
		};
		this.clients.forEach((client) => {
			isValid(client) && peers.push(this.#getClientInfo(client));
		});
		this.#newMessageOut( client, {
			type: MESSAGETYPE_RESPONSE,
			messageid: message.messageid,
			name: "retrievePeers",
			content: { peers: peers }
		}).send();
	}

	onSetProperties( client, message ) {
		client[P].properties = Object.assign( client[P].properties, message.content||{} );
		this.#alter( client );
	}

	onSubscribe( client, message ) {
		const c = message.content;
		c.channels && c.channels.forEach( (channel) => {
			if (client[_P].channels.indexOf(channel)<0) {
				client[_P].channels.push(channel);
			}
		}); 
	}

	onUnsubscribe( client, message ) {
		const c = message.content;
		c.channels && c.channels.forEach( (channel) => {
			const index = client[_P].channels.indexOf(channel);
			if (index >= 0) {
				client[_P].channels.splice( index, 1 );
			}
		});
	}

   	_debout( type, client, message = "" ) {
   		if (this.#options.deboutEnabled) {
	   		const deboutMessage = { type: type, message: message, client: this.#getClientInfo(client) };
			const time = new Date().getTime();
			const deboutCluster = client[P].deboutCluster;
			this.clients.forEach( (client) => {
				if (client.readyState === WS.OPEN && this.#isDeboutReceiver( client, deboutCluster, type )) {
					client.send( JSON.stringify({ 
						type: MESSAGETYPE_MESSAGE,
						content: {
							time: time, 
							channel: DEBOUT_CHANNEL, 
							message: deboutMessage
						}
					}));
				}
			});
		}
   	}

	get #encryptionKey() {
		return this.#options.encryptionKey;
	}

	#accept( client ) {
		this.#newMessageOut( client, {
			type: MESSAGETYPE_ACCEPT,
			peer: client[P].id,
			content: {
				id: client[P].id,
				deboutChannel: DEBOUT_CHANNEL
			}
		}).send();
	}

	#alter( client ) {
		if (client[_P].options.peerInitiationSender) {
			this.clients.forEach((peer) => {
				if (client[P].inRelationTo( peer )) {
					this.#newMessageOut( peer, {
						peer: client[P].id,
						type: MESSAGETYPE_ALTER,
						name: "",
						content: client[P]
					}).send();
				}
			});
		}
	}

	#checkDeletedCients() {
		const clients = Array.from(this.clients);
		Object.entries( this.#__clients ).forEach(([privateid,client]) => {
			if (!clients.find((c) => { return c[_P].privateid == privateid; })) {
				this.#leave( client );
				delete this.#__clients[privateid];
			}
		});
	}

	#confirm( client ) {
		this.#newMessageOut( client, {
			type: MESSAGETYPE_CONFIRM,
			peer: client[P].id,
			content: {
				userid: client[P].userid
			}
		}).send();
	}

	#decrypt( text ) {
		const crypting = require("./crypting");
		return crypting.decrypt( text, this.#encryptionKey );
	}

	#encrypt( text ) {
		const crypting = require("./crypting");
		if (this.#encryptionKey) {
			return crypting.encrypt( text, this.#encryptionKey );
		}
		else if (!this.#encryptionKeyMissingNotified) {
			this.#encryptionKeyMissingNotified = true;
			console.log("PeerHub encryption key not specified!");
		}
		return text;
	}

	#getClientById(id) {
		const clients = Array.from(this.clients);
		let client, i = 0;
		while (i < clients.length) {
			client = clients[i++];
			if (client[P].id == id) {
				return client;
			}
		}
	}

	#getClientInfo(client) {
		return client[P]||{};
	}

   	#isDeboutReceiver( client, deboutCluster, type ) {
   		return (deboutCluster == undefined || client[P].deboutCluster == deboutCluster) 
   			&& client[_P].channels.indexOf(DEBOUT_CHANNEL) >= 0
   			&& (!type || client[_P].deboutSelection[type]);
   	}

	#isDeboutType(type) {
		for (let name in DEBOUT_TYPES) {
			if (type == DEBOUT_TYPES[name]) {
				return true;
			}
		}
		return false;
	}

	#leave( client ) {
		__DEBUG && console.log("Client leaves " + (client[P]||{}).id);
		if (client[_P] && (client[_P].options||{}).peerInitiationSender && !client[_P].leftTheBuilding) {
			client[_P].leftTheBuilding = true;
			this.clients.forEach((peer) => {
				if (client[P].inRelationTo( peer )) {
					__DEBUG && console.log( "Leave message sent to peer client " + peer[P].id );
					this.#newMessageOut( peer, {
						type: MESSAGETYPE_LEAVE,
						peer: (client[P]||{}).id,
						name: "",
						content: client[P]
					}).send();
				}
			});
		}
	}	

	#logError( error, client, message ) {
		client && (error.client = this.#getClientInfo(client));
		message && (error._message = message);
		console.log( error );
	}

	#newMessageOut( client, params ) {
		return new MessageOut( this, client, params );
	}

	#nudgeClients() {
		this.clients.forEach((peer) => {
			this.#newMessageOut( peer, {
				type: MESSAGETYPE_NUDGE,
				name: undefined,
				content: {
					time: Date.now(),
					interval: this.nudgeInterval
				}
			}).send();
		});
	}

	#prepareClient( client, remoteAddress ) {
		if (!client[P]) {
			client[_P] = {};
			client[_P].channels = [];
			client[_P].options = {};
			client[_P].deboutSelection = {};
			client[_P].privateid = helper.uniqueID();
			client[P] = {};
			client[P].id = helper.uniqueID();
			client[P].deboutCluster = undefined;
			client[P].userid = "";
			client[P].linkageKey = "";
			client[P].tags = [];
			client[P].properties = {};
			client[P].remoteAddress = remoteAddress;
			client[P].hasAllTags = function (tags=[]) {
				let i = 0;
				while (i < tags.length) {
					if (this.tags.indexOf(tags[i++]) < 0) {
						return false;
					}
				}
				return true;
			};
			client[P].hasAnyTag = function (tags=[]) {
				let i = 0;
				while (i < tags.length) {
					if (this.tags.indexOf(tags[i++]) >= 0) {
						return true;
					}
				}
				return false;
			};
			client[P].inRelationTo = function( peer ) {
				return peer[P].id !== this.id 
					&& peer[_P].options.peerInitiationReceiver
					&& peer[P].linkageKey == this.linkageKey;
			};
			this.#__clients[client[_P].privateid] = client;
		}
	}

	#presence( client ) {
		if (client[_P].options.peerInitiationSender) {
			this.clients.forEach((peer) => {
				if (client[P].inRelationTo( peer )) {
					this.#newMessageOut( peer, {
						type: MESSAGETYPE_PRESENCE,
						peer: client[P].id,
						name: "",
						content: client[P]
					}).send();
				}
			});
		}
	}

	#startNudge() {
		if (this.#nudgeTimer) {
			clearInterval(this.#nudgeTimer);
			this.#nudgeTimer = undefined;
		}
		if (this.nudgeInterval) {
			this.#nudgeTimer = setInterval(() => { this.#nudgeClients(); }, this.nudgeInterval );
		}
	}

   	#startPinger() {
   		let previousCount = 0;
   		let previousTime = Date.now();
   		if (this.#pinger) {
   			clearInterval( this.#pinger );
   			this.#pinger = undefined;
   		}
		this.pingInterval && (this.#pinger = setInterval(() => {
			this.#checkDeletedCients();
			let now = Date.now();
			if (now - previousTime >= this.pingInterval) {
				let count = 0;
				this.clients.forEach((client) => {
					++count;
					if (!client.alive) {
						this._debout( DEBOUT_TYPES.TERMINATE, client );
						__DEBUG 
							&& console.log( "Client (" + client[P].id 
								+ ") didn't pong back. It is terminated."
							);
						// this.#leave(client);
						setTimeout(() => { client.terminate();}, 100 );
						return 
					}
					client.alive = false;
					client.ping(()=>{});
				});
				if (__DEBUG && count !== previousCount) {
					console.log( "Pinger noticed a change in the number of the clients (current: " 
						+ count + ", previous: " + previousCount + ")"
					);
				}
				previousCount = count;
				previousTime = now;
			}
		}, 250 ));
   	}
}

class MessageOut {
	/*
		params:
			type: string, message type
			messageid: string
			name: string, optional
			peer: string, optional (peer id)
			content: object|string|number|array
	*/
	constructor( peerHub, client, params ) {
		this.peerHub = peerHub;
		this.client = client;
		this.message = {
			type: params.type,
			messageid: params.messageid||helper.uniqueID(),
			name: params.name,
			peer: params.peer,
			content: params.content
		};
	}

	send() {
		if (this.client.readyState === WS.OPEN) {
			this.peerHub.emit( "messageout", this.client, this.message );
		}
	}
}

module.exports = PeerHub;
