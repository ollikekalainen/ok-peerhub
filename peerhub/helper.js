class Helper {

	arrify(p) {
		return Array.isArray(p) ? p : (p == undefined ? [] : [p]);
	}

	fileExists( filename ) {
		try {
			require("fs").statSync( filename );
		} 
		catch (e) {
			return false;
		}
		return true;
	}

	fileRead( onError, onSuccess, filename ) {
		const fs = require( "fs" );
		if (this.fileExists(filename)) {
			fs.readFile( filename, null, ( error, data ) => {
				if (error) {
					onError( new Error( "E_READFILE: Failed to read file '"
						+ filename + "' (" + error.message + ")"));
				}
				else {
					onSuccess( data.toString() );
				}
			});
		}
		else {
			onError( new Error( "E_NOTFOUND: File '" + filename + "' does not found."));
		}
	}

	getRemoteAddress(request) {
		const ip =  request.connection.remoteAddress || 
		     request.socket.remoteAddress ||
	    	 (request.connection.socket ? request.connection.socket.remoteAddress : "");
		return ip == "::1" ? "127.0.0.1" : ip.split(":").pop();
	}

	hexToString(hex) {
		hex = hex.toString();
		let str = "";
		for (let i = 0; i < hex.length; i += 2) {
			str += String.fromCharCode(parseInt( hex.substr(i, 2), 16 ));
		}
		return str;
	}

	stringToHex(str) {
		let hex = "";
		for (let i=0;i<str.length;i++) {
			hex += ''+str.charCodeAt(i).toString(16);
		}
		return hex;
	}

	uniqueID() {
		const time = new Date().getTime().toString(36);
		const length = 15 - time.length;
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
		let id = chars[ Math.floor( Math.random() * 26 )] + Math.random().toString(36).split(".")[1];
		while (id.length < length) {
		 	id += chars[ Math.floor( Math.random() * 36 )];
		}
		return id.substr(0,length) + "-" + time;
	}
}

module.exports = new Helper();