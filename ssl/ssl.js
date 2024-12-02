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
import { startLetsEncryptDaemon } from './module/lets-encrypt-acme-client.js';
import { checkChallengesMixin } from './module/lets-encrypt-acme-client.js';

/**
* **SSL-Server** configuration state
*/
export const S_SSL = {
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
            arg.includes("--port=") && (S_SSL.optPort = rightSide);
            arg.includes("--portHttp=") && (S_SSL.optPortHttp = rightSide);
            arg.includes("--cert=") && (S_SSL.optCert = rightSide);
            arg.includes("--pk=") && (S_SSL.optPk = rightSide);
            arg.includes("--site=") && (S_SSL.optWebsite = rightSide);
            arg.includes("--error=") && (S_SSL.optError = rightSide);
            arg.includes("--entry=") && (S_SSL.optEntry = rightSide);
            arg.includes("--noAutoUpdate") && (S_SSL.optNoAutoUpdate = true);
            // Lets Encrypt!
            arg.includes("--domains=") && (S_SSL.optDomains = rightSide);
            arg.includes("--letsEncrypt") && (S_SSL.optLetsEncrypt = true);
            arg.includes("--generateAnyway") && (S_SSL.optGenerateAnyway = true);
            arg.includes("--autoRestart") && (S_SSL.optAutoRestart = true);
            arg.includes("--staging") && (S_SSL.optStaging = true);
            // Internal
            arg.includes("--notAfter=") && (S_SSL.expireDate = rightSide);
            arg.includes("--arAvailable") && (S_SSL.isRestartAvailable = true);
            arg.includes("--ok") && (S_SSL.override = true);
        });

        if (S_SSL.optLetsEncrypt === true) {
            S_SSL.optDomains === null && (console.log("You must specify at least one domain to use --letsEncrypt"), S_SSL.optLetsEncrypt = null, S_SSL.optAutoRestart = false);

            if (S_SSL.optLetsEncrypt !== null && S_SSL.optAutoRestart === true) {
                S_SSL.isRestartAvailable === null && S_SSL.override === null && (console.log("--------"), console.log("Server must be started with start-windows.bat to enable lets encrypt auto restart at this time"), console.log("If you have a way to restart the server on error code 123, use override --ok"), console.log("--------"), S_SSL.optAutoRestart = false);
                console.log("--------"), console.log("Auto Restart Enabled"), console.log("Server will restart after certificates are renewed"), console.log("--------");
            }
        }

        !S_SSL.optPk && (S_SSL.optPk = 'private-key.pem');
        !S_SSL.optCert && (S_SSL.optCert = 'certificate.pem');
        !S_SSL.optWebsite && (S_SSL.optWebsite = 'website');
        !S_SSL.optError && (S_SSL.optError = 'error');
        !S_SSL.optEntry && (S_SSL.optEntry = 'index.html');

        S_SSL.expireDate && S_SSL.timeUntilRenew(S_SSL.expireDate);

        const SSL = join(__rootDir, S_SSL.SSL);
        const PK = join(SSL, S_SSL.optPk);
        const CERT = join(SSL, S_SSL.optCert);

        !existsSync(PK) && S_SSL.certNotExist();
        !existsSync(CERT) && S_SSL.certNotExist();

        S_SSL.loadErrorPages(join(__rootDir, S_SSL.optError));
        S_SSL.__rootDir = __rootDir;
        S_SSL.__websiteDir = join(__rootDir, S_SSL.optWebsite);
        S_SSL.__sslFolder = SSL;
        S_SSL.__pkPath = PK;
        S_SSL.__certPath = CERT;

        return S_SSL.__websiteDir;
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
        res.writeHead(err.code === S_SSL.PAGE_NOT_FOUND ? 404 : 500);
        res.end(err.code === S_SSL.PAGE_NOT_FOUND
            ? (S_SSL.ERROR_404_PAGE !== null ? S_SSL.ERROR_404_PAGE : S_SSL.ERROR_NOT_FOUND)
            : (S_SSL.ERROR_500_PAGE !== null ? S_SSL.ERROR_500_PAGE : S_SSL.ERROR_SERVER));
    },
    loadErrorPages: (__errorDir) => {
        readFile(join(__errorDir, '/404.html'), (err404, content404) => !err404 && (S_SSL.ERROR_404_PAGE = content404));
        readFile(join(__errorDir, '/500.html'), (err500, content500) => !err500 && (S_SSL.ERROR_500_PAGE = content500));
    },
    loadNewSecureContext: (server) => {
        const key = readFileSync(S_SSL.__pkPath);
        const cert = readFileSync(S_SSL.__certPath);

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

        server.setSecureContext({ key: readFileSync(S_SSL.__pkPath), cert: readFileSync(S_SSL.__certPath) });
        console.log("Updated Server Certificate");

        return true;
    },
    loadDefaultSecureContext: () => {
        return { key: readFileSync(S_SSL.__pkPath), cert: readFileSync(S_SSL.__certPath) }
    },
    timeUntilRenew: (notAfter) => {
        const specificDate = new Date(notAfter);
        const currentDate = new Date();

        S_SSL.timeRemaining = specificDate.getTime() - currentDate.getTime();
        S_SSL.daysRemaining = Math.floor(S_SSL.timeRemaining / (1000 * 60 * 60 * 24));
        const hoursRemaining = Math.floor((S_SSL.timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((S_SSL.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`Time until renewal required: ${S_SSL.daysRemaining} days, ${hoursRemaining} hours, ${minutesRemaining} minutes`);
    },
    extractDomainsAnyFormat: (input) => {
        const bracketsRemoved = String(input).trim().replace(/[\[\]]/g, '');
        const commaSplit = bracketsRemoved.split(',').map(d => d.trim().replace(/^['"]|['"]$/g, ''));
        return commaSplit.length > 0 && commaSplit[0] ? commaSplit : domains;
    },
    checkNodeForUpdates: async () => {
        if (S_SSL.optNoAutoUpdate !== true) {
            try {
                const current = (await fetch(S_SSL.NODE_URL, { method: 'GET', redirect: 'follow' })).url

                if (current != undefined) {
                    const split = current.split("/");

                    if (split.length === S_SSL.NODE_URL_SPLITS) {
                        for (let index = 0; index < split.length; index++) {
                            const dist = split[index];

                            if (dist[0] === S_SSL.NODE_VERSION) {
                                const updatePath = join(S_SSL.__sslFolder, S_SSL.NODE_FN);

                                if (existsSync(updatePath)) {
                                    const lastUpdate = JSON.parse(readFileSync(updatePath));

                                    if (lastUpdate != undefined) {
                                        const lastVersion = lastUpdate.version;

                                        if (lastVersion === dist) {
                                            console.log(S_SSL.NODE_YES, dist);
                                        }
                                        else {
                                            console.log(S_SSL.NODE_NO, dist);
                                            // Update Required
                                        }
                                    }
                                } else {
                                    console.log(S_SSL.NODE_FIRST, dist);

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
        S_SSL.optLetsEncrypt && S_SSL.optDomains !== null && (S_SSL.urlsArray = S_SSL.extractDomainsAnyFormat(S_SSL.optDomains));
        S_SSL.optLetsEncrypt && S_SSL.optGenerateAnyway === true && (S_SSL.optAutoRestart = false, console.log("AutoRestart is set to false because GenerateAnyway is true"));
        S_SSL.optLetsEncrypt && startLetsEncryptDaemon(S_SSL.urlsArray, S_SSL.__sslFolder, S_SSL.daysRemaining, certificateCallback, S_SSL.optGenerateAnyway, S_SSL.optStaging, S_SSL.optAutoRestart, countdownHandler, countdownTime);
        S_SSL.optLetsEncrypt && setInterval(() => startLetsEncryptDaemon(S_SSL.urlsArray, S_SSL.__sslFolder, S_SSL.daysRemaining, certificateCallback, S_SSL.optGenerateAnyway, S_SSL.optStaging, S_SSL.optAutoRestart, countdownHandler, countdownTime), S_SSL.TWELVE_HOURS_MILLISECONDS);
    },
    redirect: (res, req) => {
        res.writeHead(S_SSL.REDIRECT, { [S_SSL.REDIRECT_LOCATION]: `${S_SSL.HTTPS}${req.headers.host}${req.url}` });
        res.end();
    },
    startHttpChallengeListener: () => {
        createServerHTTP((req, res) => S_SSL.optLetsEncrypt ? !checkChallengesMixin(req, res) && S_SSL.redirect(res, req) : S_SSL.redirect(res, req))
            .on('error', (e) => e.code === S_SSL.ADDR_IN_USE && console.error(`${S_SSL.optPortHttp}${S_SSL.IN_USE}`))
            .listen(S_SSL.optPortHttp, () => console.log(`${S_SSL.STARTED_HTTP}${S_SSL.optPort}`)); // Lets Encrypt! HTTP-01 ACME Challenge Mixin - Always Redirect HTTP to HTTPS unless doing a ACME Challenge
    },
    defaultFileHandling: (res, route, contentTypes) => {
        const fileExtension = _extname(route);

        let contentType = contentTypes[fileExtension];
        !contentType && (contentType = S_SSL.TEXT_HTML);

        readFile(route, (err, content) => {
            if (!err) {
                res.writeHead(S_SSL.SUCCESS, { [S_SSL.CONTENT_TYPE]: contentType });
                res.end(content);
            }
            else {
                S_SSL.getErrorPage(res, err);
            }
        });
    },
    respondWithContent: (res, content, contentType) => {
        res.writeHead(S_SSL.SUCCESS, { [S_SSL.CONTENT_TYPE]: contentType });
        res.end(content);
    },
    respondWithNotFound: (res) => {
        res.writeHead(404);
        res.end(S_SSL.ERROR_404_PAGE !== null ? S_SSL.ERROR_404_PAGE : S_SSL.ERROR_NOT_FOUND);
    },
    respondWithServerError: (res) => {
        res.writeHead(500);
        res.end(S_SSL.ERROR_500_PAGE !== null ? S_SSL.ERROR_500_PAGE : S_SSL.ERROR_SERVER);
    },
    finishRoute: (...args) => {
        return join(S_SSL.__websiteDir, ...args);;
    }
}