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

import { fileURLToPath } from 'url';
import { createServer as createServerHTTPS } from 'https';
import { createServer as createServerHTTP } from 'http';
import { readFile, readFileSync, existsSync, mkdir } from 'fs';
import { join, extname as _extname, dirname } from 'path';
import { startLetsEncryptDaemon, checkChallengesMixin } from './ssl/module/lets-encrypt-acme-client.js'

const S_SSL = {
    // Config
    override: false,
    urlsArray: null,
    autoRestartAvailable: null,
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
    // Pages
    ERROR_404_PAGE: null,
    ERROR_500_PAGE: null,
    // Consts
    SUCCESS: 200,
    REDIRECT: 301,
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

const CONTENT_TYPES = {
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

try {
    loadArguments();

    const __rootDir = dirname(fileURLToPath(import.meta.url));
    const __websiteDir = join(__rootDir, S_SSL.optWebsite);
    const __errorDir = join(__rootDir, S_SSL.optError);

    const __sslFolder = join(__rootDir, S_SSL.SSL);
    const __pkPath = join(__sslFolder, S_SSL.optPk);
    const __certPath = join(__sslFolder, S_SSL.optCert);

    !existsSync(__sslFolder) && S_SSL.useSslFolder(__sslFolder);
    !existsSync(__pkPath) && S_SSL.certNotExist();
    !existsSync(__certPath) && S_SSL.certNotExist();

    S_SSL.loadErrorPages(__errorDir);

    createServerHTTPS({ key: readFileSync(__pkPath), cert: readFileSync(__certPath) }, (req, res) => {
        const filePath = join(__websiteDir, req.url === S_SSL.WEBSITE_ROOT ? S_SSL.optEntry : req.url);
        const fileExtension = _extname(filePath);

        let contentType = CONTENT_TYPES[fileExtension];
        !contentType && (contentType = S_SSL.TEXT_HTML);

        readFile(filePath, (err, content) => !err
            ? (res.writeHead(S_SSL.SUCCESS, { [S_SSL.CONTENT_TYPE]: contentType }), res.end(content))
            : (res.end(err.code === S_SSL.PAGE_NOT_FOUND
                ? (S_SSL.ERROR_404_PAGE !== null ? S_SSL.ERROR_404_PAGE : S_SSL.ERROR_NOT_FOUND)
                : (S_SSL.ERROR_500_PAGE !== null ? S_SSL.ERROR_500_PAGE : S_SSL.ERROR_SERVER))));
    }).listen(S_SSL.optPort, (err) => err ? console.error(S_SSL.ERROR_STARTING, err) : console.log(`${S_SSL.STARTED_HTTPS}${S_SSL.optPort}`));

    createServerHTTP((req, res) => {
        if (S_SSL.optLetsEncrypt) { if (checkChallengesMixin(req, res)) { return; } } // Lets Encrypt! HTTP-01 ACME Challenge Mixin
        res.writeHead(S_SSL.REDIRECT, { [S_SSL.REDIRECT_LOCATION]: `${S_SSL.HTTPS}${req.headers.host}${req.url}` });
        res.end();
    }).listen(S_SSL.optPortHttp, () => console.log(`${S_SSL.STARTED_HTTP}${S_SSL.optPort}`));

    ///////////////// Lets Encrypt! ACME Daemon /////////////////////
    S_SSL.optLetsEncrypt && S_SSL.optDomains !== null && (S_SSL.urlsArray = S_SSL.optDomains.slice(1, -1).split(',').map(url => url.trim()));
    S_SSL.optLetsEncrypt && S_SSL.optGenerateAnyway === true && (S_SSL.optAutoRestart = false, console.log("AutoRestart is set to false because GenerateAnyway is true"));
    S_SSL.optLetsEncrypt && startLetsEncryptDaemon(S_SSL.urlsArray, __sslFolder, S_SSL.optGenerateAnyway, S_SSL.optStaging, S_SSL.optAutoRestart);
    S_SSL.optLetsEncrypt && S_SSL.optAutoRestart && setTimeout(() => startLetsEncryptDaemon(S_SSL.urlsArray, __sslFolder, S_SSL.optGenerateAnyway, S_SSL.optStaging, S_SSL.optAutoRestart), S_SSL.ONE_DAY_MILLISECONDS);
    /////////////////////////////////////////////////////////////////
} catch (exception) {
    console.error(exception);
}

function loadArguments() {
    process.argv.slice(2).forEach((arg) => {
        let rightSide = arg.split("=")[1];
        arg.includes("--port=") && (S_SSL.optPort = rightSide);
        arg.includes("--portHttp=") && (S_SSL.optPortHttp = rightSide);
        arg.includes("--cert=") && (S_SSL.optCert = rightSide);
        arg.includes("--pk=") && (S_SSL.optPk = rightSide);
        arg.includes("--site=") && (S_SSL.optWebsite = rightSide);
        arg.includes("--error=") && (S_SSL.optError = rightSide);
        arg.includes("--entry=") && (S_SSL.optEntry = rightSide);
        arg.includes("--letsEncrypt") && (S_SSL.optLetsEncrypt = true);
        arg.includes("--domains") && (S_SSL.optDomains = rightSide);
        arg.includes("--generateAnyway") && (S_SSL.optGenerateAnyway = true);
        arg.includes("--staging") && (S_SSL.optStaging = true);
        arg.includes("--autoRestart") && (S_SSL.optAutoRestart = true);
        arg.includes("--arAvailable") && (S_SSL.autoRestartAvailable = true);
        arg.includes("--ok") && (S_SSL.override = true);
    });

    if (S_SSL.autoRestartAvailable == false && S_SSL.override === false) {
        console.log("--------");
        console.log("Server must be started with start-windows.bat to enable auto restart");
        console.log("If you have a way to restart the server on error code 123, use override --ok");
        console.log("--------");
        S_SSL.optAutoRestart = false;
    }

    if (S_SSL.optAutoRestart === true) {
        console.log("--------");
        console.log("Auto Restart Enabled");
        console.log("Server will restart after certificates are renewed");
        console.log("--------");
    }

    !S_SSL.optPk && (S_SSL.optPk = 'private-key.pem');
    !S_SSL.optCert && (S_SSL.optCert = 'certificate.pem');
    !S_SSL.optWebsite && (S_SSL.optWebsite = 'website');
    !S_SSL.optError && (S_SSL.optError = 'error');
    !S_SSL.optEntry && (S_SSL.optEntry = 'index.html');

    if (S_SSL.optLetsEncrypt && S_SSL.optDomains === null) {
        console.log("You must specify at least one domain to use --letsEncrypt");
        S_SSL.optLetsEncrypt = false;
    }
}