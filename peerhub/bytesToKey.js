module.exports = bytesToKey;

function bytesToKey( cipher, passphrase ) {
	// Modified from https://gist.github.com/bnoordhuis/2de2766d3d3a47ebe41aaaec7e8b14df#file-bytestokey-js
	// Copyright (c) 2017, Ben Noordhuis <info@bnoordhuis.nl>
	//
	// Permission to use, copy, modify, and/or distribute this software for any
	// purpose with or without fee is hereby granted, provided that the above
	// copyright notice and this permission notice appear in all copies.
	//
	// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
	// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
	// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
	// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
	// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
	// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
	// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
	
	const { createCipheriv, createHash } = require('crypto');
	function sizes(cipher) {
		for (let nkey = 1, niv = 0;;) {
			try {
		    	createCipheriv( cipher, '.'.repeat(nkey), '.'.repeat(niv));
		    	return [nkey, niv];
		 	} 
		 	catch (e) {
		    	if (/invalid iv length/i.test(e.message)) {
		    		niv += 1;
		    	}
		    	else if (/invalid key length/i.test(e.message)) {
		    		nkey += 1;
		    	}
		    	else { 
		    		throw e;
		    	}
		 	}
		}
	}

	function compute(cipher, passphrase) {
		let [nkey, niv] = sizes(cipher);
		for (let key = '', iv = '', p = '';;) {
			const h = createHash('md5');
			h.update(p, 'hex');
			h.update(passphrase);
			p = h.digest('hex');
			let n, i = 0;
			n = Math.min(p.length-i, 2*nkey);
			nkey -= n/2, key += p.slice(i, i+n), i += n;
			n = Math.min(p.length-i, 2*niv);
			niv -= n/2, iv += p.slice(i, i+n), i += n;
			if (nkey+niv === 0) {
				return [key, iv];
			}
		}
	}

	const [key, iv] = compute( cipher, passphrase );

	return { key: key, iv: iv };
}

