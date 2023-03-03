const crypto = require("crypto");
const bytesToKey = require("./bytesToKey");

let crypting;

class Crypting {
	#KEYS = {};
	encrypt( text, key ) {
		// http://lollyrock.com/articles/nodejs-encryption/
		// https://github.com/chris-rock/node-crypto-examples
		const algorithm = "aes-256-ctr";
		const p = this.solveCipher( algorithm, key );
		const cipher = crypto.createCipheriv( algorithm, p.key, p.iv );
		let crypted = cipher.update( text, "utf8", "base64" );
		crypted += cipher.final( "base64" );
		return crypted;
	}

	decrypt( text, key ){
		const algorithm = "aes-256-ctr";
		const p = this.solveCipher( algorithm, key );
		const decipher = crypto.createDecipheriv( algorithm, p.key, p.iv );
		let decrypted = decipher.update( text, "base64", "utf8" );
		decrypted += decipher.final( "utf8" );
		return decrypted;
	}

	solveCipher( algorithm, key ) {
		if (!this.#KEYS[key]) {
			const p = bytesToKey( algorithm, key );
			this.#KEYS[key] = {
		  		key: Buffer.from( p.key, 'hex' ),
				iv: Buffer.from( p.iv, 'hex')
			};
		}
		return this.#KEYS[key];
	}

}

crypting = crypting || new Crypting();

module.exports = crypting;



