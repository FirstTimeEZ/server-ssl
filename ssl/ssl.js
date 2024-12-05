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

import { join, extname as _extname } from 'path';
import { createServer as createServerHTTP } from 'http';
import { readFile, writeFile, existsSync, readFileSync } from 'fs';
import { checkChallengesMixin, startLetsEncryptDaemon } from './acme/lets-encrypt-acme-client.js';

/**
* **SSL-Server** configuration state
*/
export const STATE = {
    // Config
    __rootDir: null,
    __websiteDir: null,
    __sslFolder: null,
    __pkPath: null,
    __certPath: null,
    override: null,
    urlsArray: null,
    isRestartAvailable: null,
    timeRemaining: null,
    daysRemaining: null,
    // Args
    optPk: null,
    optCert: null,
    optError: null,
    optEntry: null,
    optStaging: null,
    optWebsite: null,
    optDomains: null,
    optLetsEncrypt: null,
    optAutoRestart: null,
    optNoAutoUpdate: null,
    optGenerateAnyway: null,
    optPort: process.env.PORT || 443,
    optPortHttp: process.env.PORT_HTTP || 80,
    // Pages
    ERROR_404_PAGE: null,
    ERROR_500_PAGE: null,
    // Consts
    SUCCESS: 200,
    REDIRECT: 301,
    TWELVE_HOURS_MILLISECONDS: 43200000,
    ONE_DAY_MILLISECONDS: 86400000,
    PAGE_NOT_FOUND: 'ENOENT',
    ADDR_IN_USE: 'EADDRINUSE',
    ERROR_NOT_FOUND: '404 - File Not Found',
    ERROR_SERVER: '500 - Server Error',
    ERROR_STARTING: 'Error starting server',
    STARTED_HTTPS: 'HTTPS Server is running on port ',
    STARTED_HTTP: 'HTTP Server is redirecting requests to ',
    WEBSITE_ROOT: '/',
    SSL: "ssl",
    TEXT_HTML: 'text/html',
    CONTENT_TYPE: 'Content-Type',
    HTTPS: 'https://',
    REDIRECT_LOCATION: 'Location',
    IN_USE: " in use, please close whatever is using the port and restart",
    NODE_URL: "https://nodejs.org/dist/latest/win-x64",
    NODE_YES: "Node.js is up to date",
    NODE_NO: "There is a more recent version of Node.js",
    NODE_FIRST: "First time running Node.js",
    NODE_FN: "last_update.ez",
    NODE_VERSION: "v",
    NODE_URL_SPLITS: 7,
    // Methods
    importRequiredArguments: (__rootDir) => {
        process.argv.slice(2).forEach((arg) => {
            let rightSide = arg.split("=")[1];
            // Server
            arg.includes("--port=") && (STATE.optPort = rightSide);
            arg.includes("--portHttp=") && (STATE.optPortHttp = rightSide);
            arg.includes("--cert=") && (STATE.optCert = rightSide);
            arg.includes("--pk=") && (STATE.optPk = rightSide);
            arg.includes("--site=") && (STATE.optWebsite = rightSide);
            arg.includes("--error=") && (STATE.optError = rightSide);
            arg.includes("--entry=") && (STATE.optEntry = rightSide);
            arg.includes("--noAutoUpdate") && (STATE.optNoAutoUpdate = true);
            // Lets Encrypt!
            arg.includes("--domains=") && (STATE.optDomains = rightSide);
            arg.includes("--letsEncrypt") && (STATE.optLetsEncrypt = true);
            arg.includes("--generateAnyway") && (STATE.optGenerateAnyway = true);
            arg.includes("--autoRestart") && (STATE.optAutoRestart = true);
            arg.includes("--staging") && (STATE.optStaging = true);
            // Internal
            arg.includes("--notAfter=") && (STATE.expireDate = rightSide);
            arg.includes("--arAvailable") && (STATE.isRestartAvailable = true);
            arg.includes("--ok") && (STATE.override = true);
        });

        if (STATE.optLetsEncrypt === true) {
            STATE.optDomains === null && (console.log("You must specify at least one domain to use --letsEncrypt"), STATE.optLetsEncrypt = null, STATE.optAutoRestart = false);

            if (STATE.optLetsEncrypt !== null && STATE.optAutoRestart === true) {
                STATE.isRestartAvailable === null && STATE.override === null && (console.log("--------"), console.log("Server must be started with start-windows.bat to enable lets encrypt auto restart at this time"), console.log("If you have a way to restart the server on error code 123, use override --ok"), console.log("--------"), STATE.optAutoRestart = false);
                console.log("--------"), console.log("Auto Restart Enabled"), console.log("Server will restart after certificates are renewed"), console.log("--------");
            }
        }

        !STATE.optPk && (STATE.optPk = 'private-key.pem');
        !STATE.optCert && (STATE.optCert = 'certificate.pem');
        !STATE.optWebsite && (STATE.optWebsite = 'website');
        !STATE.optError && (STATE.optError = 'error');
        !STATE.optEntry && (STATE.optEntry = 'index.html');

        STATE.expireDate && STATE.timeUntilRenew(STATE.expireDate);

        const SSL = join(__rootDir, STATE.SSL);
        const PK = join(SSL, STATE.optPk);
        const CERT = join(SSL, STATE.optCert);

        !existsSync(PK) && STATE.certNotExist();
        !existsSync(CERT) && STATE.certNotExist();

        STATE.loadErrorPages(join(__rootDir, STATE.optError));
        STATE.__rootDir = __rootDir;
        STATE.__websiteDir = join(__rootDir, STATE.optWebsite);
        STATE.__sslFolder = SSL;
        STATE.__pkPath = PK;
        STATE.__certPath = CERT;

        return STATE.__websiteDir;
    },
    certNotExist: () => {
        console.log(" ");
        console.log("Certificate and Private Key not found or don't exist, they should be in the ssl folder");
        console.log(" ");
        console.log("You need to generate or provide an SSL Certificate and Private Key in PEM format");
        console.log("You can use the following command from git bash or run start-windows.bat with no arguments");
        console.log(" ");
        console.log('openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ssl/private-key.pem -out ssl/certificate.pem -days 365 -subj "//CN=localhost"');
        process.exit(1);
    },
    getErrorPage: (res, err) => {
        res.writeHead(err.code === STATE.PAGE_NOT_FOUND ? 404 : 500);
        res.end(err.code === STATE.PAGE_NOT_FOUND
            ? (STATE.ERROR_404_PAGE !== null ? STATE.ERROR_404_PAGE : STATE.ERROR_NOT_FOUND)
            : (STATE.ERROR_500_PAGE !== null ? STATE.ERROR_500_PAGE : STATE.ERROR_SERVER));
    },
    loadErrorPages: (__errorDir) => {
        readFile(join(__errorDir, '/404.html'), (err404, content404) => !err404 && (STATE.ERROR_404_PAGE = content404));
        readFile(join(__errorDir, '/500.html'), (err500, content500) => !err500 && (STATE.ERROR_500_PAGE = content500));
    },
    loadNewSecureContext: (server) => {
        const key = readFileSync(STATE.__pkPath);
        const cert = readFileSync(STATE.__certPath);

        const keyString = key.toString();
        const certString = cert.toString();

        if (!certString.startsWith("-----BEGIN CERTIFICATE-----") || !(certString.endsWith("-----END CERTIFICATE-----\n") || certString.endsWith("-----END CERTIFICATE-----") || certString.endsWith("-----END CERTIFICATE----- "))) {
            console.error("SOMETHING IS WRONG WITH THE NEW CERTIFICATE, THIS IS UNUSUAL");
            // todo: this shouldn't happen but if it does then certificates need to be generated
            return false;
        }

        if (!keyString.startsWith("-----BEGIN PRIVATE KEY-----") || !(keyString.endsWith("-----END PRIVATE KEY-----") || keyString.endsWith("-----END PRIVATE KEY-----\n") || keyString.endsWith("-----END PRIVATE KEY----- "))) {
            console.error("SOMETHING IS WRONG WITH THE PRIVATE KEY, THIS IS UNUSUAL");
            // todo: this shouldn't happen but if it does then a new private key needs to be generated
            return false;
        }

        server.setSecureContext({ key: readFileSync(STATE.__pkPath), cert: readFileSync(STATE.__certPath) });
        console.log("Updated Server Certificate");

        return true;
    },
    loadDefaultSecureContext: () => {
        return { key: readFileSync(STATE.__pkPath), cert: readFileSync(STATE.__certPath) }
    },
    timeUntilRenew: (notAfter) => {
        const specificDate = new Date(notAfter);
        const currentDate = new Date();

        STATE.timeRemaining = specificDate.getTime() - currentDate.getTime();
        STATE.daysRemaining = Math.floor(STATE.timeRemaining / (1000 * 60 * 60 * 24));
        const hoursRemaining = Math.floor((STATE.timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((STATE.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`Time until renewal required: ${STATE.daysRemaining} days, ${hoursRemaining} hours, ${minutesRemaining} minutes`);
    },
    extractDomainsAnyFormat: (input) => {
        const bracketsRemoved = String(input).trim().replace(/[\[\]]/g, '');
        const commaSplit = bracketsRemoved.split(',').map(d => d.trim().replace(/^['"]|['"]$/g, ''));
        return commaSplit.length > 0 && commaSplit[0] ? commaSplit : domains;
    },
    checkNodeForUpdates: async () => {
        if (STATE.optNoAutoUpdate !== true) {
            try {
                const current = (await fetch(STATE.NODE_URL, { method: 'GET', redirect: 'follow' })).url

                if (current != undefined) {
                    const split = current.split("/");

                    if (split.length === STATE.NODE_URL_SPLITS) {
                        for (let index = 0; index < split.length; index++) {
                            const dist = split[index];

                            if (dist[0] === STATE.NODE_VERSION) {
                                const updatePath = join(STATE.__sslFolder, STATE.NODE_FN);

                                if (existsSync(updatePath)) {
                                    const lastUpdate = JSON.parse(readFileSync(updatePath));

                                    if (lastUpdate != undefined) {
                                        const lastVersion = lastUpdate.version;

                                        if (lastVersion === dist) {
                                            console.log(STATE.NODE_YES, dist);
                                        }
                                        else {
                                            console.log(STATE.NODE_NO, dist);
                                            // Update Required
                                        }
                                    }
                                } else {
                                    console.log(STATE.NODE_FIRST, dist);

                                    writeFile(updatePath, JSON.stringify({ version: dist }), () => { });
                                }
                            }
                        }
                    }
                }
            } catch {
                console.log("Could not determine if Node.js version is recent");
            }
        }
    },
    loadLetsEncryptAcmeDaemon: (countdownHandler, countdownTime, certificateCallback) => {
        STATE.optLetsEncrypt && STATE.optDomains !== null && (STATE.urlsArray = STATE.extractDomainsAnyFormat(STATE.optDomains));
        STATE.optLetsEncrypt && STATE.optGenerateAnyway === true && (STATE.optAutoRestart = false, console.log("AutoRestart is set to false because GenerateAnyway is true"));
        STATE.optLetsEncrypt && startLetsEncryptDaemon(STATE.urlsArray, STATE.__sslFolder, STATE.daysRemaining, certificateCallback, STATE.optGenerateAnyway, STATE.optStaging, STATE.optAutoRestart, countdownHandler, countdownTime);
        STATE.optLetsEncrypt && setInterval(() => startLetsEncryptDaemon(STATE.urlsArray, STATE.__sslFolder, STATE.daysRemaining, certificateCallback, STATE.optGenerateAnyway, STATE.optStaging, STATE.optAutoRestart, countdownHandler, countdownTime), STATE.TWELVE_HOURS_MILLISECONDS);
    },
    redirect: (res, req) => {
        res.writeHead(STATE.REDIRECT, { [STATE.REDIRECT_LOCATION]: `${STATE.HTTPS}${req.headers.host}${req.url}` });
        res.end();
    },
    startHttpChallengeListener: () => {
        createServerHTTP((req, res) => STATE.optLetsEncrypt ? !checkChallengesMixin(req, res) && STATE.redirect(res, req) : STATE.redirect(res, req))
            .on('error', (e) => e.code === STATE.ADDR_IN_USE && console.error(`${STATE.optPortHttp}${STATE.IN_USE}`))
            .listen(STATE.optPortHttp, () => console.log(`${STATE.STARTED_HTTP}${STATE.optPort}`)); // Lets Encrypt! HTTP-01 ACME Challenge Mixin - Always Redirect HTTP to HTTPS unless doing a ACME Challenge
    },
    defaultFileHandling: (res, route, contentTypes) => {
        const fileExtension = _extname(route);

        let contentType = contentTypes[fileExtension];
        !contentType && (contentType = STATE.TEXT_HTML);

        readFile(route, (err, content) => {
            if (!err) {
                res.writeHead(STATE.SUCCESS, { [STATE.CONTENT_TYPE]: contentType });
                res.end(content);
            }
            else {
                STATE.getErrorPage(res, err);
            }
        });
    },
    respondWithContent: (res, content, contentType) => {
        res.writeHead(STATE.SUCCESS, { [STATE.CONTENT_TYPE]: contentType });
        res.end(content);
    },
    respondWithNotFound: (res) => {
        res.writeHead(404);
        res.end(STATE.ERROR_404_PAGE !== null ? STATE.ERROR_404_PAGE : STATE.ERROR_NOT_FOUND);
    },
    respondWithServerError: (res) => {
        res.writeHead(500);
        res.end(STATE.ERROR_500_PAGE !== null ? STATE.ERROR_500_PAGE : STATE.ERROR_SERVER);
    },
    finishRoute: (...args) => {
        return join(STATE.__websiteDir, ...args);;
    }
}