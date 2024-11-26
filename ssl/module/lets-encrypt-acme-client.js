/**
 * Copyright © 2024 FirstTimeEZ
 * https://github.com/FirstTimeEZ
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as jose from './jose/index.js';
import { join } from 'path';
import { writeFile, readFileSync, existsSync, mkdirSync } from 'fs';
import { generateCSRWithExistingKeys } from './crypt/csr.js';

const DIRECTORY_PRODUCTION = "https://acme-v02.api.letsencrypt.org/directory";
const DIRECTORY_STAGING = "https://acme-staging-v02.api.letsencrypt.org/directory";

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

const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const DAYS_MILLISECONDS = 60 * ONE_DAY_MILLISECONDS;

let localHost = false;
let checkedForLocalHost = false;

let jsonWebKey = undefined;
let acmeDirectory = DIRECTORY_PRODUCTION;

let attemptWhen = null;
let startedWhen = null;

/**
 * Starts the Let's Encrypt daemon to manage SSL certificates.
 *
 * @param {array} fqdns - The fully qualified domain name as a SAN ["example.com","www.example.com"]
 * @param {string} sslPath - The path where the public and private keys will be stored/loaded from.
 * @param {boolean} optGenerateAnyway - (optional) True to generate certificates before the 60 days has passed
 * @param {boolean} optStaging - (optional) True to use staging mode instead of production
 * @param {boolean} optAutoRestart - (optional) True to restart after certificates are generated, must use start-windows.bat or have own mechanism for 123 exit.
 */
