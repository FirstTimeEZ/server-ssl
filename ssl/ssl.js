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

import { readFile, mkdir } from 'fs';
import { join, extname as _extname } from 'path';
import { startLetsEncryptDaemon } from './module/lets-encrypt-acme-client.js'

export const S_SSL = {
    // Config
    override: null,
    urlsArray: null,
    isRestartAvailable: null,
    timeDifference: null,
    daysDifference: null,
    // Args
    optPk: null,
    optCert: null,
    optError: null,
    optEntry: null,
    optStaging: null,
    optWebsite: null,
    optDomains: null,
    optLetsEncrypt: null,
    optNoAutoRestart: null,
    optNoAutoUpdate: null,
    optGenerateAnyway: null,
    optPort: process.env.PORT || 443,
    optPortHttp: process.env.PORT_HTTP || 80,
    // Methods
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
    useSslFolder: (sslFolder) => {
        mkdir(sslFolder, { recursive: true }, () => { });
        console.log(" ");
        console.log("Put your Certificate and Private Key in the SSL folder that was just created");
        console.log(" ");
        process.exit(1);
    },
    loadErrorPages: (__errorDir) => {
        readFile(join(__errorDir, '/404.html'), (err404, content404) => !err404 && (S_SSL.ERROR_404_PAGE = content404));
        readFile(join(__errorDir, '/500.html'), (err500, content500) => !err500 && (S_SSL.ERROR_500_PAGE = content500));
    },
    timeUntilRenew: (notAfter) => {
        const specificDate = new Date(notAfter);
        const currentDate = new Date();

        S_SSL.timeDifference = specificDate.getTime() - currentDate.getTime();
        S_SSL.daysDifference = Math.floor(S_SSL.timeDifference / (1000 * 60 * 60 * 24));
        const hoursDifference = Math.floor((S_SSL.timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesDifference = Math.floor((S_SSL.timeDifference % (1000 * 60 * 60)) / (1000 * 60));
        const secondsDifference = Math.floor((S_SSL.timeDifference % (1000 * 60)) / 1000);

        console.log(`Time until renewal required: ${S_SSL.daysDifference} days, ${hoursDifference} hours, ${minutesDifference} minutes, ${secondsDifference} seconds`);
    },
    // Pages
    ERROR_404_PAGE: null,
    ERROR_500_PAGE: null,
    // Consts
    SUCCESS: 200,
    REDIRECT: 301,
    TWELVE_HOURS_MILLISECONDS: 43200000,
    ONE_DAY_MILLISECONDS: 86400000,
    PAGE_NOT_FOUND: 'ENOENT',
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
}

export function importRequiredArguments() {
    process.argv.slice(2).forEach((arg) => {
        let rightSide = arg.split("=")[1];
        arg.includes("--port=") && (S_SSL.optPort = rightSide);
        arg.includes("--portHttp=") && (S_SSL.optPortHttp = rightSide);
        arg.includes("--cert=") && (S_SSL.optCert = rightSide);
        arg.includes("--pk=") && (S_SSL.optPk = rightSide);
        arg.includes("--site=") && (S_SSL.optWebsite = rightSide);
        arg.includes("--error=") && (S_SSL.optError = rightSide);
        arg.includes("--entry=") && (S_SSL.optEntry = rightSide);
        arg.includes("--notAfter=") && (S_SSL.expireDate = rightSide);

        arg.includes("--letsEncrypt") && (S_SSL.optLetsEncrypt = true);
        arg.includes("--domains") && (S_SSL.optDomains = rightSide);
        arg.includes("--generateAnyway") && (S_SSL.optGenerateAnyway = true);
        arg.includes("--staging") && (S_SSL.optStaging = true);
        arg.includes("--noAutoRestart") && (S_SSL.optNoAutoRestart = true);
        arg.includes("--noAutoUpdate") && (S_SSL.optNoAutoUpdate = true);
        arg.includes("--arAvailable") && (S_SSL.isRestartAvailable = true);
        arg.includes("--ok") && (S_SSL.override = true);
    });

    S_SSL.isRestartAvailable === null && S_SSL.override === null && (console.log("--------"), console.log("Server must be started with start-windows.bat to enable auto restart"), console.log("If you have a way to restart the server on error code 123, use override --ok"), console.log("--------"), S_SSL.optNoAutoRestart = true);
    S_SSL.isRestartAvailable === true && S_SSL.optNoAutoRestart === true && (console.log("--------"), console.log("Auto Restart Disabled"), console.log("Auto Restart is Available but you have deliberately disabled it"), console.log("--------"));
    S_SSL.optNoAutoRestart === null && (console.log("--------"), console.log("Auto Restart Enabled"), console.log("Server will restart after certificates are renewed"), console.log("--------"));
    S_SSL.optLetsEncrypt === true && S_SSL.optDomains === null && (console.log("You must specify at least one domain to use --letsEncrypt"), S_SSL.optLetsEncrypt = null);

    !S_SSL.optPk && (S_SSL.optPk = 'private-key.pem');
    !S_SSL.optCert && (S_SSL.optCert = 'certificate.pem');
    !S_SSL.optWebsite && (S_SSL.optWebsite = 'website');
    !S_SSL.optError && (S_SSL.optError = 'error');
    !S_SSL.optEntry && (S_SSL.optEntry = 'index.html');

    S_SSL.expireDate && S_SSL.timeUntilRenew(S_SSL.expireDate);
}

/**
 * Starts the Let's Encrypt daemon to manage SSL certificates.
 *
 * @param {string} sslFolder - The path where the public and private keys will be stored/loaded from.
 * @param {function} countdownHandler - (optional) paramterless function that will fire every second during the restart count down
 * @param {function} countdownTime - (optional) how long in seconds to countdown before restarting, default 30 seconds
 */
export function loadLetsEncryptDaemon(sslFolder, countdownHandler, countdownTime) {
    S_SSL.optLetsEncrypt && S_SSL.optDomains !== null && (S_SSL.urlsArray = extractDomainsAnyFormat(S_SSL.optDomains));
    S_SSL.optLetsEncrypt && S_SSL.optGenerateAnyway === true && (S_SSL.optNoAutoRestart = true, console.log("AutoRestart is set to false because GenerateAnyway is true"));
    S_SSL.optLetsEncrypt && startLetsEncryptDaemon(S_SSL.urlsArray, sslFolder, S_SSL.optGenerateAnyway, S_SSL.optStaging, S_SSL.optNoAutoRestart, S_SSL.daysDifference, countdownHandler, countdownTime);
    S_SSL.optLetsEncrypt && setInterval(() => startLetsEncryptDaemon(S_SSL.urlsArray, sslFolder, S_SSL.optGenerateAnyway, S_SSL.optStaging, S_SSL.optNoAutoRestart, S_SSL.daysDifference, countdownHandler, countdownTime), S_SSL.TWELVE_HOURS_MILLISECONDS);
}

export async function checkNodeForUpdates() {
    if (S_SSL.optNoAutoUpdate === true) {
        const current = (await fetch("https://nodejs.org/dist/latest/win-x64", { method: 'GET', redirect: 'follow' })).url

        if (current != undefined) {
            console.log("Current Dist:", current);
            const split = current.split("/");

            if (split.length === 7) {
                for (let index = 0; index < split.length; index++) {
                    if (split[index][0] === "v") {
                        console.log(split[index]);
                    }
                }
            }
        }
    }
}

//['www.ssl.boats','ssl.boats']
//["www.ssl.boats","ssl.boats"]
//[www.ssl.boats,ssl.boats]
function extractDomainsAnyFormat(input) {
    const str = String(input).trim();
    const domainRegex = /'([^']+)'|"([^"]+)"/g;
    const domains = [];

    let match;
    while ((match = domainRegex.exec(str)) !== null) {
        const domain = match[1] || match[2];
        if (domain) domains.push(domain);
    }

    if (domains.length === 0) {
        const bracketsRemoved = str.replace(/[\[\]]/g, '');
        const commaSplit = bracketsRemoved.split(',')
            .map(d => d.trim().replace(/^['"]|['"]$/g, ''));

        if (commaSplit.length > 0 && commaSplit[0]) {
            return commaSplit;
        }
    }

    return domains;
}