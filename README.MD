<br>
<br>

---


# ok-peerhub

**ok-peerhub** is a websocket-implemented peer-to-peer extension for Node web servers. It comprises
the actual peer hub service and a browser-side peer connection object, providing a way for peers 
to communicate through the peer hub. 

Browser-side peers can send each other three types of messages.
They can send *notification* messages to one or more specific peers. They can *publish* a message
on a channel that will be received only by the peers subscribing that channel. Peers can
also send each other *request* messages to which the receiving peer reacts by sending a response.

Module [ok&#8209;peerserver](https://github.com/ollikekalainen/ok-peerserver), 
which is based on [ok&#8209;server](https://github.com/ollikekalainen/ok-server), provides
example of starting to use OkPeerHub services on the server side.

<br>
<br>

<a name="table-of-contents"></a>
## Table of contents

* [Installation](#installation)
* [Reference](#reference)
	* [OkPeerHub](#reference-okpeerhub)
		* [Initialization](#reference-okpeerhub-initialization)
		* [Initialization options](#reference-okpeerhub-initializationoptions)
		* [Properties](#reference-okpeerhub-properties)
		* [Methods](#reference-okpeerhub-methods)
	* [OkPeerConnection](#reference-okpeerconnection)
		* [Initialization in Node application](#reference-okpeerconnection-initializationinnode)
		* [Initialization on browserside](#reference-okpeerconnection-initializationonbrowserside)
		* [Initialization options](#reference-okpeerconnection-initializationoptions)
		* [Properties](#reference-okpeerconnection-properties)
		* [Methods](#reference-okpeerconnection-methods)
		* [Connection steps](#reference-okpeerconnection-connectionsteps)
		* [Events](#reference-okpeerconnection-events)
	* [Peer](#reference-peer)
		* [Properties](#reference-peer-properties)
		* [Methods](#reference-peer-methods)
	* [MessageIn](#reference-messagein)
		* [Properties](#reference-messagein-properties)
		* [Methods](#reference-messagein-methods)


<br>
<br>

---

<a name="installation"></a>
## Installation

npm install ok-peerhub


<br>

---

<a name="reference"></a>
## Reference


<a name="reference-okpeerhub"></a>
### OkPeerHub

<a name="reference-okpeerhub-initialization"></a>
#### Initialization

```javascript
  
    const OkPeerHub = require("ok-peerhub");
    const peerHub = new OkPeerHub({
        httpServer: server.httpServer,
        deboutEnabled: true,
        encryptionKey: "ae5fd450eccb85fac9045bedd433"
    });
               
```

The [ok&#8209;peerserver](https://github.com/ollikekalainen/ok-peerserver/blob/main/ok-peerserver.js)
repository (see the *#initPeerHub* method) contains an example of initalizing the OkPeerHub.

<br><a name="reference-okpeerhub-initializationoptions"></a>

---
#### Initialization options
- deboutEnabled *boolean* - A *boolean* value indicating whether the debug messaging is enabled. The default value is *false*.
- encryptionKey *string* - An encryption key as a *string* value that is used to encrypt the user ID passed to peer on initialization.
- httpServer *HttpServer*|*HttpsServer* . The HTTP server that OkPeerHub uses in websocket traffic.
- nudgeInterval *number* - A *number* value as milliseconds that indicate the time interval in which the Peerhub service sends nudge messages to peers. The default value is 10000.
- pingInterval *number* - A *number* value as milliseconds indicating the time interval in which the PeerHub send ping messages to peers. The default value is 10000.
<br><a name="reference-okpeerhub-properties"></a>

---
#### Properties

PeerHub has following properties that are identical with the options with the same name. Their value may be changed after the start of the service.

- deboutEnabled *boolean*
- nudgeInterval *number*
- pingInterval *number*

<br><a name="reference-okpeerhub-methods"></a>

---
#### Methods

- **getPeerConnectionSource( onError, onSuccess, minimized )** - A method that retrieves the JavasSript source code for OkPeerConnection. 
This method is needed to get the source code to the browser side. The module 
[ok&#8209;peerserver](https://github.com/ollikekalainen/ok-peerserver/blob/main/ok-peerserver.js) 
(see the *#extendApi* method) contains an example of using this method
in implementing the necessary API service to get the code to the browser.
	- onError 	function(error) - A callback function that is executed in the event of an error.
		- error 	*Error* - An *Error* object that indicates an error that occurred during operation.

	- onSuccess	function(content) - A callback function that is executed after reading the JavaScript source file.
		- content 	*string* - The content of the OkPeerConnection.js file as a *string* value.

	- minimized	*boolean*	- A *boolean* value indicating whether the value of the onSuccess function's content parameter is minimized code. The default value is *true*.

\
<br><a name="reference-okpeerconnection"></a>

---
### OkPeerConnection

OkPeerConnection can be used both in the Node application and on the browser side.

<br><a name="reference-okpeerconnection-initializationinnode"></a>

---
#### Initialization in Node application

In the **Node client**, a peer connection is created by instantiating a new OkPeerConnection object as follows.

```javascript
	
    const OkPeerConnection = require("ok-peerhub").OkPeerConnection;
    const connection = new OkPeerConnection(params);

```

<br><a name="reference-okpeerconnection-initializationonbrowserside"></a>

---
#### Initialization on browser side

On the browser side, the OkPeerConnection instance is created as follows.

```javascript

    const connection = new OkPeerConnection(params);

```

The JavaScript source (OkPeerConnection.js) is available with the getPeerConnectionSource() method, 
for example by implementing the necessary API function using that method.
An example of the implementation can be found in 
[ok&#8209;peerserver](https://github.com/ollikekalainen/ok-peerserver/blob/main/ok-peerserver.js). 
On the browser side, the API function according to the example can be easily called with the following 
[JavaScript code](https://github.com/ollikekalainen/ok-peerhub/blob/main/browserside/loadOkPeerConnection.js).

On the other hand, the JavaScript source code file can be just copied for use on the browser side 
appliation as minimized (ok&#8209;peerconnection.min.js) or full version (ok&#8209;peerconnection.js).


<br><a name="reference-okpeerconnection-initializationoptions"></a>

---
#### Initialization options

- **deboutCluster** *string* - An unique identifier that identifies partners as belonging 
to the same client application's debug message receiving list.

- **id** *string* - An unique identifier string for the connection. If id is not passed, it is provided by 
PeerHub and is valid only for the existence of the peer object.

- **linkageKey** *string* - an unique identifier string that determines which of peers using the peerhub are connected to each other.
This parameter must be passed.

- **options** *object*
	- deboutReceiver *boolean* - Indicates whether the peer receives debug messages. The default value is *false*.
	- peerInitiationReceiver *boolean* - Indicates whether the peer receives initiation messages. 
	In order to receive messages from other peers, the peer must also be the initiation message receiver in addition to having a common linkageKey.
	The default value is *true*.
	- peerInitiationSender *boolean* - If this setting is false, peerHub will not send peer 
	*alter*, *leave*, and *presence* messages to other peers. The default value is *true*.

- **properties** *object* - Peer optional properties related to the operation of the client application. 
The default value is {}. The peer properties are set using the **setProperties()** method.
The properties of other peers are available through the **Peer.properties** property. 

- **reopenInterval** *number* - The time interval in milliseconds after which OkPeerConnection tries 
to re-establish a broken connection until the connection is established or the timeout is reached. 
The default value is 3000.

- **resendInterval** *number* - Time interval in milliseconds during which the peer tries to resend 
the message if the connection has not yet been opened. Sending a message will be attempted until 
the connection is opened or a timeout is reached. The default value is 100.

- **tags** *array* - Peers can be assigned one or more tags, based on which they can be categorized. 
After opening the connection, tags can later be added with the method addTag() and removed with the method removeTag(). 
To support categorization with tags, the class *Peer* has three methods: hasTag(), hasAllTags(), 
and hasAnyTags().

- **timeout** *number* - The connection timeout in milliseconds. The default value is 30000.

- **url** *string* - The network address of the server providing okPeerHub services, 
i.e. the address to which the connection is being created.

- **userid** *string* - User ID that identifies the user of the client application as one of the peers.
It is needed because the peer's ID may change every time the application is restarted.
This happens when OkPeerConnection is allowed to create a Peer ID. For example, 
the user's e-mail address can be used as an ID. PeerHub encrypts the username, so it is
not visible in an understandable form to other peers.

<br><a name="reference-okpeerconnection-properties"></a>

---
#### Properties


- **deboutCluster**  *string* (readonly) - An unique identifier of the deboutCluster as a *string*
 
- **deboutReceiver**  *boolean* - A *boolean* value indicating whether the peer receives debug messages.

- **filterTags**  *array* (readonly) - The filter tags assigned to the connection with the method addFilterTag().
 
- **id** *string* (readonly) - The id as a string value assigned to the connection.

- **linkageKey**  *string* (readonly) - The linkage key of the connection as it is visible to other peers.
 
- **properties**  *object* (readonly) - The properties object of the connection as it is visible to other peers.
 
- **reopenInterval**  *string* (readonly) - Re-open interval of the connection as milliseconds.
 
- **resendInterval**  *number* (readonly) - Re-send interval of the connection as milliseconds.
 
- **startTime**  *Date* (readonly) - The time when the connection has been established as a *Date* value. Returns null value if the connection is not ready.
 
- **tags**  *array* (readonly) - The tags assigned to the connection as they are visible to other peers.
 
- **timeout**  *number* (readonly) - The connection timeout.
 
- **userid**  *string* (readonly) - An optional userid (for example e-mail address) assigned to the connection.
 
<br><a name="reference-okpeerconnection-methods"></a>

---
#### Methods

-	**addFilterTag( tag )** - Adds filter tags to okPeerConnection to filter the peers to be accepted into its peer collection.
	To be accepted into the collection, a peer must have all the tags added as filter tags 
	in the okPeerConnection.
	
	- tag  *string*|*array* - A single tag as *string* or multiple tags as *array* of *string* values.
<br>
	
-	**addTag( tag )** - Adds a new tag to the connection. Returns the *OkPeerConnection* object.
	A message sent with this method call triggers a *alterpeer* event on the peers that received the message.
	
	- tag  *string*|*array* - A single tag as *string* or multiple tags as *array* of *string* values.
<br>

-	**deboutSelection( selection )** - Sends a selection object to the PeerHub being used
	to filter different types of debout messages. This triggers a *alterpeer* event on the peers 
	that received the message. The *boolean* value of any selection object indicates whether 
	debout messages for the corresponding message type are transmitted to the peer.

	- selection  *object*
		- client2hub *boolean* - A boolean value for the selection of messages from *peers to PeerHub*.
		- hub2client *boolean* - A boolean value for the selection of messages from *PeerHub to peers*.
		- terminate *boolean* - A boolean value for the selection of *terminate* messages.
		- clientdebout *boolean* - A boolean value for the selection of *debout* messages sent by peers.
		- connected *boolean* - A boolean value for the selection of peer *connected* messages.
<br>

-	**filter( callback )** - The filter() method returns an array of peers, filtered down to just the peers 
	that pass the test implemented by the provided callback function.
	
	- callback  *function( Peer )* - A function to execute for each peer, passed as a *Peer* object as its only parameter. It should return a 
	*boolean* value to indicate a matching peer has been found.
<br>

-	**find( callback )** - The find() method returns the first peer in the that satisfies the provided 
	testing function. If no values satisfy the testing function, undefined is returned.

	- callback  *function( Peer )* - A function to execute for each peer, passed as a *Peer* object as its only parameter. It should return a 
	*boolean* value to indicate a matching peer has been found.
<br>

-	**forEachPeer( callback )** - Executes a callback function for every.
	- callback  *function( Peer )* - A function to execute for each peer, passed as a *Peer* object as its only parameter.
<br>

-	**newId()** - Returns a unique 16-byte ID *as a string*. It is a two-part string value containing 
	letters a-z and numbers, separated by a hyphen. The first part is completely random and the second 
	is built from the current time (new Date().getTime().toString(36)). The created ID starts always 
	with a letter.
<br>

-	**newPeerEvent( event[, peer] )** - Returns a new instance of *PeerEvent*. Can be used to convert
	message events into the PeerEvent on handling  addpeer, alterpeer, and removepeer events.

	- event *PeerEvent*|*Event*|*string* - If the first parameter is not *PeerEvent*, the
	second parameter has to a *Peer* object.
	- peer 	*Peer* - *Peer* object

	*Example:*
```javascript

    app.peerConnection.on( "addpeer", (event) => { 
        app.meeting.emit( app.peerConnection.newPeerEvent( event ));
    });

```
<br>

-	**notify( params )** - Sends a notify message to a peer of array of peers. This message 
	triggers a *notify* event on the peers that received the message.
	Returns the *OkPeerConnection* object.

	- params *object*
		- peer *string*	- The ID of the peer to which the message is sent as a *string* value.
		- name *string* - The name of the notification message as a *string* value.
		- content *object* - Content of the named notify message as an indeterminate *object*.
<br>

-	**off( type, eventHandler )** - Removes an event listener previously registered with **on()** method.
	Returns the *OkPeerConnection* object.

	- type  *string*	- The event type as a *string* value. 
	- eventHandler *function* - The event handler function.
<br>

-	**on( type, eventHandler )** - Sets up a function that will be called whenever the specified event is delivered to the target.
	Returns the *OkPeerConnection* object.

	- type  *string*	- The event type as a *string* value. 
	- eventHandler *function* - The event handler function.
<br>

-	**once( type, eventHandler )** - Sets up a function that will be called the specified event is 
	delivered to the target for the first time, after which the function is automatically removed.
	Returns the *OkPeerConnection* object.

	- type  *string*	- The event type as a *string* value. 
	- eventHandler *function* - The event handler function.
<br>

-	**open()** - Opens the OkPeerConnection object's connection.
	Returns the *OkPeerConnection* object.
<br>

-	**publish(params)** - Publishes a message on the specified channel, to all peers who have subscribed to the channel.
	This message triggers a *message* event on the peers that received the message.
	Returns the *OkPeerConnection* object.

	- params *object*
		- channel *string* - The channel as a *string* to which the message will be posted.
		- message *string*|*object*|*number*|*array* - The message as *string*, *object*, *number*, or *array*.
		- options *object* - An indetermined *object* value for extension purposes.
<br>

-	**removeFilterTag( tag )** - Removes a filter tag previously added with the addFilterTag() method.
	Returns the *OkPeerConnection* object.

	- tag *string|array[string]* - The name of the filter tag as a *string* or an array of string.
<br>

-	**removeTag( tag )** - Removes a tag previously added with the addTag() method.
	A message sent with this method call triggers a *alterpeer* event on the peers that received the message.
	Returns the *OkPeerConnection* object. - The name of the tag as a *string* or an array of string.

	- tag *string|array[string]*
<br>

-	**request( params )** - Sends a request message to a peer of array of peers.
	This message triggers a *request* event on the peers that received the message.
	Returns the *OkPeerConnection* object.

	- params *object*
		- peer *string*	- The ID of the peer to which the message is sent as a *string* value.
		- name *string*	- The request message name as a *string* value.
		- content *object* - Content of the named request message as an indeterminate *object*.
		- onResponse *function(messageIn)* - A callback function called when the response has been arrived from the peer.
		- timeout *number* - Timeout *as a number* in milliseconds, how long to wait for a response to the query. Default value is 20000.
<br>
	

-	**setProperties( properties )** - Adds or modifies one ore more properties of the peer.
	The message sent with this method call triggers a *alterpeer* event on the peers that received the message.
	Returns the *OkPeerConnection* object.

	- properties *object* - { property(1): value, property(2): value, ..., property(n): value }
<br>

-	**subscribe( params )** - Subcribes message channel or channels to which messages are sent with publish method by other peers or.
	Returns the *OkPeerConnection* object.

	- params *object*
		- channels *array*|*string* - An array of channel names or *string* value containing a comma-separated list of channel names.
<br>

-	**unsubscribe( params )** - Unsubcribes channels subscribed wit subscribe() method.
	Returns the *OkPeerConnection* object.

	- params *object*
		- channels *array*|*string* - An array of channel names or *string* value containing a comma-separated list of channel names.

<br><a name="reference-okpeerconnection-connectionsteps"></a>

---
#### Connection steps

1) Application instantiates OkPeerConnection object
- by passing the linkageKey for the linking of peers
- by setting handlers for the OkPeerConnection events
- by opening the connection with open method

2) PeerHub receives the websocket connection request and sends to the peer an **accept** message which contains ID key for the peer.

3) PeerConnction recives the **accept** message and brings in the use the peer ID included in the message

4) OkPeerConnection sends an **initiatate** message to the PeerHub. The message contains 
- id as unique string when it is passed as an option on initalizing OkPeerConnection, otherwise id is left undefined
- linkageKey
- optional userid (for example email address),
- connection options
- peer properties
- peer tags
- deboutCluster ID
- startTime

5) PeerHub receives the *initiatate* message and 
- Sends an **confirm** message to the OkPeerConnection containing the userid sent by Peerconnection as an encrypted string
- Sends an **presence** message for every peer having the same linkageKey as OkPeerConnection. This message contains following properties of the OkPeerConnection object:
	- id as string
	- deboutCluster as boolean
	- userid as encrypted string
	- linkageKey as string
	- tags as string array
	- properties as object
	- remoteAddress as string
6) OkPeerConnection receives **confirm** message and is ready to operate
7) Every peer linked to the OkPeerConnection with the linkageKey receives **precense** message and adds
an new Peer object to it's OkPeerConnection object's peers collection.

<br><a name="reference-okpeerconnection-events"></a>

---
#### Events


##### addpeer

The **addpeer** event is emitted when OkPeerConnection object  receives the *addpeer* message 
from PeerHub when another peer has connected to PeerHub. The event has a *peer* property 
whose value is the *Peer* object just added to the OkPeerConnection peer collection.
<br>

##### alterpeer

The **alterpeer** event is emitted when OkPeerConnection object  receives the *alterpeer* message 
from PeerHub when another peer's properties, tags, and/or deboutSelection has changed. The event has a *peer* property 
whose value is the *Peer* object just changed in the OkPeerConnection peer collection.
<br>


##### awakening

The **awakening** event is emitted when OkPeerConnection re-connects after awakening of the browser.
This event is triggered only on the browser side.
<br>


##### close

The **close** event is emitted when OkPeerConnection connection is closed.
<br>

##### debout

The **debout** event is emitted when it receives the debug message from PeerHub or another peer.
The event has a *data* property that contains an object with following properties.
- time *number* - Message sending time as *number* (Date object converted to milliseconds).
- message *string* - The actual debug message.

##### error

The **error** event is emitted on error situations.
The event has an *error* property whose value is set to an *Error* object.
<br>


##### message

The **message** event is emitted when it receives the *message* message sent to any channel 
from PeerHub after a peer is published it.
The event has a *message* property that contains a *MessageIn* object. Its **content** property object has the following properties.
- **channel** *string* - A *string* value indicating the name of the channel on which the message was sent.
- **message** *string*|*number*|*object*|*array*|*boolean* - The actual message.
- **options** *object* - Optional properties to use to extend this message type.


##### notify

The **notify** event is emitted when OkPeerConnection object receives an *notify* message from another peer.
The event has a *message* property that contains a *MessageIn* object. Its **content** property object varies from message to message, depending on the behavior of the application.
<br>

##### open

The **open** event is emitted when OkPeerConnection is successfully connected to PeerHub.
<br>


##### removepeer
The **removepeer** event is emitted when OkPeerConnection object  receives the *removepeer* message 
from PeerHub when another peer is removed. The event has a *peer* property whose value is 
the *Peer* object just removed from the OkPeerConnection peer collection.
<br>

##### request

The **request** event is emitted when OkPeerConnection object receives an *request* message from another peer.
After received the request message, peer should send a response to it by using message's respond method.
The event has a *message* property that contains a *MessageIn* object. Its **content** property object varies from message to message, depending on the behavior of the application.

The request message also has the following method by which the peer responds to the request message sent by the other peer.
- *respond( content )* 
	- content *boolean*|*number*|*object*|*string* - The value assigned to the *content* property of the response message.
<br>
<a name="reference-peer"></a>

---
### Peer

A class representing the peers linked to the OkPeerConnection.
Peer objects are accessible through the OkPeerConnection methods filter(), find(), and forEachPeer().

<br><a name="reference-peer-properties"></a>

---
#### Properties

- **id** *string* (readonly) - The unique ID as string value. Set at initialization of 
the OkPeerConnection.
- **properties** *object* (readonly) - The properties of peer as a object value. Set at the 
initialization of the OkPeerConnection and/or with OkPeerConnection.setProperties() method.
- **startTime** *Date* (readonly)
- **userid** *string* (readonly)
- **tags** *array* (readonly) - The tags of peer as a array. Set at the initialization of 
the OkPeerConnection and/or with OkPeerConnection.addTag() method.


<br><a name="reference-peer-methods"></a>

---
#### Methods

- **hasAllTags(tags)** - Returns a boolean value indicating whether the peer has all of the tags passed as an array parameter.

- **hasAnyTags(tags)** - Returns a boolean value indicating whether the peer has any of the tags passed as an array parameter.

- **hasTag(tag)** - Returns a boolean value indicating whether the peer has the tag passed as an string parameter.

- **notify(params)** - Sends a notification message to the peer. Syntax is same as
OkPeerConnection.notify() method except the peer property is not needed. Returns self.

- **request(params)** - Sends a request message to the peer. Syntax is same as
OkPeerConnection.request() method except the peer property is not needed. Returns self.


<br><a name="reference-messagein"></a>

---
### MessageIn


<a name="reference-messagein-properties"></a>
#### Properties

- **content** *object* (readonly) - The actual content object of the message the OkPeerConnection has received. Content object varies from the message to message.

- **data** *object* (readonly). - The actual message data that the OkPeerConnection has received.

- **id** *string* (readonly) - The unique id of the message as a *string* value.

- **name** *string* (readonly) - The optional name of the message as a *string* value.

- **peer** *Peer* (readonly) - The object value indicating the peer which is the origin of the message.

- **time** *Date* (readonly) - A *Date* value that indicates the time the message was sent.

- **timeAsMilliseconds** *number* (readonly) - A *number* value indicating the time the message was sent in milliseconds since January 1, 1970 00:00:00.

- **type** *string* (readonly) - The type name of the message as a *string* value. For example: notify, request, message

<br><a name="reference-messagein-methods"></a>

---
#### Methods

- **respond( content )** - Using this method - which is only available with a request message - the peer responds to the request message sent by the other peer.
	- content *boolean*|*number*|*object*|*string* - The value assigned to the *content* property of the response message.

Example:
```javascript

    app.peerConnection.on( "request", (event) => { 
        event.message.name == "getstate" 
        && event.message.respond({ state: "OK", remarks: "Everything is just fine" });
    });

```
