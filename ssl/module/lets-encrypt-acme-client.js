import * as jose from './jose/index.js';
import { writeFile, readFileSync, existsSync, mkdirSync } from 'fs';
import { generateCSRWithExistingKeys } from './csr.js';

// This isn't finished and does not generate certificates
// success/resolve { answer: { any: any }, nonce: replay-nonce-if-exists }
// error/resolve { answer: { error: response }, nonce: replay-nonce-if-exists }
// exception { answer: { exception: exception } }

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
let checkedForLocalHost = false;

let jwk = undefined;

/**
 * Starts the Let's Encrypt daemon to manage SSL certificates.
 *
 * @param {array} fqdns - The fully qualified domain name as a SAN ["example.com","www.example.com"]
 * @param {string} optionalSslPath - The file path where the public and private keys will be stored/loaded from.
 */
export async function startLetsEncryptDaemon(fqdns, optionalSslPath) {
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

                fqdns.forEach((element) => {
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

                                const sans = { dnsNames: fqdns };

                                console.log("Ready to Finalize", sans);

                                finalizeOrder(sans.dnsNames[0], account.answer.location, n, keyPair, order.answer.order.finalize, sans).then((finalized) => {
                                    if (finalized.answer.get) {
                                        console.log(finalized.answer);
                                    }
                                    else {
                                        console.error("Error getting order", finalized.answer.error, finalized.answer.exception);
                                    }

                                    console.log("Next Nonce", (n = finalized.nonce));
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

/**
 * Node.js Middleware function to check and respond to ACME HTTP-01 challenges inside the HTTP Server.
 *
 * @example
 * createServerHTTP((req, res) => { if (checkChallengesMixin(req, res)) { return; } }).listen(80);
 */
export function checkChallengesMixin(req, res) {
    if (LOCALHOST === true || jwk == undefined) {
        return false;
    }

    try {
        internalCheckForLocalHostOnce(req);

        if (req.url.startsWith("/.well-known/acme-challenge/")) {
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
    } catch { } // Ignore

    return false;
}

async function newDirectoryAsync() {
    return new Promise((resolve) => {
        fetch(DIRECTORY_URL, { method: "GET" }).then(response => {
            response.ok
                ? response.json().then((result) => { resolve({ answer: { directory: result } }); }).catch((exception) => resolve({ answer: { exception: exception } }))
                : resolve({ answer: { error: response } });
        }).catch((exception) => resolve({ answer: { exception: exception } }));
    });
}

async function newNonceAsync(newNonceUrl) {
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

async function createAccount(nonce, newAccountUrl, keyPair) {
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

async function createOrder(kid, nonce, keyPair, newOrderUrl, identifiers) {
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

async function finalizeOrder(commonName, kid, nonce, keyPair, finalizeUrl, sans) {
    try {
        const out = JSON.stringify({ csr: await generateCSRWithExistingKeys(commonName, keyPair.publicKey, keyPair.privateKey, sans, jose) });

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
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

async function postAsGet(kid, nonce, keyPair, url) {
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

async function postAsGetChal(kid, nonce, keyPair, url) {
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

async function signPayloadJson(payload, protectedHeader, keyPair) {
    const jws = new jose.FlattenedSign(new TextEncoder().encode(JSON.stringify(payload)));
    jws.setProtectedHeader(protectedHeader);
    return JSON.stringify(await jws.sign(keyPair.privateKey));
}

async function generateKeyPair(sslPath) {
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

function internalCheckForLocalHostOnce(req) {
    if (checkedForLocalHost === false && LOCALHOST === false) {
        let ip = req.socket.remoteAddress;

        if (req.headers['x-forwarded-for']) {
            ip = req.headers['x-forwarded-for'].split(',')[0];
        }

        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
            LOCALHOST = true;
            console.error(ip, req.headers.host, "You can not generate lets encrypt certificates for localhost");
        }

        checkedForLocalHost = true;
    }
}