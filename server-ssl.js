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

const ONE_DAY_MILLISECONDS = 86400000;

let override = false;
let urlsArray = null;
let autoRestartAvailable = null;

let optPk = null;
let optCert = null;
let optError = null;
let optEntry = null;
let optStaging = null;
let optWebsite = null;
let optDomains = null;
let optLetsEncrypt = null;
let optAutoRestart = null;
let optGenerateAnyway = null;
let optPort = process.env.PORT || 443;
let optPortHttp = process.env.PORT_HTTP || 80;

try {
    loadArguments();

    const __rootDir = dirname(fileURLToPath(import.meta.url));
    const __websiteDir = join(__rootDir, optWebsite);
    const __errorDir = join(__rootDir, optError);

    const __sslFolder = join(__rootDir, "ssl");
    const __pkPath = join(__sslFolder, optPk);
    const __certPath = join(__sslFolder, optCert);

    !existsSync(__sslFolder) && useSslFolder(__sslFolder);
    !existsSync(__pkPath) && certificateNotExist();
    !existsSync(__certPath) && certificateNotExist();

    createServerHTTPS({ key: readFileSync(__pkPath), cert: readFileSync(__certPath) }, (req, res) => {
        let filePath = join(__websiteDir, req.url === '/' ? optEntry : req.url);

        const extname = _extname(filePath);

        let contentType = 'text/html';

        switch (extname) {
            case '.css':
                contentType = 'text/css';
                break;
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.jpg':
                contentType = 'image/jpg';
                break;
            case '.gif':
                contentType = 'image/gif';
                break;
            case '.svg':
                contentType = 'image/svg+xml';
                break;
            case '.ico':
                contentType = 'image/x-icon';
                break;
        }

        readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    readFile(join(__errorDir, '/404.html'), (err404, content404) => {
                        if (err404) {
                            res.writeHead(500);
                            res.end('Server Error');
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/html' });
                            res.end(content404);
                        }
                    });
                } else {
                    readFile(join(__errorDir, '/500.html'), (error500, content500) => {
                        if (error500) {
                            res.writeHead(500);
                            res.end('Server Error');
                        } else {
                            res.writeHead(500, { 'Content-Type': 'text/html' });
                            res.end(content500);
                        }
                    });
                }
                return;
            }

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    }).listen(optPort, (err) => err ? console.error('Error starting server:', err) : console.log(`HTTPS Server is running on port ${optPort}`));

    createServerHTTP((req, res) => {
        if (optLetsEncrypt) { if (checkChallengesMixin(req, res)) { return; } } // Lets Encrypt! HTTP-01 ACME Challenge Mixin
        res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
        res.end();
    }).listen(optPortHttp, () => console.log(`HTTP Server is redirecting requests to ${optPort}`));

    ///////////////// Lets Encrypt! ACME Daemon /////////////////////
    optLetsEncrypt && optDomains !== null && (urlsArray = optDomains.slice(1, -1).split(',').map(url => url.trim()));
    optLetsEncrypt && optGenerateAnyway === true && (optAutoRestart = false, console.log("AutoRestart is set to false because GenerateAnyway is true"));
    optLetsEncrypt && startLetsEncryptDaemon(urlsArray, __sslFolder, optGenerateAnyway, optStaging, optAutoRestart);
    optLetsEncrypt && optAutoRestart && setTimeout(() => startLetsEncryptDaemon(urlsArray, __sslFolder, optGenerateAnyway, optStaging, optAutoRestart), ONE_DAY_MILLISECONDS);
    /////////////////////////////////////////////////////////////////
} catch (exception) {
    console.error(exception);
}

function certificateNotExist() {
    console.log(" ");
    console.log("Certificate and Private Key not found or don't exist, they should be in the ssl folder");
    console.log(" ");
    console.log("You need to generate or provide an SSL Certificate and Private Key in PEM format");
    console.log("You can use the following command from git bash or run start-windows.bat with no arguments");
    console.log(" ");
    console.log('openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ssl/private-key.pem -out ssl/certificate.pem -days 365 -subj "//CN=localhost"');
    process.exit(1);
}

function useSslFolder(sslFolder) {
    mkdir(sslFolder, { recursive: true }, () => { });
    console.log(" ");
    console.log("Put your Certificate and Private Key in the SSL folder that was just created");
    console.log(" ");
    process.exit(1);
}

function loadArguments() {
    process.argv.slice(2).forEach((arg) => {
        let rightSide = arg.split("=")[1];
        arg.includes("--port=") && (optPort = rightSide);
        arg.includes("--portHttp=") && (optPortHttp = rightSide);
        arg.includes("--cert=") && (optCert = rightSide);
        arg.includes("--pk=") && (optPk = rightSide);
        arg.includes("--site=") && (optWebsite = rightSide);
        arg.includes("--error=") && (optError = rightSide);
        arg.includes("--entry=") && (optEntry = rightSide);
        arg.includes("--letsEncrypt") && (optLetsEncrypt = true);
        arg.includes("--domains") && (optDomains = rightSide);
        arg.includes("--generateAnyway") && (optGenerateAnyway = true);
        arg.includes("--staging") && (optStaging = true);
        arg.includes("--autoRestart") && (optAutoRestart = true);
        arg.includes("--arAvailable") && (autoRestartAvailable = true);
        arg.includes("--ok") && (override = true);
    });

    if (autoRestartAvailable == false && override === false) {
        console.log("--------");
        console.log("Server must be started with start-windows.bat to enable auto restart");
        console.log("If you have a way to restart the server on error code 123, use override --ok");
        console.log("--------");
        optAutoRestart = false;
    }

    if (optAutoRestart === true) {
        console.log("--------");
        console.log("Auto Restart Enabled");
        console.log("Server will restart after certificates are renewed");
        console.log("--------");
    }

    !optPk && (optPk = 'private-key.pem');
    !optCert && (optCert = 'certificate.pem');
    !optWebsite && (optWebsite = 'website');
    !optError && (optError = 'error');
    !optEntry && (optEntry = 'index.html');

    if (optLetsEncrypt && optDomains === null) {
        console.log("You must specify at least one domain to use --letsEncrypt");
        optLetsEncrypt = false;
    }
}