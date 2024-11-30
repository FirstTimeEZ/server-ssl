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
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import * as acme from './acme-v2.js';

const DIRECTORY_PRODUCTION = "https://acme-v02.api.letsencrypt.org/directory";
const DIRECTORY_STAGING = "https://acme-staging-v02.api.letsencrypt.org/directory";
const WELL_KNOWN = "/.well-known/acme-challenge/";
const ACME_CHALLENGE = "HTTP-01 ACME Challenge";
const CONTENT_TYPE = "Content-Type";
const STATUS_PENDING = "pending";
const HTTP = "http-01";
const DELIM = "/";

const LAST_CERT_FILE = "last_certification.ez";

const ARRAY = 1;
const SUCCESS = 200;
const EXPECTED_SPLITS = 4;
const MAX_LENGTH = 1000;
const MIN_LENGTH = 32;

const ALG_ECDSA = 'ES256';
const PUBLIC_KEY = '/acmePublicKey.raw';
const PRIVATE_KEY = '/acmePrivateKey.raw';
const PUBLIC_KEY_SIGN = '/acmePublicSignKey.raw';
const PRIVATE_KEY_SIGN = '/acmePrivateSignKey.raw';

const CONTENT_TYPE_OCTET = 'application/octet-stream';

const VALID = "valid";

const REDIRECT_ONLY = "Cleared Answered Challenges - HTTP is now redirect only until new challenges are created";

const ONE_SECOND_MS = 1000;
const SIXTY_PERCENT = 0.60;
const THIRTY_PERCENT = 0.30;
const ONE_DAY_MILLISECONDS = 86400000;
const CHECK_CLOSE_TIME = 65000;

let pendingChallenges = [];

let checkAnswersFlag = false;
let localHost = false;
let checkedForLocalHost = false;

let acmeKeyChain = undefined;

let jsonWebKey = undefined;
let jsonWebKeyThumbPrint = null;

let acmeDirectory = DIRECTORY_PRODUCTION;

let attemptWhen = null;
let startedWhen = null;

/**
 * Starts the Let's Encrypt daemon to manage SSL certificates.
 *
 * @param {array} fqdns - The fully qualified domain name as a SAN ["example.com","www.example.com"]
 * @param {string} sslPath - The path where the public and private keys will be stored/loaded from.
 * @param {boolean} daysRemaining - The number of days left before the certificate expires
 * @param {function} certificateCallback - callback that can be used to update the certificates if auto restart is disabled
 * @param {boolean} optGenerateAnyway - (optional) True to generate certificates before the 60 days has passed
 * @param {boolean} optStaging - (optional) True to use staging mode instead of production
 * @param {boolean} optAutoRestart - (optional) True to restart after certificates are generated, You don't need to do this but you might want to
 * @param {function} countdownHandler - (optional) paramterless function that will fire every second during the restart count down
 * @param {function} countdownTime - (optional) how long in seconds to countdown before restarting, default 30 seconds
 */
export async function startLetsEncryptDaemon(fqdns, sslPath, daysRemaining, certificateCallback, optGenerateAnyway, optStaging, optAutoRestart, countdownHandler, countdownTime) {
    console.log("Starting Lets Encrypt ACME Daemon!");
    console.log("Copyright © 2024 FirstTimeEZ");
    console.log("--------");

    if (internalDetermineRequirement(fqdns, sslPath, daysRemaining) && optGenerateAnyway !== true) {
        return;
    }

    await internalGetAcmeKeyChain(sslPath);

    for (let index = 0; index < 3; index++) {
        try {
            const success = await internalLetsEncryptDaemon(fqdns, sslPath, certificateCallback, optStaging, optAutoRestart, countdownHandler, countdownTime);

            if (success === true) {
                console.log("Completed Successfully", index + 1);
                return;
            }
            else {
                console.log("Something went wrong, trying again", index + 1);
            }
        } catch {
            console.error("Something went wrong, trying again", index + 1);
        }
    }

    console.error("------------------");
    console.error("Something is preventing the Lets Encrypt Daemon");
    console.error("from creating or renewing your certificate");
    console.error("------------------");
}

