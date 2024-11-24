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
const PUBLIC_KEY_SIGN = '/acmePublicSignKey.raw';
const PRIVATE_KEY_SIGN = '/acmePrivateSignKey.raw';

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
    const keyChain = await generateKeyChain(optionalSslPath);
    let account = undefined;
    let directory = undefined;
    let authorizations = undefined;

    console.log("------");
    console.log("Starting Lets Encrypt Daemon!");
    console.log("This does not currently generate certificates.");

    directory = (await newDirectoryAsync()).answer.directory;

    if (directory !== null) {
        //console.log(directory);
        //console.log("------");

        const nonce = await newNonceAsync(directory.newNonce);

        if (nonce.nonce !== null) {
            account = await createAccount(nonce.nonce, directory.newAccount, keyChain).catch(console.error);

            if (account.answer.account && account.answer.account.status == "valid") {
                //  console.log("Account Created and Valid", account.answer);
                //  console.log("Next Nonce", account.nonce);

                let domains = [];

                fqdns.forEach((element) => {
                    domains.push({ "type": "dns", "value": element });
                });

                const order = await createOrder(account.answer.location, account.nonce, keyChain, directory.newOrder, domains);
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
                        let auth = await postAsGet(account.answer.location, n, keyChain, element);

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
                            let auth = await postAsGetChal(account.answer.location, n, keyChain, element.url);

                            if (auth.answer.get.status) {
                                console.log("Next Nonce", (n = auth.nonce), auth);
                            } else {
                                console.error("Error getting auth", auth.answer.error, auth.answer.exception);
                            }
                        }
                    }

                    const waitForReady = setInterval(() => {
                        createOrder(account.answer.location, n, keyChain, directory.newOrder, domains).then((order) => {
                            n = order.nonce;
                            if (order.answer.order.status == "ready") {
                                console.log(order);
                                clearInterval(waitForReady);

                                console.log("Ready to Finalize", fqdns);

                                finalizeOrder(fqdns[0], account.answer.location, n, keyChain, order.answer.order.finalize, fqdns).then((finalized) => {
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

async function createAccount(nonce, newAccountUrl, keyChain) {
    try {
        jwk = await jose.exportJWK(keyChain.publicKey);

        const payload = { termsOfServiceAgreed: true };
        const protectedHeader = {
            alg: ALG_ECDSA,
            jwk,
            nonce: nonce,
            url: newAccountUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, keyChain);

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

async function createOrder(kid, nonce, keyChain, newOrderUrl, identifiers) {
    try {
        const payload = { "identifiers": identifiers };

        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: newOrderUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, keyChain);

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

async function finalizeOrder(commonName, kid, nonce, keyChain, finalizeUrl, dnsNames) {
    try {
        const out = JSON.stringify({ csr: await generateCSRWithExistingKeys(commonName, keyChain.publicKeySign, keyChain.privateKeySign, dnsNames, jose) });

        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: finalizeUrl,
        };

        const jws = new jose.FlattenedSign(new TextEncoder().encode(out));

        jws.setProtectedHeader(protectedHeader);

        const signed = JSON.stringify(await jws.sign(keyChain.privateKey));

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

async function postAsGet(kid, nonce, keyChain, url) {
    try {
        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: url,
        };

        const jws = new jose.FlattenedSign(new TextEncoder().encode(""));
        jws.setProtectedHeader(protectedHeader);
        const signed = JSON.stringify(await jws.sign(keyChain.privateKey));

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

async function postAsGetChal(kid, nonce, keyChain, url) {
    try {
        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: url,
        };

        const jws = new jose.FlattenedSign(new TextEncoder().encode(JSON.stringify({})));
        jws.setProtectedHeader(protectedHeader);
        const signed = JSON.stringify(await jws.sign(keyChain.privateKey));

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

async function signPayloadJson(payload, protectedHeader, keyChain) {
    const jws = new jose.FlattenedSign(new TextEncoder().encode(JSON.stringify(payload)));
    jws.setProtectedHeader(protectedHeader);
    return JSON.stringify(await jws.sign(keyChain.privateKey));
}

async function generateKeyChain(sslPath) {
    let keyChain = {};

    if (existsSync(sslPath + PUBLIC_KEY) && existsSync(sslPath + PRIVATE_KEY)) {
        keyChain.publicKeyRaw = readFileSync(sslPath + PUBLIC_KEY);
        keyChain.privateKeyRaw = readFileSync(sslPath + PRIVATE_KEY);
        keyChain.publicKey = await jose.importSPKI(keyChain.publicKeyRaw.toString(), ALG_ECDSA, { extractable: true });
        keyChain.privateKey = await jose.importPKCS8(keyChain.privateKeyRaw.toString(), ALG_ECDSA, { extractable: true });

        console.log("Load ACME Keys From File");

        if (existsSync(sslPath + PUBLIC_KEY_SIGN) && existsSync(sslPath + PRIVATE_KEY_SIGN)) {
            keyChain.publicKeySignRaw = readFileSync(sslPath + PUBLIC_KEY_SIGN);
            keyChain.privateKeySignRaw = readFileSync(sslPath + PRIVATE_KEY_SIGN);
            keyChain.publicKeySign = await jose.importSPKI(keyChain.publicKeySignRaw.toString(), ALG_ECDSA, { extractable: true });
            keyChain.privateKeySign = await jose.importPKCS8(keyChain.privateKeySignRaw.toString(), ALG_ECDSA, { extractable: true });

            console.log("Load Signing Keys From File");
        }
    }
    else {
        mkdirSync(sslPath, { recursive: true });

        if (true) { // Acme Keys
            const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });
            keyChain.publicKey = publicKey;
            keyChain.privateKey = privateKey;
            keyChain.publicKeyRaw = await jose.exportSPKI(publicKey);
            keyChain.privateKeyRaw = await jose.exportPKCS8(privateKey);

            writeFile(sslPath + PUBLIC_KEY, keyChain.publicKeyRaw, () => { });
            writeFile(sslPath + PRIVATE_KEY, keyChain.privateKeyRaw, () => { });

            console.log('ACME Keys saved to File');
        }

        if (true) { // Signing Keys
            const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });

            keyChain.publicKeySign = publicKey;
            keyChain.privateKeySign = privateKey;
            keyChain.publicKeySignRaw = await jose.exportSPKI(publicKey);
            keyChain.privateKeySignRaw = await jose.exportPKCS8(privateKey);

            writeFile(sslPath + PUBLIC_KEY_SIGN, keyChain.publicKeySignRaw, () => { });
            writeFile(sslPath + PRIVATE_KEY_SIGN, keyChain.privateKeySignRaw, () => { });

            console.log('Signing Keys saved to File');
        }
    }

    return keyChain;
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