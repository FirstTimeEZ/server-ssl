import * as jose from './jose/index.js';
import { writeFile, readFileSync, existsSync, mkdirSync } from 'fs';

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
const PUBLIC_KEY = '/acmePublicKey.raw';
const PRIVATE_KEY = '/acmePrivateKey.raw';

const CONTENT_TYPE_JOSE = 'application/jose+json';

const REPLAY_NONCE = 'replay-nonce';

const pendingChallenges = [];

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
        console.log(directory);
        console.log("------");

        const nonce = await newNonceAsync(directory.newNonce);

        if (nonce.nonce !== null) {
            account = await createAccount(nonce.nonce, directory.newAccount, keyPair).catch(console.error);

            if (account.answer.account && account.answer.account.status == "valid") {
                console.log("Account Created and Valid", account.answer);
                console.log("Next Nonce", account.nonce);

                const order = await createOrder(account.answer.location, account.nonce, keyPair, directory.newOrder, [{ "type": "dns", "value": fqdn }]);
                if (order.answer.order != undefined) {
                    let n;
                    console.log("------");
                    console.log("Order", order);
                    console.log("Identifiers", order.answer.order.identifiers);
                    console.log("Authorizations", order.answer.order.authorizations);
                    console.log("Next Nonce", (n = order.nonce));

                    authorizations = order.answer.order.authorizations;
                    authorizations.forEach(element => {
                        console.log("authz", element);
                        postAsGet(account.answer.location, n, keyPair, element).then((authorization) => {
                            console.log("------");
                            console.log("Authorization", authorization.answer);

                            console.log("Order", account.answer.location);
                            console.log("Status", authorization.answer.get.status);
                            console.log("Identifier", authorization.answer.get.identifier);
                            console.log("Challenges");
                            pendingChallenges.push(...authorization.answer.get.challenges);
                            console.log("Expires", new Date(authorization.answer.get.expires).toString());
                            console.log("Next Nonce", (n = authorization.nonce));
                        });
                    });
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
        const publicKeyRaw = readFileSync(sslPath + PUBLIC_KEY);
        const privateKeyRaw = readFileSync(sslPath + PRIVATE_KEY);

        keys.publicKey = await jose.importSPKI(publicKeyRaw.toString(), ALG_ECDSA, { extractable: true });
        keys.privateKey = await jose.importPKCS8(privateKeyRaw.toString(), ALG_ECDSA, { extractable: true });

        console.log("Load Keys From File", keys);
    }
    else {
        const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });
        keys.publicKey = publicKey;
        keys.privateKey = privateKey;

        const publicKeyRaw = await jose.exportSPKI(publicKey);
        const privateKeyRaw = await jose.exportPKCS8(privateKey);

        console.log(publicKeyRaw, privateKeyRaw);

        mkdirSync(sslPath, { recursive: true });

        writeFile(sslPath + PUBLIC_KEY, publicKeyRaw, () => { });
        writeFile(sslPath + PRIVATE_KEY, privateKeyRaw, () => { });

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

// Once I implement the key authorization construction correctly, this function will fully comply with the ACME HTTP-01 challenge specification. 
export function checkChallengesMixin(req, res) {
    if (req.url.includes(".well-known/acme-challenge/")) {
        const split = req.url.split("/");
        const token = split[split.length - 1];
        let bufferModified = false;
        pendingChallenges.forEach(challenge => {
            if (challenge.type == "http-01" && challenge.status == "pending" && challenge.token == token) {
                console.log("HTTP-01 ACME Challenge");
                console.log("token", challenge.token);
                res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                res.end(Buffer.from(challenge.token));
                bufferModified = true;
            }
        });

        return bufferModified;
    }

    return false;
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
// |                   |                                |              |
// | Respond to        | POST authorization challenge   | 200          |
// | challenges        | urls                           |              |
// |                   |                                |              |
// | Poll for status   | POST-as-GET order              | 200          |
// |                   |                                |              |
// | Finalize order    | POST order's finalize url      | 200          |
// |                   |                                |              |
// | Poll for status   | POST-as-GET order              | 200          |
// |                   |                                |              |
// | Download          | POST-as-GET order's            | 200          |
// | certificate       | certificate url                |              |
// +-------------------+--------------------------------+--------------+