/**
 * Node.js Middleware function to check and respond to ACME HTTP-01 challenges inside the HTTP Server.
 *
 * @example
 * createServerHTTP((req, res) => { if (checkChallengesMixin(req, res)) { return; } }).listen(80);
 */
export async function checkChallengesMixin(req, res) {
    if (pendingChallenges.length === 0 || localHost === true || jsonWebKeyThumbPrint == undefined || internalCheckChallenges()) {
        return false;
    }

    try {
        if (internalCheckForLocalHostOnce(req)) {
            return false;
        }

        if (req.url.startsWith(WELL_KNOWN) && req.url.length < MAX_LENGTH) {
            const split = req.url.split(DELIM);

            if (split.length === EXPECTED_SPLITS) {
                const token = split[split.length - ARRAY];

                if (token.length > MIN_LENGTH) {
                    let bufferModified = false;

                    for (let index = 0; index < pendingChallenges.length; index++) {
                        const challenge = pendingChallenges[index];

                        if (challenge.type == HTTP && challenge.token == token) {
                            console.log(ACME_CHALLENGE, challenge.token);

                            res.writeHead(SUCCESS, { [CONTENT_TYPE]: CONTENT_TYPE_OCTET });
                            res.end(Buffer.from(`${challenge.token}.${jsonWebKeyThumbPrint}`));

                            bufferModified = true;

                            checkAnswersFlag === false && (checkAnswersFlag = true, setTimeout(async () => await internalCheckAnswered(), CHECK_CLOSE_TIME));
                        }
                    }

                    return bufferModified;
                }
            }
        }
    } catch { } // Ignore

    return false;
}

function internalCheckForLocalHostOnce(req) {
    if (checkedForLocalHost === false && localHost === false) {
        checkedForLocalHost = true;

        let ip = req.socket.remoteAddress;

        if (req.headers['x-forwarded-for']) {
            ip = req.headers['x-forwarded-for'].split(',')[0];
        }

        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
            localHost = true;
            console.error(ip, req.headers.host, "You can not generate lets encrypt certificates for localhost");

            return true;
        }
    }

    return false;
}

function internalDetermineRequirement(fqdns, certFilePath, daysRemaining) {
    const certFile = join(certFilePath, LAST_CERT_FILE);
    let ok = false;

    if (existsSync(certFile)) {
        const time = readFileSync(certFile);

        if (time != undefined) {
            const last = JSON.parse(time);

            if (last != undefined) {
                last.time != undefined && console.log("It has been: " + ((Date.now() - last.time) / ONE_SECOND_MS) + " seconds since you last generated certificates");

                if (last.names instanceof Array) {
                    if (fqdns.length !== last.names.length) {
                        return ok;
                    }

                    for (let index = 0; index < last.names.length; index++) {
                        if (fqdns[index] != last.names[index]) {
                            return ok;
                        }
                    }
                }
            }
        }

        if (attemptWhen === null) {
            const sixty = daysRemaining * SIXTY_PERCENT;
            const thirty = daysRemaining * THIRTY_PERCENT;
            const attemptDays = sixty + Math.floor(Math.random() * thirty);

            console.log("Will renew certificates in [" + attemptDays + "] days if server doesn't restart");

            ok = attemptDays > 7;
            attemptWhen = attemptDays;

            startedWhen = new Date().getTime();
        } else {
            const timeDiffMilliseconds = new Date().getTime() - startedWhen;
            const daysSince = Math.floor(timeDiffMilliseconds / ONE_DAY_MILLISECONDS);

            ok = daysSince < attemptWhen;  //TODO: if this fails it will try every 12 hours (ssl.js:196) until it succeeds, should probably improve this but apparently its okay
        }
    }

    return ok;
}

