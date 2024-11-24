import * as jose from './jose/index.js';
import { writeFile, readFileSync, existsSync, mkdirSync } from 'fs';
import { generateCSRWithExistingKeys } from './csr.js';

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
const DIGEST = "sha256";
const PUBLIC_KEY = '/acmePublicKey.raw';
const PRIVATE_KEY = '/acmePrivateKey.raw';

const CONTENT_TYPE_JOSE = 'application/jose+json';
const CONTENT_TYPE_OCTET = 'application/octet-stream';

const REPLAY_NONCE = 'replay-nonce';

const pendingChallenges = [];

let LOCALHOST = false;

let jwk = undefined;

/**
 * Starts the Let's Encrypt daemon to manage SSL certificates.
 * 
 * If an optional keyPair is provided, it will be used for authentication; the keyPair is basically your user account.
 * 
 * If no keyPair is provided, a random one will be generated and used instead.
 *
 * @param {string} fqdn - The fully qualified domain name (FQDN) for which to manage SSL certificates.
 * @param {string} sslPath - The file path where the public and private keys are stored.
 *                            The keys will be saved as 'publicKey.raw' and 'privateKey.raw'
 *                            if they do not already exist.
 *
 * @see {generateKeyPair}
 */
export async function startLetsEncryptDaemon(fqdn, optionalSslPath) {
    const keyPair = await generateKeyPair(optionalSslPath);
    let account = undefined;
    let directory = undefined;
    let authorizations = undefined;

    if (keyPair.publicKey == undefined) {
        throw new Error("optionalKeyPair.publicKey must be defined");
    }

    if (keyPair.privateKey == undefined) {
        throw new Error("optionalKeyPair.publicKey must be defined");
    }

    console.log("------");
    console.log("Starting Lets Encrypt Daemon!");
    console.log("This does not currently generate certificates.");

    directory = (await newDirectoryAsync()).answer.directory;

    if (directory !== null) {
        //console.log(directory);
        //console.log("------");

        const nonce = await newNonceAsync(directory.newNonce);

        if (nonce.nonce !== null) {
            account = await createAccount(nonce.nonce, directory.newAccount, keyPair).catch(console.error);

            if (account.answer.account && account.answer.account.status == "valid") {
                //  console.log("Account Created and Valid", account.answer);
                //  console.log("Next Nonce", account.nonce);

                let domains = [];

                fqdn.forEach((element) => {
                    domains.push({ "type": "dns", "value": element });
                });

                const order = await createOrder(account.answer.location, account.nonce, keyPair, directory.newOrder, domains);
                if (order.answer.order != undefined) {
                    let n;
                    // console.log("------");
                    // console.log("Order", order);
                    // console.log("Identifiers", order.answer.order.identifiers);
                    // console.log("Authorizations", order.answer.order.authorizations);
                    console.log("Next Nonce", (n = order.nonce));

                    authorizations = order.answer.order.authorizations;

                    for (let index = 0; index < authorizations.length; index++) {
                        const element = authorizations[index];
                        n = n;

                        // console.log("authz", element);
                        let auth = await postAsGet(account.answer.location, n, keyPair, element);

                        if (auth.answer.get.status) {
                            //console.log("------");
                            // console.log("Authorization", auth.answer);
                            // console.log("Order", account.answer.location);
                            // console.log("Status", auth.answer.get.status);
                            // console.log("Identifier", auth.answer.get.identifier);
                            // console.log("Challenges");
                            pendingChallenges.push(...auth.answer.get.challenges);
                            // console.log("Expires", new Date(auth.answer.get.expires).toString());
                            console.log("Next Nonce", (n = auth.nonce));
                        } else {
                            console.error("Error getting auth", auth.answer.error, auth.answer.exception);
                        }
                    }

                    for (let index = 0; index < pendingChallenges.length; index++) {
                        const element = pendingChallenges[index];
                        n = n;

                        if (element.type == "http-01" && element.status == "pending") {
                            // console.log("challenge", element);

                            let auth = await postAsGetChal(account.answer.location, n, keyPair, element.url);

                            if (auth.answer.get.status) {
                                console.log("Next Nonce", (n = auth.nonce), auth);
                            } else {
                                console.error("Error getting auth", auth.answer.error, auth.answer.exception);
                            }
                        }
                    }

                    const waitForReady = setInterval(() => {
                        createOrder(account.answer.location, n, keyPair, directory.newOrder, domains).then((order) => {
                            n = order.nonce;
                            if (order.answer.order.status == "ready") {
                                console.log(order);
                                clearInterval(waitForReady);
                                console.log("Ready to Finalize");
                                finalizeOrder('ssl.boats', account.answer.location, n, keyPair, order.answer.order.finalize).then((finalized) => {
                                    if (finalized.answer.get) {
                                        console.log(finalized.answer);
                                        n = finalized.nonce;
                                    }
                                    else {
                                        console.error("Error getting order", finalized.answer.error, finalized.answer.exception);
                                    }
                                });
                            }
                        });
                    }, 1000);

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
        jwk = await jose.exportJWK(keyPair.publicKey);

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

export async function finalizeOrder(commonName, kid, nonce, keyPair, finalizeUrl) {
    try {
        const out = JSON.stringify({ csr: await generateCSRWithExistingKeys(commonName, keyPair.publicKey, keyPair.privateKey) });

        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: finalizeUrl,
        };

        const jws = new jose.FlattenedSign(new TextEncoder().encode(out));

        jws.setProtectedHeader(protectedHeader);

        const signed = JSON.stringify(await jws.sign(keyPair.privateKey));

        const request = {
            method: 'POST',
            headers: {
                'Content-Type': CONTENT_TYPE_JOSE
            },
            body: signed
        };

        const response = await fetch(finalizeUrl, request);

        if (response.ok) {
            return {
                answer: { get: await response.json(), location: response.headers.get('location') },
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

export async function postAsGet(kid, nonce, keyPair, url) {
    try {
        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: url,
        };

        const jws = new jose.FlattenedSign(new TextEncoder().encode(""));
        jws.setProtectedHeader(protectedHeader);
        const signed = JSON.stringify(await jws.sign(keyPair.privateKey));

        const request = {
            method: 'POST',
            headers: {
                'Content-Type': CONTENT_TYPE_JOSE
            },
            body: signed
        };

        const response = await fetch(url, request);

        if (response.ok) {
            return {
                answer: { get: await response.json(), location: response.headers.get('location') },
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

export async function postAsGetChal(kid, nonce, keyPair, url) {
    try {
        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: url,
        };

        const jws = new jose.FlattenedSign(new TextEncoder().encode(JSON.stringify({})));
        jws.setProtectedHeader(protectedHeader);
        const signed = JSON.stringify(await jws.sign(keyPair.privateKey));

        const request = {
            method: 'POST',
            headers: {
                'Content-Type': CONTENT_TYPE_JOSE
            },
            body: signed
        };

        const response = await fetch(url, request);

        if (response.ok) {
            return {
                answer: { get: await response.json(), location: response.headers.get('location') },
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
 * Generates a public-private key pair for cryptographic operations.
 * The generated public key will be associated with a user account,
 * while the private key will be used to sign requests.
 *
 * If existing keys are found at the specified path, they will be loaded
 * from the filesystem instead of generating new ones.
 *
 * @param {string} sslPath - The file path where the public and private keys are stored.
 *                            The keys will be saved as 'publicKey.raw' and 'privateKey.raw'
 *                            if they do not already exist.
 *
 * @returns {Promise<{ publicKey: CryptoKey, privateKey: CryptoKey }>} 
 *          An object containing the generated or loaded public and private keys.
 *          The public key is linked to the user account and can be shared,
 *          while the private key must be kept secure and confidential.
 *
 * @throws {Error} Throws an error if key generation or file operations fail.
 *
 * @example
 * const keyPair = await generateKeyPair('/path/to/keys/'); 
 */
export async function generateKeyPair(sslPath) {
    let keys = {};

    if (existsSync(sslPath + PUBLIC_KEY) && existsSync(sslPath + PRIVATE_KEY)) {
        keys.publicKeyRaw = readFileSync(sslPath + PUBLIC_KEY);
        keys.privateKeyRaw = readFileSync(sslPath + PRIVATE_KEY);
        keys.publicKey = await jose.importSPKI(keys.publicKeyRaw.toString(), ALG_ECDSA, { extractable: true });
        keys.privateKey = await jose.importPKCS8(keys.privateKeyRaw.toString(), ALG_ECDSA, { extractable: true });

        console.log("Load Keys From File");
    }
    else {
        const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });
        keys.publicKey = publicKey;
        keys.privateKey = privateKey;
        keys.publicKeyRaw = await jose.exportSPKI(publicKey);
        keys.privateKeyRaw = await jose.exportPKCS8(privateKey);

        console.log(keys.publicKeyRaw, keys.privateKeyRaw);

        mkdirSync(sslPath, { recursive: true });

        writeFile(sslPath + PUBLIC_KEY, keys.publicKeyRaw, () => { });
        writeFile(sslPath + PRIVATE_KEY, keys.privateKeyRaw, () => { });

        console.log('Raw ES256 keys saved to publicKey.raw and privateKey.raw');
    }

    return keys;
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

export function checkChallengesMixin(req, res) {
    try {
        if (jwk !== undefined && req.url.startsWith("/.well-known/acme-challenge/")) {
            InternalCheckIsLocalHost(req);

            const split = req.url.split("/");
            if (split.length === 4) {
                const token = split[split.length - 1];
                let bufferModified = false;
                pendingChallenges.forEach(challenge => {
                    if (challenge.type == "http-01" && challenge.status == "pending" && challenge.token == token) {
                        console.log("HTTP-01 ACME Challenge");
                        console.log("token", challenge.token);
                        jose.calculateJwkThumbprint(jwk, DIGEST).then((thumbPrint) => {
                            res.writeHead(200, { 'Content-Type': CONTENT_TYPE_OCTET });
                            const answer = `${challenge.token}.${thumbPrint}`;
                            res.end(Buffer.from(answer));
                            console.log("HTTP-01 ACME Challenge Answered", answer);
                        });
                        bufferModified = true;
                    }
                });

                return bufferModified;
            }
        }
    } catch (exception) {
        console.log("checkChallengesMixin exception", exception);
    }

    return false;
}

function InternalCheckIsLocalHost(req) {
    if (LOCALHOST == false) {
        let ip = req.socket.remoteAddress;
        if (req.headers['x-forwarded-for']) {
            ip = req.headers['x-forwarded-for'].split(',')[0];
        }

        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
            LOCALHOST = true;
            console.error(ip, req.headers.host, "You can not generate lets encrypt certificates for localhost");
        }
    }
}

// +-------------------+--------------------------------+--------------+
// | Action            | Request                        | Response     |
// +-------------------+--------------------------------+--------------+
// | Get directory     | GET  directory                 | 200          | x
// |                   |                                |              |
// | Get nonce         | HEAD newNonce                  | 200          | x
// |                   |                                |              |
// | Create account    | POST newAccount                | 201 ->       | x
// |                   |                                | account      |
// |                   |                                |              |
// | Submit order      | POST newOrder                  | 201 -> order | x
// |                   |                                |              |
// | Fetch challenges  | POST-as-GET order's            | 200          | x
// |                   | authorization urls             |              | x
// |                   |                                |              | x
// | Respond to        | POST authorization challenge   | 200          | x
// | challenges        | urls                           |              | x
// |                   |                                |              | x
// | Poll for status   | POST-as-GET order              | 200          | x
// |                   |                                |              | x
// | ASN1 DER CSR      |                                |              | x
// |                   |                                |              | 
// | Finalize order    | POST order's finalize url      | 200          |
// |                   |                                |              |
// | Poll for status   | POST-as-GET order              | 200          |
// |                   |                                |              |
// | Download          | POST-as-GET order's            | 200          |
// | certificate       | certificate url                |              |
// +-------------------+--------------------------------+--------------+