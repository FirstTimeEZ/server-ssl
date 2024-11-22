import * as jose from './jose/index.js';

// This isn't finished and does not generate certificates
// Anything might change until its finished

// anything that replies with a usable reply nonce returns this structure on success
// resolve { answer: { any: any }, nonce: replay-nonce }

// answer should include any response that is not ok as error
// { answer: { error: response } }

// answer should include exceptions as exception
// { answer: { exception: exception } }

const DIRECTORY_URL = "https://acme-staging-v02.api.letsencrypt.org/directory";

const ALG_ECDSA = 'ES256';

const CONTENT_TYPE_JOSE = 'application/jose+json';

const REPLAY_NONCE = 'replay-nonce';

export async function newDirectoryAsync() {
    return new Promise((resolve) => {
        fetch(DIRECTORY_URL, { method: "GET" }).then(response => {
            response.ok
                ? response.json().then((result) => { resolve({ answer: { directory: result } }); }).catch((exception) => resolve({ answer: { exception: exception } }))
                : resolve({ answer: { error: response } });
        }).catch((exception) => resolve({ answer: { exception: exception } }));
    });
}

export async function newNonceAsync(newNonceUrl) {
    let nonceUrl = newNonceUrl;

    if (newNonceUrl == undefined) {
        const directory = (await newDirectoryAsync()).answer.directory;
        if (directory !== null) {
            nonceUrl = directory.newNonce;
        }
    }

    if (nonceUrl !== null) {
        return new Promise(async (resolve) => {
            fetch(nonceUrl, {
                method: "HEAD"
            }).then((response) => response.ok
                ? resolve({ answer: { response: response }, nonce: response.headers.get(REPLAY_NONCE) })
                : resolve({ answer: { error: response } }))
                .catch((exception) => resolve({ answer: { exception: exception } }));;
        });
    } else {
        return { answer: { error: "No directories found or newNonce is not available." } };
    }
}