function internalCheckChallenges() {
    for (let index = 0; index < pendingChallenges.length; index++) {
        if (pendingChallenges[index].answered === false) {
            return false;
        }
    }

    if (pendingChallenges.length > 0) {
        pendingChallenges = [];
        console.log(REDIRECT_ONLY);
    }

    return true;
}

async function internalCheckAnswered() {
    checkAnswersFlag = false;

    try {
        for (let index = 0; index < pendingChallenges.length; index++) {
            const element = pendingChallenges[index];

            if (pendingChallenges[index].answered === false) {
                await fetch(element.url).then(async (response) => {
                    const record = await response.json();
                    if (record.status === VALID) {
                        console.log(record);
                        pendingChallenges[index].answered = true;
                    }
                    else if (record.status === 404) {
                        pendingChallenges[index].answered = true;
                    }
                });
            }
        }

        internalCheckChallenges();
    } catch (exception) {
        console.error(exception);
    }
}

async function internalGetAcmeKeyChain(sslPath) {
    if (acmeKeyChain === undefined) {
        acmeKeyChain = {};

        if (existsSync(sslPath + PUBLIC_KEY) && existsSync(sslPath + PRIVATE_KEY)) {
            acmeKeyChain.publicKeyRaw = readFileSync(sslPath + PUBLIC_KEY);
            acmeKeyChain.privateKeyRaw = readFileSync(sslPath + PRIVATE_KEY);
            acmeKeyChain.publicKey = await jose.importSPKI(acmeKeyChain.publicKeyRaw.toString(), ALG_ECDSA, { extractable: true });
            acmeKeyChain.privateKey = await jose.importPKCS8(acmeKeyChain.privateKeyRaw.toString(), ALG_ECDSA, { extractable: true });

            console.log("Load ACME Keys From File");

            if (existsSync(sslPath + PUBLIC_KEY_SIGN) && existsSync(sslPath + PRIVATE_KEY_SIGN)) {
                acmeKeyChain.publicKeySignRaw = readFileSync(sslPath + PUBLIC_KEY_SIGN);
                acmeKeyChain.privateKeySignRaw = readFileSync(sslPath + PRIVATE_KEY_SIGN);
                acmeKeyChain.publicKeySign = await jose.importSPKI(acmeKeyChain.publicKeySignRaw.toString(), ALG_ECDSA, { extractable: true });
                acmeKeyChain.privateKeySign = await jose.importPKCS8(acmeKeyChain.privateKeySignRaw.toString(), ALG_ECDSA, { extractable: true });

                console.log("Load Signing Keys From File");
            }
        }
        else {
            console.log("Creating a Key Chain to use for ACME Challenges and CSRs");

            mkdirSync(sslPath, { recursive: true });

            if (true) { // Acme Keys
                const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });
                acmeKeyChain.publicKey = publicKey;
                acmeKeyChain.privateKey = privateKey;
                acmeKeyChain.publicKeyRaw = await jose.exportSPKI(publicKey);
                acmeKeyChain.privateKeyRaw = await jose.exportPKCS8(privateKey);

                writeFileSync(sslPath + PUBLIC_KEY, acmeKeyChain.publicKeyRaw);
                writeFileSync(sslPath + PRIVATE_KEY, acmeKeyChain.privateKeyRaw);

                console.log('ACME Keys saved to File');
            }

            if (true) { // Signing Keys
                const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });

                acmeKeyChain.publicKeySign = publicKey;
                acmeKeyChain.privateKeySign = privateKey;
                acmeKeyChain.publicKeySignRaw = await jose.exportSPKI(publicKey);
                acmeKeyChain.privateKeySignRaw = await jose.exportPKCS8(privateKey);

                writeFileSync(sslPath + PUBLIC_KEY_SIGN, acmeKeyChain.publicKeySignRaw);
                writeFileSync(sslPath + PRIVATE_KEY_SIGN, acmeKeyChain.privateKeySignRaw);

                console.log('Signing Keys saved to File');
            }
        }

        if (jsonWebKey == undefined) {
            const jwk = await acme.createJsonWebKey(acmeKeyChain.publicKey);
            jsonWebKey = jwk.key;
            jsonWebKeyThumbPrint = jwk.print;
        }
    }
}

