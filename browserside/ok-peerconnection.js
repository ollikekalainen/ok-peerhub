//# sourceURL=ok-peerconnection.js
/*! (c) by Olli Kekäläinen, Rajahyöty Oy*/
(() => {

	const VERSION = "1.0.0";
	const VERSION_DATE = "20230303";

	const NODE = typeof require == "function" && typeof process == "object" && typeof process.exit == "function";
	const __DEBUG = false;

	const DEFAULT_REQUESTTIMEOUT = 20000;
	const NUDGE_STORAGEPREFIX = "r0gby7a-lae262ja-";

	const READYSTATE_CONNECTING = 0;
	const READYSTATE_OPEN = 1;
	const READYSTATE_CLOSING = 1;
	const READYSTATE_CLOSED = 3;

	const MESSAGETYPE_ACCEPT = "accept";				// hub2client
	const MESSAGETYPE_ADDTAG = "addTag";
	const MESSAGETYPE_CONFIRM = "confirm";				// hub2client
	const MESSAGETYPE_DEBOUT = "debout";
	const MESSAGETYPE_DEBOUTSELECTION = "deboutSelection";
	const MESSAGETYPE_LEAVE = "leave";
	const MESSAGETYPE_INITIATE = "initiate";
	const MESSAGETYPE_MESSAGE = "message";
	const MESSAGETYPE_NOTIFY = "notify";
	const MESSAGETYPE_NUDGE = "nudge";				
	const MESSAGETYPE_PRESENCE = "presence";			// hub2client
	const MESSAGETYPE_ALTER = "alter";					// hub2client
	const MESSAGETYPE_PUBLISH = "publish";
	const MESSAGETYPE_REMOVETAG = "removeTag";
	const MESSAGETYPE_REQUEST = "request";
	const MESSAGETYPE_RESPONSE = "response";
	const MESSAGETYPE_RETRIEVEPEERS = "retrievePeers";
	const MESSAGETYPE_SETPROPERTIES = "setProperties";
	const MESSAGETYPE_SUBSCRIBE = "subscribe";
	const MESSAGETYPE_UNSUBSCRIBE = "unsubscribe";

	const DEBOUT_TYPES = {
		CLIENT2HUB: "client2hub",
		HUB2CLIENT: "hub2client",
		TERMINATE: "terminate",
		CLIENTDEBOUT: "clientdebout",
		CONNECTED: "connected"
	};
	
	const DEFAULT_DEBOUTSELECTION = {};
	Object.keys(DEBOUT_TYPES).forEach((type) => {
		DEFAULT_DEBOUTSELECTION[DEBOUT_TYPES[type]] = true;
	});
	
	let REQUEST_MESSAGES;

	class OkPeerConnection extends (NODE ? require("events") : EventTarget) {

		#awakeSentinel;
		#connectCount = 0;
		#deboutChannel;
		#debug = __DEBUG;
		#eventHandlersSet = false;
		#filterTags = [];
		#id;
		#nudgeInterval = 0;
		#nudgeTimer = 0;
		#nudgeTime = 0;
		#params;
		#peers = {};
		// #reconnectTimer = undefined;
		#startTime;
		#state = "closed";
		#channels = [];
		#webSocket;

		constructor(params) {
			super();
			this.#params = params||{};
			typeof this.#params.debug == "boolean" && (this.#debug = this.#params.debug);
			this.#validateParameters();
			if (NODE) {
				process.on( "beforeExit", () => { this.#leave();});
			}
			else {
				window.addEventListener( "unload", (event) => { this.#leave(); });
			}
		}

		get connectCount() {
			return this.#connectCount;
		}

		get deboutCluster() {
			return this.#params.deboutCluster;
		}

		get deboutReceiver() {
			return this.options.deboutReceiver || false;
		}

		set deboutReceiver(value) {
			value = !!value;
			if (this.options.deboutReceiver !== value) {
				this.options.deboutReceiver = value;
				this.#setDeboutReceiverStatus(value);
			}
			return this.options.deboutReceiver;
		}

		get filterTags() {
			return this.#filterTags;
		}

		get id() {
			return this.#id;
		}

		get linkageKey() {
			return this.#params.linkageKey;
		}

		get options() {
			return this.#params.options;
		}

		get params() {
			return this.#params;
		}

		get properties() {
			return this.#params.properties;
		}

		get readyState() { 
		   	return (this.#webSocket||{}).readyState;
		}

		get reopenInterval() {
			return this.#params.reopenInterval||3000;
		}

		get resendInterval() {
			return this.#params.resendInterval||100;
		}

		get startTime() {
			return this.#startTime ? new Date(this.#startTime) : null;
		}

		get tags() {
			return arrify(this.#params.tags);
		}

		get timeout() {
			return this.#params.timeout||30000;
		}

		get url() {
			return this.#params.url;
		}

		get userid() {
			return this.#params.userid;
		}

		get version() {
			return VERSION + " (" + VERSION_DATE + ")";
		}

		addTag( tags ) {
			let count = 0;
			tags = arrify(tags);
			tags.forEach((tag) => { 
				this.tags.indexOf(tag) < 0 && ++count && this.tags.push(tag); 
			});
			count && this.#newMessageOut({ 
				type: MESSAGETYPE_ADDTAG,
				content: tags
			}).send();
			return this;
		}

		addFilterTag( tag ) {
			let count = 0;
			arrify(tag).forEach( (tag) => {
				if (this.#filterTags.indexOf( tag ) < 0) {
					this.#filterTags.push( tag );
					count++;
				}
			});
			count && this.#retrievePeers(() => {});
			return this;
		}

		close() {
			this.#state = "closing";
			this.#leave();
			this.#setEventHandlers(false);
			this.#webSocket.close(1000);
			this.#webSocket = undefined;
			this.#startTime = undefined;
			return this;
		}

		deboutSelection( selectionObject ) {
			// Selection object
			// 	{
			// 		client2hub: true,
			// 		hub2client: true,
			// 		terminate: true,
			// 		clientdebout: true,
			// 		connected: true
			// 	}
			this.#newMessageOut({ 
				type: MESSAGETYPE_DEBOUTSELECTION,
				content: selectionObject
			}).send();
			return this;
		}

		dispatchEvent(event) {
			NODE ? this.emit( event.type, event ) : super.dispatchEvent(event);
		}

		dispatchErrorEvent( code, message ) {
			const event = new EventEx("error");
			if (typeof code == "object") { // error object
				event.error = code;
			}
			else if (message) {
				event.error = new Error(message);
				event.error.code = code;
			}
			else {
				event.error = new Error(code);
			}
			this.dispatchEvent(event);
		}

		filter( callback ) {
			const result = [];
			for (let id in this.#peers) {
				if (callback( this.#peers[id])) {
					result.push( this.#peers[id]);
				}
			}			
			return result;
		}

		find( callback ) {
			for (let id in this.#peers) {
				if (callback( this.#peers[id])) {
					return this.#peers[id];
				}
			}			
			return;
		}

		forEachPeer( onEach ) {
			for (let id in this.#peers) {
				onEach( this.#peers[id] );
			}			
			return this;
		}

		newId() {
			return uniqueID();
		}

		newPeerEvent( type, peer ) {
			return new PeerEvent( type, peer );
		}

		notify(params) {
			/*
				notify(params)
				
				Params:
					peer: string|array[string]
					name: string
					content: object
			*/
			if (params.peer && params.content !== undefined) {
				this.#newMessageOut( {
					type: MESSAGETYPE_NOTIFY,
					peer: params.peer,
					name: params.name,
					content: params.content
				}).send();
			}
			return this;
		}

		off( type, handler ) {
			NODE ? this.removeListener( type, handler ) : this.removeEventListener( type, handler );
			return this;
		}

		on( type, handler ) {
			NODE ? super.on( type, handler ) : this.addEventListener( type, handler );
			return this;
		}

		once( type, handler ) {
			NODE ? super.once( type, handler ) : this.addEventListener( type, handler, { once: true });
			return this;
		}

		open() {
			if (this.linkageKey) {
				this.#setEventHandlers();
				this.#connect();
			}
			else {
				this.dispatchErrorEvent( "E_LINKAGEKEYNOTSPECIFIED" );
			}
			return this;
		}

		publish(params) {
			if (params.channel && params.message) {
				this.#newMessageOut({
					type: MESSAGETYPE_PUBLISH,
					content: {
						channel: params.channel,
						message: params.message,
						options: typeof params.options == "object" ? params.options : {}
					}
				}).send();
			}
			else {
				this.dispatchErrorEvent("E_PUBLISH_SYNTAXERROR");
			}
			return this;
		}

		removeFilterTag( tag ) {
			let count = 0;
			arrify(tag).forEach( (tag) => {
				const index = this.#filterTags.indexOf( tag );
				if (index >= 0) {
					this.#filterTags.splice( index, 1 );
					count++;
				}
			});
			count && this.#retrievePeers(() => {});
			return this;
		}

		removeTag( tags ) {
			let count = 0;
			tags = arrify(tags);
			tags.forEach((tag) => { 
				const index = this.tags.indexOf(tag);
				index >= 0 && ++count && this.tags.splice( index, 1 ); 
			});
			count && this.#newMessageOut({ 
				type: MESSAGETYPE_REMOVETAG,
				content: tags
			}).send();
			return this;
		}

		request(params) {
			/*
				request(params)

				Params:
					peer: string
					name: string
					content: object
					onResponse: function(messageIn)
					timeout: number, default 20000
			*/
			if (params.peer && params.content !== undefined && params.onResponse) {
				this.#newMessageOut({
					type: MESSAGETYPE_REQUEST,
					peer: params.peer,
					name: params.name,
					content: params.content
				}, params.onResponse, params.timeout ).send();
			}
			else {
				this.dispatchErrorEvent("E_REQUEST_SYNTAXERROR");
			}
			return this;
		}

		respond(params) {
			if (params.peer && params.content !== undefined && params.messageid) {
				this.#newMessageOut({
					type: MESSAGETYPE_RESPONSE,
					peer: params.peer,
					messageid: params.messageid,
					name: params.name,
					content: params.content
				}).send();
			}
		}

		setProperties( properties = {}) {
			Object.assign( this.properties, properties );
			this.#newMessageOut({ 
				type: MESSAGETYPE_SETPROPERTIES,
				content: properties 
			}).send();
			return this;
		}

		subscribe(params) {
			if (typeof params.channels == "string") {
				params.channels = params.channels.split(",");
			}
			if (Array.isArray(params.channels) && params.channels.length)  {
				const channels = [];
				params.channels.forEach(( channel ) => { 
					channel = channel.trim();
					if (this.#channels.indexOf(channel) < 0) {
						channels.push( channel );
						this.#channels.push(channel);
					}
				});
				channels.length && this.#newMessageOut({ 
					type: MESSAGETYPE_SUBSCRIBE,
					content: {
						channels: channels
					}
				}).send();
			}
			else if (!Array.isArray(params.channels)) {
				let message = "Invalid OkPeerConnection.subscribe() parameters: " + JSON.stringify(params);
				//this._log("SUBSCRIBE_SYNTAXERROR:" + message );
				this.dispatchErrorEvent( "E_SUBSCRIBE_SYNTAXERROR", message );
			}
			return this;
		}

		unsubscribe(params) {
			if (typeof params.channels == "string") {
				params.channels = params.channels.split(",");
			}
			if (Array.isArray(params.channels) && params.channels.length)  {
				const channels = [];
				params.channels.forEach(( channel ) => { 
					channel = channel.trim();
					const index = this.#channels.indexOf(channel);
					if (index >= 0) {
						channels.push(channel);
						this.#channels.splice(index,1);
					}
				});
				channels.length && this.#newMessageOut({ 
					type: MESSAGETYPE_UNSUBSCRIBE,
					content: {
						channels: params.channels
					}
				}).send();
			}
			else {
				this.dispatchErrorEvent("E_UNSUBSCRIBE_SYNTAXERROR");
			}
			return this;
		}

		_debout( message ) {
			this.#newMessageOut({ 
				type: MESSAGETYPE_DEBOUT,
				content: message 
			}).send();
			return this;
		}

		_getPeer( id ) {
			return this.#peers[id];
		}

		_send(params) {
			// params: { message: object }
			const _send = () => {
				try {
					this.#webSocket.send(JSON.stringify(params.message));
				}
				catch (error) {
					this.dispatchErrorEvent(error);
				}
			};
			if (this.#webSocket) {
				if (this.readyState == READYSTATE_OPEN) {
					_send();
				}
				else if (this.readyState == READYSTATE_CONNECTING) {
					const begin = Date.now();
					const timer = setInterval(() => {
						if (this.readyState == READYSTATE_OPEN) {
							clearInterval(timer);
							_send();
						}
						else if (Date.now() - begin > this.timeout) {
							clearInterval(timer);
							this.dispatchErrorEvent("E_CONNECTIONTIMEOUT");
						}
					}, this.resendInterval );
				}
			}
			else {
				this.dispatchErrorEvent("E_UNCONNECTED");
			}
		}

		get #awakeSentinelInterval() {
			if (!NODE) {
				return Math.ceil(this.#nudgeInterval / 2.5);// + 2000;
			}
			return 0;
		}

		get #awakeSentinelThreshold() {
			if (!NODE) {
				return (this.#nudgeInterval * 3) + 2000;
			}
			return 0;
		}

		get #nudgeStorageName() {
			return NUDGE_STORAGEPREFIX + this.id;
		}

		#compliesFilter(peer) {
			return this.#hasAllTags( peer, this.#filterTags );
		}

		#connect( force = false ) {
			if (force || this.#state == "closed") {
				this.#state = "opening";
				if (NODE) {
					try {
						const WebSocket = require("ws");
						this.#webSocket = new WebSocket(this.#preparedUrl());
						this.#webSocket.on( "open", () => { 
							this.#state = "opened";
							this.#startTime = Date.now();
							++this.#connectCount;
							this.dispatchEvent( new EventEx( "open" ));
							// if (this.#reconnectTimer) {
							// 	clearInterval( this.#reconnectTimer );
							// 	this.#reconnectTimer = undefined;
							// }
						});
						this.#webSocket.on( "error", (event) => { 
							this.#state = "closed";
							const error = event.error||event;
							if (error.message.indexOf("(404)")>0 || error.code == "ENOTFOUND") {
								this.__invalidSocket = true;
								this.dispatchErrorEvent( new Error(
									"E_NOTFOUND (Invalid WebSocket url '" + this.url + "')"
								));
							}
							else if (error.code == "ECONNREFUSED") {
								this.#reconnect();
							}
							else {
								this.dispatchErrorEvent( new Error(
									"E_PEERCONNECTION (Code: " + (error.code||0) + ")"
								));
							}
						});
						this.#webSocket.on( "message", ( data, flags ) => { 
							this.#handleIncomingMessage(data);
						});
						this.#webSocket.on( "close", ( code, reason ) => { 
							if (!this.__invalidSocket) {
								if (this.#state !== "closing" && code !== 1000) {
									this.#reconnect();
								}
								else {
									this.dispatchEvent( new EventEx( "close" ));					
								}
							}
							this.#state = "closed";
				 		});
					}
					catch (error) {
						console.log( "**** PeerHub Connection WebSocket failure ****");
						console.log( error );
						setTimeout( () => { this.dispatchErrorEvent(error); }, 1000 );
					}
				}
				else {  // browser side
					this.#webSocket = new WebSocket(this.#preparedUrl());
					this.#webSocket.onopen = () => { 
						this.#state = "opened";
						this.#startTime = Date.now();
						++this.#connectCount;
						this.dispatchEvent( new EventEx( "open" ));
						// if (this.#reconnectTimer) {
						// 	clearInterval( this.#reconnectTimer );
						// 	this.#reconnectTimer = undefined;
						// }
					};
					this.#webSocket.onerror = (event) => { 
						this.#state = "closed";
						if (event.code == "ECONNREFUSED") {
							this.#reconnect();
						}
						else {
							this.dispatchErrorEvent( new Error(
								"E_PEERCONNECTION (Code: " + (event.code||0) + ")"
							));
						}
					};
					this.#webSocket.onmessage = (event) => { 
						this.#handleIncomingMessage(event.data);
					};
					this.#webSocket.onclose = (event) => { 
						if (this.#state !== "closing" && event.code !== 1000) {
							this.#reconnect();
						}
						else {
							this.dispatchEvent( new EventEx( "close" ));					
						}
						this.#state = "closed";
			 		};
			 	}
			 }
		}

		#handleIncomingMessage(data) {
			try {
				data = JSON.parse(data);
				if (data.type == MESSAGETYPE_MESSAGE && this.#deboutChannel) {
					if (typeof data.content == "object" && data.content.channel == this.#deboutChannel) {
						event = new EventEx("debout");
						event.data = {
							time: data.content.time,
							message: data.content.message
						};
						this.dispatchEvent(event);
						return;
					}
				}
				this.#newMessageIn(data);
			}
			catch (error) {
				this.dispatchErrorEvent(error);
			}
		}

		#hasAllTags( peer, tags=[] ) {
			let i = 0;
			while (i < tags.length) {
				if (peer.tags.indexOf(tags[i++]) < 0) {
					return false;
				}
			}
			return true;
		}

		#initiate(id) {
			const content = {
				id: id, // undefined except when reconnecting
				deboutCluster: this.deboutCluster,
				userid: this.userid,
				options: this.options,
				properties: this.properties,
				linkageKey: this.linkageKey,
				startTime: this.#startTime,
				tags: this.tags
			};
			this.#debug && console.log("---- " + MESSAGETYPE_INITIATE + " ----");
			this.#debug && console.log(content);
			this.#newMessageOut({ type: MESSAGETYPE_INITIATE, content: content }).send();
		}

		#leave(params) {
			this.#debug && console.log("---- leave " + this.id + " ----");
			this.#webSocket.send(JSON.stringify({ type: MESSAGETYPE_LEAVE }));
		}

		#newMessageIn( message ) {
			return new MessageIn( this, message );
		}

		#newMessageOut( message, onResponse, responseTimeout ) {
			return new MessageOut( this, message, onResponse, responseTimeout );
		}

		#onAccept(event) {
			const content = event.message.content;
			if (this.#id) {
				// reconnecting, id is already known
				this.#initiate(this.#id);
			}
			else {
				this.#id = content.id;
				this.#initiate();
			}
			this.#deboutChannel = content.deboutChannel;
			this.options.deboutReceiver && this.#setDeboutReceiverStatus(true);
		}

		#onAlter(event) {
			this.#peerAlter(event.message.content);
		}

		#onConfirm(event) {
			this.#params.userid = event.message.content.userid; // userid as ecrypted string
			this.#retrievePeers(() => {});
		}

		#onLeave(event) {
			this.#peerRemove(event.message.content);
		}

		#onNudge(event) {
			if (!NODE) {
				const content = event.message.content;
				this.#nudgeInterval = content.interval;
				if (!this.#awakeSentinel) {
					this.#awakeSentinel = this.#startAwakeSentinel(); 
				}
				this.#nudgeTime = Date.now();
			}
		}

		#onPresence(event) {
			this.#peerAdd(event.message.content);
		}

		#peerAdd( peer, emitEddPeerEvent = true ) {
			if (this.#compliesFilter(peer)) {
				this.#peers[peer.id] = new Peer( this, peer );
				this.#debug && console.log("---- addpeer ----");
				this.#debug && console.log(this.#peers[peer.id]);
				emitEddPeerEvent && this.dispatchEvent( this.newPeerEvent( "addpeer", this.#peers[peer.id] ));
			}
		}

		#peerAlter( peer ) {
			this.#debug && console.log("---- alterpeer ----");
			this.#debug && console.log(peer);
			this.#peers[peer.id] && this.#peers[peer.id]._modify( peer );
			this.dispatchEvent( this.newPeerEvent( "alterpeer", this.#peers[peer.id] ));
		}

		#peerRemove( peer ) {
			this.#debug && console.log("---- removepeer ----");
			this.#debug && console.log(peer);
			this.#peers[peer.id] && delete this.#peers[peer.id];
			const temp = new Peer( this, peer );
			this.dispatchEvent( this.newPeerEvent( "removepeer", temp ));
		}

		#preparedUrl() {
			let url = this.url.replace("https:", "wss:").replace("http:", "ws:");
			if (!NODE && location.protocol=="https:") {
				url = url.replace( "ws:", "wss:" );
			}
			return url;
		}

		#reconnect() {
	        //this.#webSocket.removeAllEventListeners();
			setTimeout(() => { this.#connect(); }, this.reopenInterval );
			return this;
		}

		#retrievePeers( onReady = ()=>{} ) {
			const compare = ( peer1, peer2 ) => {
				return JSON.stringify([peer1.tags,peer1.properties]) 
					== JSON.stringify([peer2.tags,peer2.properties]);
			};
			this.#newMessageOut(
				{
					type: MESSAGETYPE_RETRIEVEPEERS,
					content: { linkageKey: this.linkageKey }
				}, 
				(message) => {
					const currentOnes = Object.assign( {}, this.#peers );
					this.#peers = {};
					message.content.peers.forEach((peer) => { 
						const exists = !!currentOnes[peer.id];
						this.#peerAdd( peer, !exists );
						if (exists && !compare( peer, currentOnes[peer.id] )) {
							const temp = new Peer( this, peer );
							this.dispatchEvent( this.newPeerEvent( "alterpeer", temp ));
							delete currentOnes[peer.id];
						}
					});
					Object.entries(currentOnes).forEach(([ id, peer ]) => {
						this.dispatchEvent( this.newPeerEvent( "removepeer", peer ));
					});
					onReady();
				}, 
				this.timeout 
			).send();
		}

		#setDeboutReceiverStatus(receiver) {
			receiver 
				? this.subscribe({ channels: [this.#deboutChannel] })
				: this.unsubscribe({ channels: [this.#deboutChannel] });
		}

		#setEventHandlers( on = true ) {

			const onAccept = (event) => { this.#onAccept(event);};
			const onConfirm = (event) => { this.#onConfirm(event);};
			const onLeave = (event) => { this.#onLeave(event);};
			const onNudge = (event) => { this.#onNudge(event);};
			const onAlter = (event) => { this.#onAlter(event);};
			const onPresence = (event) => { this.#onPresence(event);};

			if (on && !this.#eventHandlersSet) {
				this.on( MESSAGETYPE_ACCEPT, onAccept );
				this.on( MESSAGETYPE_ALTER, onAlter );
				this.on( MESSAGETYPE_CONFIRM, onConfirm );
				this.on( MESSAGETYPE_LEAVE, onLeave );
				this.on( MESSAGETYPE_NUDGE, onNudge );
				this.on( MESSAGETYPE_PRESENCE, onPresence );
				this.#eventHandlersSet = true;
			}
			if (!on && this.#eventHandlersSet) {
				this.off( MESSAGETYPE_ACCEPT, onAccept );
				this.off( MESSAGETYPE_ALTER, onAlter );
				this.off( MESSAGETYPE_CONFIRM, onConfirm );
				this.off( MESSAGETYPE_LEAVE, onLeave );
				this.off( MESSAGETYPE_NUDGE, onNudge );
				this.off( MESSAGETYPE_PRESENCE, onPresence );
				this.#eventHandlersSet = false;
			}
		}

		#startAwakeSentinel() {
			if (!NODE) {
				return setInterval(() => {
					if (this.#nudgeTime 
						&& this.readyState !== READYSTATE_OPEN 
						&& this.readyState !== READYSTATE_CONNECTING 
						&& Date.now() - this.#nudgeTime > this.#awakeSentinelThreshold
					) {
						console.log( "OkPeerConnection reconnecting after awakening" );
						if (!NODE) {
							this.dispatchEvent( new EventEx("awakening"));
						}
						this.#connect(true);
					}
				}, this.#awakeSentinelInterval );
			}
		}

		#validateParameters() {
			this.#params.options = this.#params.options||{};
			this.options.deboutReceiver = this.options.deboutReceiver ?? false;
			this.options.peerInitiationReceiver = this.options.peerInitiationReceiver ?? true;
			this.options.peerInitiationSender = this.options.peerInitiationSender ?? true;
			this.#params.tags = this.#params.tags||[];
			this.#params.userid = this.#params.userid||"";
			this.#params.properties = this.#params.properties||{};
			// If id is undefined, it is provided by PeerServer and is valid 
			// only for the existence of the peer object.
			this.#id = this.#params.id;
		}
	}

	class NodeEvent {
		#type;
		constructor(type) {
			this.#type = type;
		}

		get type() {
			return this.#type;
		}
	}

	class EventEx extends (NODE ? NodeEvent : Event) {
		constructor(type) {
			super(type);
		}
	}

	class PeerEvent extends EventEx {
		#peer;
		constructor( type, peer ) {
			if (typeof type == "string") {
				super(type);	
			}
			else if (typeof type == "object") {
				super(type.type);
				peer = peer||type.peer;
			}
			else {
				throw new Error("E_SYNTAX: Invalid first parameter when initializing PeerEvent.");
			}
			this.#peer = peer;
		}

		get peer() {
			return this.#peer;
		}

		set peer(peer) {
			this.#peer = peer;
			return this.#peer;
		}
	}

	class Message {
		#peerConnection;
		#data = {};
		constructor( peerConnection, message ) {
			this.#peerConnection = peerConnection;
			message && (this.#data = message);
		}

		get content() {
			return this.#data.content;
		}

		get data() {
			return this.#data;
		}

		get id() {
			return this.#data.messageid;
		}

		get message() {  // for compatibility with older versions
			return this.#data;
		}

		get name() {
			return this.#data.name;
		}

		get peer() {
			return typeof this.#data.peer == "string" 
				? this.peerConnection._getPeer(this.#data.peer) 
				: this.#data.peer;
		}

		get peerConnection() {
			return this.#peerConnection;
		}

		get time() {
			return new Date( this.timeAsMilliseconds );
		}

		get timeAsMilliseconds() {
			return parseInt( this.id.substr(8), 36 );
		}

		get type() {
			return this.#data.type;
		}
	}

	class MessageIn extends Message {
		constructor( peerConnection, message ) {
			super( peerConnection, message );
			let requestMassage
			if (this.type == MESSAGETYPE_RESPONSE) {
				requestMassage = REQUEST_MESSAGES.get(this);
				requestMassage && requestMassage.conveyResponse(this);
			}
			if (!requestMassage) {
				const event = new EventEx(this.type);
				event.message = this;
				this.peerConnection.dispatchEvent(event);
			}
		}

		respond( messageContent ) {
			if (this.type == MESSAGETYPE_REQUEST) {
				if (this.peer) {
					this.peerConnection.respond({
						name: this.name,
						messageid: this.id,
						peer: this.peer.id,
						content: messageContent
					});
				}
				else {
					this.peerConnection.dispatchErrorEvent("E_NOPEER_ON_REQUEST");
				}
			}
		}
	}

	class MessageOut extends Message {
		constructor( peerConnection, message, onResponse, responseTimeout ) {
			super( peerConnection, message );
			// Message with the type 'response' should already have a messageid
			this.message.messageid = this.message.messageid||uniqueID();
			onResponse && REQUEST_MESSAGES.add( this, onResponse, responseTimeout );
		}

		conveyResponse( responseMessageIn ) {
			if (this.onResponse) {
				this.onResponse( responseMessageIn );
			}
			else {
				this.peerConnection.dispatchErrorEvent( "E_MISSING_ONRESPONSE");
			}
		}

		send() {
			this.peerConnection._send({ message: this.message });
		}
	}

	class Peer {
		#params;
		#connection;
		constructor( connection, params ) {
			this.#connection = connection;
			this.#params = params;
		}

		get connection() {
			return this.#connection;
		}

		get id() {
			return this.#params.id;
		}

		get linkageKey() {
			return this.#params.linkageKey;
		}

		get properties() {
			return this.#params.properties;
		}

		get startTime() {
			// return this.id ? (new Date( parseInt( this.id.split("-")[1], 36 ))) : undefined;
			return new Date(this.#params.startTime);
		}

		get tags() {
			return arrify(this.#params.tags);
		}

		get userid() {
			return this.#params.userid;
		}

		hasAllTags( tags = [] ) {
			const length = tags.length;
			let i = 0;
			while (i < length) {
				if (this.tags.indexOf(tags[i++]) < 0) {
					return false;
				}
			}
			return true;
		}
		
		hasAnyTag( tags = [] ) {
			const length = tags.length;
			let i = 0;
			while (i < length) {
				if (this.tags.indexOf(tags[i++]) >= 0) {
					return true;
				}
			}
			return false;
		}

		hasTag(tag) {
			return this.tags.indexOf(tag) >= 0;
		}

		notify(params) {
			this.#connection.notify( Object.assign( params, { peer: this.id }));
			return this;
		}

		request(params) {
			this.#connection.request( Object.assign( params, { peer: this.id }));
			return this;
		}

		_modify( params = {}) {
			Object.assign( this.#params, params );
			return this;
		}
	}

	class RequestMassageQueue {
		#queue = {};
		constructor() {
		}

		add( requestMessage, onResponse, responseTimeout ) {
			this.#queue[requestMessage.id] = requestMessage;
			requestMessage._onResponse = onResponse;
			requestMessage.onResponse = (responseMessageIn) => { 
				requestMessage._onResponse(responseMessageIn);
				this.#remove( requestMessage );
			};
			requestMessage.timer = setTimeout(() => { 
				this.#remove( requestMessage );
				requestMessage.peerConnection.dispatchErrorEvent( 
					"E_REQUESTTIMEOUT: "
						+ "Request name '" + (requestMessage.name||"UNKNOWN") + "', "
						+ " id: " + requestMessage.messageid + ", "
						+ " peer: " + requestMessage.peer
				);
			}, responseTimeout||DEFAULT_REQUESTTIMEOUT );
		}

		get( responseMessage ) {
			return this.#queue[responseMessage.id];
		}

		#remove( requestMessage ) {
			if (requestMessage.timer) {
				clearTimeout(requestMessage.timer); 
				requestMessage.timer = undefined;
				this.#queue[requestMessage.id] && delete this.#queue[requestMessage.id];
			}
		}
	}

	REQUEST_MESSAGES = new RequestMassageQueue();

	if (NODE) {
		module.exports = OkPeerConnection;
	}
	else {
		window.OkPeerConnection = OkPeerConnection;
	} 

	// ---------------------------------------------------------------------------------------------

	function uniqueID() {
		const time = new Date().getTime().toString(36);
		const length = 15 - time.length;
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
		let id = chars[ Math.floor( Math.random() * 26 )] + Math.random().toString(36).split(".")[1];
		while (id.length < length) {
		 	id += chars[ Math.floor( Math.random() * 36 )];
		}
		return id.substr(0,length) + "-" + time;
	}

	function arrify(p) {
		return Array.isArray(p) ? p : (p == undefined ? [] : [p]);
	}

})();