export async function createAccount(nonce, newAccountUrl, keyPair) {
    try {
        const jwk = await jose.exportJWK(keyPair.publicKey);

        const payload = { termsOfServiceAgreed: true };
        const protectedHeader = {
            alg: ALG_ECDSA,
            jwk,
            nonce: nonce,
            url: newAccountUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, keyPair);

        const request = {
            method: 'POST',
            headers: {
                'Content-Type': CONTENT_TYPE_JOSE
            },
            body: signed
        };

        const response = await fetch(newAccountUrl, request);

        if (response.ok) {
            return {
                answer: { account: await response.json(), location: response.headers.get('location') },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: await response.json() },
                nonce: null
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

export async function createOrder(kid, nonce, keyPair, newOrderUrl, identifiers) {
    try {
        const payload = { "identifiers": identifiers };

        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: newOrderUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, keyPair);

        const request = {
            method: 'POST',
            headers: {
                'Content-Type': CONTENT_TYPE_JOSE
            },
            body: signed
        };

        const response = await fetch(newOrderUrl, request);

        if (response.ok) {
            return {
                answer: { order: await response.json(), location: response.headers.get('location') },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: await response.json() },
                nonce: null
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

/**
 * Generates a key pair, The generated public key will be associated with a user account.
 * The generated private key will be used to sign requests.
 *
 * @returns {Promise<{ publicKey: CryptoKey, privateKey: CryptoKey }>} 
 *          An object containing the generated public and private keys.
 *          The public key is linked to the user account.
 *
 */
export async function generateKeyPair() {
    const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });
    return { publicKey, privateKey };
}

/**
 * Signs a the payload and a protected header using a given key pair.
 *
 * This function creates a JWS (JSON Web Signature) by encoding the provided
 * payload object and signing it with the private key from the provided key pair.
 * The protected header is also set for the JWS.
 *
 * @param {Object} payload - The payload to be signed. This should be a valid object.
 * @param {Object} protectedHeader - The protected header to be included in the JWS. This should be a valid object containing JWS header parameters.
 * @param {Object} keyPair - An object containing the key pair used for signing. It should have a `privateKey` property that holds the private key.
 * @returns {Promise<string>} A promise that resolves to a JSON string representing the signed JWS.
 *
 * @throws {Error} Throws an error if the signing process fails.
 */
export async function signPayloadJson(payload, protectedHeader, keyPair) {
    const jws = new jose.FlattenedSign(new TextEncoder().encode(JSON.stringify(payload)));
    jws.setProtectedHeader(protectedHeader);
    return JSON.stringify(await jws.sign(keyPair.privateKey));
}

/**
 * Starts the Let's Encrypt daemon to manage SSL certificates.
 * 
 * If an optional keyPair is provided, it will be used for authentication, the keyPair is basically your user account.
 * 
 * If no keyPair is provided, a random one will be generated and used instead.
 *
 * @param {Object} [optionalKeyPair] - An optional keypair for authentication/account
 * @param {string} optionalKeyPair.publicKey - The public key part of the keypair.
 * @param {string} optionalKeyPair.privateKey - The private key part of the keypair.
 * @see {generateKeyPair}
 */
export async function startLetsEncryptDaemon(fqdm, optionalKeyPair) {
    if (optionalKeyPair == undefined) {
        optionalKeyPair = await generateKeyPair();
    }

    if (optionalKeyPair.publicKey == undefined) {
        throw new Error("optionalKeyPair.publicKey must be defined");
    }

    if (optionalKeyPair.privateKey == undefined) {
        throw new Error("optionalKeyPair.publicKey must be defined");
    }

    console.log("Starting Lets Encrypt Daemon!");
    console.log("This does not currently generate certificates.");

    const directory = (await newDirectoryAsync()).answer.directory;

    if (directory !== null) {
        console.log(directory);

        const nonce = await newNonceAsync(directory.newNonce);

        if (nonce.nonce !== null) {
            const account = await createAccount(nonce.nonce, directory.newAccount, optionalKeyPair).catch(console.error);

            if (account.answer.account && account.answer.account.status == "valid") {
                console.log("Account Created and Valid", account.answer);
                console.log("Next Nonce", account.nonce);

                const order = await createOrder(account.answer.location, account.nonce, optionalKeyPair, directory.newOrder, [{ "type": "dns", "value": fqdm }]);
                if (order.answer.order != undefined) {
                    console.log(order.answer.order);
                    console.log("Next Nonce", order.nonce);
                }
                else {
                    console.error("Error getting order", order.answer.error, order.answer.exception);
                }
            }
            else {
                console.error("Error creating account", account.answer.error, account.answer.exception);
            }
        }
        else {
            console.error("Error getting nonce", nonce.answer.error, nonce.answer.exception);
        }
    }
    else {
        console.error("Error getting directory", directory.answer.error, directory.answer.exception);
    }
}

// {
//     '5JzAlUrt3Pk': 'https://community.letsencrypt.org/t/adding-random-entries-to-the-directory/33417',
//     keyChange: 'https://acme-staging-v02.api.letsencrypt.org/acme/key-change',
//     meta: {
//       caaIdentities: [ 'letsencrypt.org' ],
//       termsOfService: 'https://letsencrypt.org/documents/LE-SA-v1.4-April-3-2024.pdf',
//       website: 'https://letsencrypt.org/docs/staging-environment/'
//     },
//     newAccount: 'https://acme-staging-v02.api.letsencrypt.org/acme/new-acct',
//     newNonce: 'https://acme-staging-v02.api.letsencrypt.org/acme/new-nonce',
//     newOrder: 'https://acme-staging-v02.api.letsencrypt.org/acme/new-order',
//     renewalInfo: 'https://acme-staging-v02.api.letsencrypt.org/draft-ietf-acme-ari-03/renewalInfo',
//     revokeCert: 'https://acme-staging-v02.api.letsencrypt.org/acme/revoke-cert'
//   }
//   Account Created and Valid {
//     account: {
//       key: {
//         kty: 'EC',
//         crv: 'P-256',
//         x: '[removed personal info]',
//         y: '[removed personal info]'
//       },
//       initialIp: '[removed personal info]',
//       createdAt: '2024-11-22T08:15:06.116330285Z',
//       status: 'valid'
//     },
//     location: 'https://acme-staging-v02.api.letsencrypt.org/acme/acct/172696254'
//   }
//   Next Nonce jDZhkUVkLGJl0GHzQYG_t6IMRqtfhawfJT3Nr8VeRXowCuBSxFU
//   {
//     status: 'pending',
//     expires: '2024-11-29T08:15:06Z',
//     identifiers: [ { type: 'dns', value: 'www.thisismydomainhowdoyouknow123.org' } ],
//     authorizations: [
//       'https://acme-staging-v02.api.letsencrypt.org/acme/authz/172696254/15031989944'
//     ],
//     finalize: 'https://acme-staging-v02.api.letsencrypt.org/acme/finalize/172696254/20696202154'
//   }  
// authorizations {
//     "identifier": {
//       "type": "dns",
//       "value": "www.thisismydomainhowdoyouknow123.org"
//     },
//     "status": "pending",
//     "expires": "2024-11-29T08:15:06Z",
//     "challenges": [
//       {
//         "type": "http-01",
//         "url": "https://acme-staging-v02.api.letsencrypt.org/acme/chall/172696254/15031989944/S__T2A",
//         "status": "pending",
//         "token": "nhUcxf4_n5JPnCD2KVVD7DzSHV37FmZxWnGBNap8XKQ"
//       },
//       {
//         "type": "tls-alpn-01",
//         "url": "https://acme-staging-v02.api.letsencrypt.org/acme/chall/172696254/15031989944/_TPVyA",
//         "status": "pending",
//         "token": "nhUcxf4_n5JPnCD2KVVD7DzSHV37FmZxWnGBNap8XKQ"
//       },
//       {
//         "type": "dns-01",
//         "url": "https://acme-staging-v02.api.letsencrypt.org/acme/chall/172696254/15031989944/Zk2vUg",
//         "status": "pending",
//         "token": "nhUcxf4_n5JPnCD2KVVD7DzSHV37FmZxWnGBNap8XKQ"
//       }
//     ]
//   }