async function internalLetsEncryptDaemon(fqdns, sslPath, certificateCallback, optStaging, optAutoRestart, countdownHandler, countdownTime) {
    let domains = [];
    let account = undefined;
    let nextNonce = undefined;
    let firstNonce = undefined;
    let authorizations = undefined;

    countdownHandler != undefined && (countdownTime == undefined || countdownTime < 30) && (countdownTime = 30);

    optStaging === true && (acmeDirectory = DIRECTORY_STAGING, console.log("USING THE STAGING SERVER"));

    acmeDirectory = (await acme.newDirectoryAsync(acmeDirectory)).answer.directory;

    if (acmeDirectory === null) {
        console.error("Error getting directory", acmeDirectory.answer.error, acmeDirectory.answer.exception);
        return false;
    }

    firstNonce = await acme.newNonceAsync(acmeDirectory.newNonce);

    if (firstNonce.nonce === undefined) {
        console.error("Error getting nonce", firstNonce.answer.error, firstNonce.answer.exception);
        return false;
    }

    account = await acme.createAccount(firstNonce.nonce, acmeDirectory.newAccount, acmeKeyChain.privateKey, jsonWebKey).catch(console.error);

    if (account.answer.account === null || account.answer.account.status != VALID) {
        console.error("Error creating account", account.answer.error, account.answer.exception);
        return false;
    }

    fqdns.forEach((element) => domains.push({ "type": "dns", "value": element }));

    const order = await acme.createOrder(account.answer.location, account.nonce, acmeKeyChain.privateKey, acmeDirectory.newOrder, domains);

    if (order.answer.order == undefined) {
        console.error("Error getting order", order.answer.error, order.answer.exception);
        return false;
    }

    console.log("Next Nonce", (nextNonce = order.nonce));

    authorizations = order.answer.order.authorizations;

    for (let index = 0; index < authorizations.length; index++) {
        const auth = await acme.postAsGet(account.answer.location, nextNonce, acmeKeyChain.privateKey, authorizations[index]);

        if (auth.answer.get.status) {
            for (let index = 0; index < auth.answer.get.challenges.length; index++) {
                const challenge = auth.answer.get.challenges[index];
                challenge.type == HTTP && (challenge.answered = false, pendingChallenges.push(challenge));
            }

            console.log("Next Nonce", (nextNonce = auth.nonce));
        } else {
            console.error("Error getting auth", auth.answer.error, auth.answer.exception);
        }
    }

    for (let index = 0; index < pendingChallenges.length; index++) {
        if (pendingChallenges[index].type == HTTP && pendingChallenges[index].status == STATUS_PENDING) {
            const auth = await acme.postAsGetChal(account.answer.location, nextNonce, acmeKeyChain.privateKey, pendingChallenges[index].url);
            auth.answer.get.status ? console.log("Next Nonce", (nextNonce = auth.nonce), auth) : console.error("Error getting auth", auth.answer.error, auth.answer.exception);
        }
    }

    return await new Promise(async (resolve) => {
        let finalizedCertificateLocation = null;
        let finalizedLocation = null;
        let finalizedInfo = null;

        await new Promise(async (resolve) => {
            const waitForReady = setInterval(async () => {
                await acme.postAsGet(account.answer.location, nextNonce, acmeKeyChain.privateKey, order.answer.location).then((order) => {
                    nextNonce = order.nonce;

                    if (order.answer.get != undefined && order.answer.get.status == "ready") {
                        finalizedInfo = order.answer.get.finalize;
                        console.log("Ready to Finalize", fqdns);
                        clearInterval(waitForReady);
                        resolve();
                    }
                });
            }, 1500);
        });

        await new Promise(async (resolve) => {
            const waitForFinalize = setInterval(async () => {
                await acme.finalizeOrder(fqdns[0], account.answer.location, nextNonce, acmeKeyChain.privateKey, acmeKeyChain.publicKeySign, acmeKeyChain.privateKeySign, finalizedInfo, fqdns).then((finalized) => {
                    if (finalized.answer.get) {
                        if (finalized.answer.get.status == "processing" || finalized.answer.get.status == VALID) {
                            finalizedLocation = finalized.answer.location;
                            console.log("Certificate Location", finalizedLocation);
                            clearInterval(waitForFinalize);
                            resolve();
                        }
                    }
                    else {
                        console.error("Error getting order", finalized.answer.error, finalized.answer.exception);
                    }

                    console.log("Next Nonce", (nextNonce = finalized.nonce));
                });
            }, 1500);
        });

        console.log("Waiting for Certificate to be Ready for Download");

        await new Promise(async (resolve) => {
            const waitForProcessingValid = setInterval(async () => {
                await acme.postAsGet(account.answer.location, nextNonce, acmeKeyChain.privateKey, finalizedLocation).then((checkFinalized) => {
                    if (checkFinalized.answer.get != undefined && checkFinalized.answer.get.status == VALID) {
                        finalizedCertificateLocation = checkFinalized.answer.get.certificate;
                        console.log("Certificate URL:", finalizedCertificateLocation);
                        clearInterval(waitForProcessingValid);
                        resolve();
                    }

                    console.log("Next Nonce", (nextNonce = checkFinalized.nonce));
                });
            }, 1500);
        });

        const response = await fetch(finalizedCertificateLocation);

        const certificateText = await response.text();

        if (certificateText.startsWith("-----BEGIN CERTIFICATE-----") && (certificateText.endsWith("-----END CERTIFICATE-----\n") || certificateText.endsWith("-----END CERTIFICATE-----") || certificateText.endsWith("-----END CERTIFICATE----- "))) {
            const pks = acmeKeyChain.privateKeySignRaw.toString();

            if (pks.startsWith("-----BEGIN PRIVATE KEY-----") && (pks.endsWith("-----END PRIVATE KEY-----") || pks.endsWith("-----END PRIVATE KEY-----\n") || pks.endsWith("-----END PRIVATE KEY----- "))) {
                console.log("Certificate Downloaded, Saving to file");

                writeFileSync(join(sslPath, "certificate.pem"), certificateText);

                writeFileSync(join(sslPath, "private-key.pem"), acmeKeyChain.privateKeySignRaw);

                writeFileSync(join(sslPath, LAST_CERT_FILE), JSON.stringify({ time: Date.now(), names: fqdns }));

                if (optAutoRestart === true) {
                    console.log("-------");
                    console.log("Auto Restart is Enabled");
                    console.log("Restarting Server when ready...");
                    console.log("-------");

                    if (countdownHandler == undefined) {
                        process.exit(123); // Resolved by exit
                    }
                    else {
                        let count = 0;
                        setInterval(() => (count++, count > countdownTime ? process.exit(123) : countdownHandler()), 1000); // Resolved by exit
                    }
                }
                else if (certificateCallback != undefined) {
                    await new Promise((resolve) => {
                        const certI = setInterval(() => {
                            certificateCallback();
                            clearInterval(certI);
                            internalCheckAnswered();
                            resolve();
                        }, 200);
                    });
                }

                resolve(true);
            }
            else {
                console.error("Something went wrong with the private key, will try again at the usual time"); // todo: generate a new acme key the usual way before the next update
            }
        }
        else {
            console.error("Something went wrong generating the certificate, will try again at the usual time"); // todo: try download the cert again
        }

        resolve(false);
    });
}