export async function startLetsEncryptDaemon(fqdns, sslPath, optGenerateAnyway, optStaging, optAutoRestart, daysDifference) {
    console.log("Starting Lets Encrypt ACME Daemon!");
    console.log("Copyright © 2024 FirstTimeEZ");
    console.log("--------");

    if (internalDetermineRequirement(fqdns, sslPath, daysDifference)) {
        if (optGenerateAnyway !== true) {
            return;
        }
    }

    optStaging === true && (acmeDirectory = DIRECTORY_STAGING, console.log("USING THE STAGING SERVER"));

    const keyChain = await generateKeyChain(sslPath);

    let account = undefined;
    let nextNonce = undefined;
    let authorizations = undefined;

    acmeDirectory = (await newDirectoryAsync()).answer.directory;

    if (acmeDirectory !== null) {
        const firstNonce = await newNonceAsync(acmeDirectory.newNonce);

        if (firstNonce.nonce !== null) {
            account = await createAccount(firstNonce.nonce, acmeDirectory.newAccount, keyChain).catch(console.error);

            if (account.answer.account && account.answer.account.status == "valid") {
                let domains = [];

                fqdns.forEach((element) => {
                    domains.push({ "type": "dns", "value": element });
                });

                const order = await createOrder(account.answer.location, account.nonce, keyChain, acmeDirectory.newOrder, domains);

                if (order.answer.order != undefined) {

                    console.log("Next Nonce", (nextNonce = order.nonce));

                    authorizations = order.answer.order.authorizations;

                    for (let index = 0; index < authorizations.length; index++) {
                        const element = authorizations[index];
                        nextNonce = nextNonce;
                        let auth = await postAsGet(account.answer.location, nextNonce, keyChain, element);

                        if (auth.answer.get.status) {
                            pendingChallenges.push(...auth.answer.get.challenges);
                            console.log("Next Nonce", (nextNonce = auth.nonce));
                        } else {
                            console.error("Error getting auth", auth.answer.error, auth.answer.exception);
                        }
                    }

                    for (let index = 0; index < pendingChallenges.length; index++) {
                        const element = pendingChallenges[index];
                        nextNonce = nextNonce;

                        if (element.type == "http-01" && element.status == "pending") {
                            let auth = await postAsGetChal(account.answer.location, nextNonce, keyChain, element.url);

                            if (auth.answer.get.status) {
                                console.log("Next Nonce", (nextNonce = auth.nonce), auth);
                            } else {
                                console.error("Error getting auth", auth.answer.error, auth.answer.exception);
                            }
                        }
                    }

                    const waitForReady = setInterval(() => {
                        postAsGet(account.answer.location, nextNonce, keyChain, order.answer.location).then((order) => {
                            nextNonce = order.nonce;

                            if (order.answer.get.status == "ready") {
                                clearInterval(waitForReady);

                                console.log("Ready to Finalize", fqdns);

                                finalizeOrder(fqdns[0], account.answer.location, nextNonce, keyChain, order.answer.get.finalize, fqdns).then((finalized) => {

                                    if (finalized.answer.get) {
                                        if (finalized.answer.get.status == "processing" || finalized.answer.get.status == "valid") {

                                            console.log("Waiting for Certificate to be Ready for Download");
                                            const waitForProcessingValid = setInterval(() => {

                                                postAsGet(account.answer.location, nextNonce, keyChain, finalized.answer.location).then((checkFinalized) => {
                                                    if (checkFinalized.answer.get.status == "valid") {
                                                        console.log("Certificate Ready for Download");
                                                        console.log("Certificate URL:", checkFinalized.answer.get.certificate);

                                                        fetch(checkFinalized.answer.get.certificate).then((s) => {
                                                            s.text().then((cert) => {
                                                                let savedCert = null;
                                                                let savedPk = null;
                                                                let savedFragment = null;

                                                                writeFile(join(sslPath, "certificate.pem"), cert, () => {
                                                                    savedCert = true;
                                                                    !optAutoRestart && console.log("Saved Certificate to file (certificate.pem) - Restart the Server");
                                                                });

                                                                writeFile(join(sslPath, "private-key.pem"), keyChain.privateKeySignRaw, () => {
                                                                    savedPk = true;
                                                                    !optAutoRestart && console.log("Saved private key to file (private-key.pem) - Restart the Server");
                                                                });

                                                                writeFile(join(sslPath, "last.ez"), JSON.stringify({ time: Date.now(), names: fqdns }), () => {
                                                                    savedFragment = true;
                                                                });

                                                                if (optAutoRestart === true) {
                                                                    console.log("-------");
                                                                    console.log("Auto Restart is Enabled");
                                                                    console.log("Restarting Server when ready...");
                                                                    console.log("-------");
                                                                    new Promise(() => setInterval(() => (savedCert === true && savedPk === true && savedFragment === true) && process.exit(123), 200));
                                                                }
                                                            });
                                                        });
                                                        clearInterval(waitForProcessingValid);
                                                    }

                                                    console.log("Next Nonce", (nextNonce = checkFinalized.nonce));
                                                });
                                            }, 1000);
                                        }
                                        else {
                                            console.log("something went wrong", finalized.answer);
                                        }
                                    }
                                    else {
                                        console.error("Error getting order", finalized.answer.error, finalized.answer.exception);
                                    }

                                    console.log("Next Nonce", (nextNonce = finalized.nonce));
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
            console.error("Error getting nonce", firstNonce.answer.error, firstNonce.answer.exception);
        }
    }
    else {
        console.error("Error getting directory", acmeDirectory.answer.error, acmeDirectory.answer.exception);
    }
}

/**
 * Node.js Middleware function to check and respond to ACME HTTP-01 challenges inside the HTTP Server.
 *
 * @example
 * createServerHTTP((req, res) => { if (checkChallengesMixin(req, res)) { return; } }).listen(80);
 */
export function checkChallengesMixin(req, res) {
    if (localHost === true || jsonWebKey == undefined) {
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
                        jose.calculateJwkThumbprint(jsonWebKey, DIGEST).then((thumbPrint) => {
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
        fetch(acmeDirectory, { method: "GET" }).then(response => {
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
        jsonWebKey = await jose.exportJWK(keyChain.publicKey);

        const payload = { termsOfServiceAgreed: true };

        const protectedHeader = {
            alg: ALG_ECDSA,
            jwk: jsonWebKey,
            nonce: nonce,
            url: newAccountUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, keyChain);

        const response = await fetchRequest("POST", newAccountUrl, signed);

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

        const response = await fetchRequest("POST", newOrderUrl, signed);

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
        const payload = { csr: await generateCSRWithExistingKeys(commonName, keyChain.publicKeySign, keyChain.privateKeySign, dnsNames, jose) };

        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: finalizeUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, keyChain);

        const response = await fetchRequest("POST", finalizeUrl, signed);

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

        const signed = await signPayload("", protectedHeader, keyChain);

        const response = await fetchRequest("POST", url, signed);

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

        const signed = await signPayloadJson({}, protectedHeader, keyChain);

        const response = await fetchRequest("POST", url, signed);

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
    return await signPayload(JSON.stringify(payload), protectedHeader, keyChain);
}

async function signPayload(payload, protectedHeader, keyChain) {
    const jws = new jose.FlattenedSign(new TextEncoder().encode(payload));
    jws.setProtectedHeader(protectedHeader);
    return JSON.stringify(await jws.sign(keyChain.privateKey));
}

async function fetchRequest(method, url, signedData) {
    const request = {
        method: method,
        headers: {
            'Content-Type': CONTENT_TYPE_JOSE
        },
        body: signedData
    };

    return await fetch(url, request);
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
    if (checkedForLocalHost === false && localHost === false) {
        let ip = req.socket.remoteAddress;

        if (req.headers['x-forwarded-for']) {
            ip = req.headers['x-forwarded-for'].split(',')[0];
        }

        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
            localHost = true;
            console.error(ip, req.headers.host, "You can not generate lets encrypt certificates for localhost");
        }

        checkedForLocalHost = true;
    }
}

function internalDetermineRequirement(fqdns, optionalSslPath, daysDifference) {
    if (existsSync(join(optionalSslPath, "last.ez"))) {
        if (daysDifference != undefined) {
            // Determine a random time to update between 60% and 90% of remaining time
            if (attemptWhen === null) {
                startedWhen = new Date();
                const sixty = daysDifference * 0.60;
                const thirty = daysDifference * 0.30;
                const attemptDays = sixty + Math.floor(Math.random() * thirty);

                console.log("Will renew certificates in [" + (attemptWhen = attemptDays) + "] days if server doesn't restart");

                if (attemptWhen > 1) {
                    return true;
                }
                else {
                    return false; // Random Time Reached, Generate Certs 
                }
            }
            else {
                let timeDifference = new Date().getTime() - startedWhen.getTime();
                let daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
                if (daysDifference >= attemptWhen) {
                    return false; // Random Time Reached, Generate Certs
                }
            }
        }

        const time = readFileSync(join(optionalSslPath, "last.ez"));
        const last = JSON.parse(time);
        console.log("It has been: " + ((Date.now() - last.time) / 1000) + " seconds since you last generated certificates");

        for (let index = 0; index < last.names.length; index++) {
            const element = last.names[index];

            if (fqdns[index] != element) {
                return false; // Names Changed, Generate Certs
            }
        }

        if (Date.now() + DAYS_MILLISECONDS < last.time) {
            return false; // Fallback Time, Generate Certs
        }

        return true;
    }

    return false; // No Fragment, Generate Certs
}