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
import { readFile, existsSync, readFileSync, mkdirSync } from 'fs';
import { fetchAndRetryUntilOk } from 'base-acme-client';
import { runCommandSync } from 'simple-open-ssl';
import LetsEncryptDaemon from 'lets-encrypt-acme-client';

/**
* **SSL-Server** configuration state
*/
export const STATE = {
    // LetsEncrypt! Daemon
    __daemon: new LetsEncryptDaemon(),
    // Config
    __rootDir: null,
    __websiteDir: null,
    __sslFolder: null,
    __pkPath: null,
    __certPath: null,
    urlsArray: null,
    packageJson: null,
    // Args
    optPk: null,
    optCert: null,
    optError: null,
    optEntry: null,
    optStaging: null,
    optWebsite: null,
    optDomains: null,
    optLetsEncrypt: null,
    optNoVersionCheck: null,
    optGenerateAnyway: null,
    optPort: process.env.PORT || 443,
    optPortHttp: process.env.PORT_HTTP || 80,
    // DNS Provider Config
    optUseDnsProvider: null,
    optProviderName: null,
    optProviderToken: null,
    optProviderZone: null,
    // Pages
    ERROR_404_PAGE: null,
    ERROR_500_PAGE: null,
    // Consts
    SUCCESS: 200,
    REDIRECT: 301,
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
    NODE_VERSION: "v",
    NODE_URL_SPLITS: 7,
    // Methods
    importRequiredArguments: (__rootDir) => {
        let configFile = null;

        process.argv.slice(2).forEach((arg) => {
            arg.includes("--config=") && (configFile = arg.split("=")[1]);
            arg.includes("--staging") && (STATE.optStaging = true);
        });

        if (configFile === null || configFile === "") {
            configFile = "server-ssl.sc";
        }

        let configBuffer = null;

        if (existsSync(configFile)) {
            configBuffer = readFileSync(configFile)
        }
        else {
            console.log("Provide a valid configuration file or use the default one (server-ssl.sc)");
            process.exit(0);
        }

        const configMap = new Map();

        if (configBuffer !== null) {
            const fullConfigText = configBuffer.toString('utf-8');
            const splitOnLines = fullConfigText.split("\r\n");

            for (let index = 0; index < splitOnLines.length; index++) {
                const splitLine = splitOnLines[index];
                const splitValue = splitLine.split(" ::");

                for (let index = 0; index < splitValue.length; index++) {
                    splitValue[index] = splitValue[index].trim();
                }

                for (let index = 0; index < splitValue.length; index++) {
                    const key = splitValue[index++];
                    const value = splitValue[index];

                    if (value == undefined || key == undefined || key == '') {
                        continue;
                    }

                    configMap.set(key, value);
                }
            }

            configMap.forEach((value, key) => {
                if (value === 'false') {
                    configMap.set(key, false);
                } else if (value === 'true') {
                    configMap.set(key, true);
                }
                else if (value === '""') {
                    configMap.set(key, undefined);
                }
                else if (value.startsWith('"')) {
                    configMap.set(key, value.replaceAll('"', ''));
                }
                else if (!isNaN(value)) {
                    configMap.set(key, Number(value));
                }

            });
        }

        const useStaging = configMap.get("useStaging");
        useStaging != undefined && !STATE.optStaging && (STATE.optStaging = useStaging);

        const portHttps = configMap.get("portHttps");
        portHttps != undefined && (STATE.optPort = portHttps);

        const portHttp = configMap.get("portHttp");
        portHttp != undefined && (STATE.optPortHttp = portHttp);

        const certificate = configMap.get("certificate");
        certificate != undefined && (STATE.optCert = certificate);

        const privateKey = configMap.get("private-key");
        privateKey != undefined && (STATE.optPk = privateKey);

        const websiteRoot = configMap.get("websiteRoot");
        websiteRoot != undefined && (STATE.optWebsite = websiteRoot);

        const entryPage = configMap.get("entryPage");
        entryPage != undefined && (STATE.optEntry = entryPage);

        const errorRoot = configMap.get("errorRoot");
        errorRoot != undefined && (STATE.optError = errorRoot);

        const noCheckNodeVersion = configMap.get("noCheckNodeVersion");
        noCheckNodeVersion != undefined && (STATE.optNoVersionCheck = noCheckNodeVersion);

        const useLetsEncrypt = configMap.get("useLetsEncrypt");
        useLetsEncrypt != undefined && (STATE.optLetsEncrypt = useLetsEncrypt);

        const domains = configMap.get("domains");
        domains != undefined && (STATE.optDomains = domains);

        const generateCertAnyway = configMap.get("generateCertAnyway");
        generateCertAnyway != undefined && (STATE.optGenerateAnyway = generateCertAnyway);

        const useDnsProvider = configMap.get("useDnsProvider");
        useDnsProvider != undefined && (STATE.optUseDnsProvider = useDnsProvider);

        const providerName = configMap.get("providerName");
        providerName != undefined && (STATE.optProviderName = providerName);

        const providerToken = configMap.get("providerToken");
        providerToken != undefined && (STATE.optProviderToken = providerToken);

        const providerZone = configMap.get("providerZone");
        providerZone != undefined && (STATE.optProviderZone = providerZone);

        if (STATE.optLetsEncrypt === true) {
            STATE.optDomains === null && (console.log("You must specify at least one domain to use --letsEncrypt"), STATE.optLetsEncrypt = null);
        }

        !STATE.optPk && (STATE.optPk = 'private-key.pem');
        !STATE.optCert && (STATE.optCert = 'certificate.pem');
        !STATE.optWebsite && (STATE.optWebsite = 'wwwroot');
        !STATE.optError && (STATE.optError = 'error');
        !STATE.optEntry && (STATE.optEntry = 'index.html');

        const SSL = join(__rootDir, STATE.SSL, STATE.optStaging ? "staging" : "production");

        let PK = join(SSL, STATE.optPk);
        let CERT = join(SSL, STATE.optCert);

        if (!existsSync(PK) || !existsSync(CERT)) {
            !existsSync(SSL) && mkdirSync(SSL);

            runCommandSync('req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ' + SSL + '/private-key.pem -out ' + SSL + '/certificate.pem -days 365 -subj "/CN=localhost"');

            PK = join(SSL, "private-key.pem");
            CERT = join(SSL, "certificate.pem");
        }

        !existsSync(PK) && STATE.certNotExist();
        !existsSync(CERT) && STATE.certNotExist();

        STATE.loadErrorPages(join(__rootDir, STATE.optError));

        STATE.__rootDir = __rootDir;
        STATE.__websiteDir = join(__rootDir, STATE.optWebsite);
        STATE.__sslFolder = SSL;
        STATE.__pkPath = PK;
        STATE.__certPath = CERT;

        if (existsSync("./package.json")) {
            import('../package.json', { with: { type: 'json' } }).then((packageJson) => {
                STATE.packageJson = packageJson;

                console.log("Starting Server SSL", "v" + packageJson.default.version);
            });
        }

        return STATE.__websiteDir;
    },
    certNotExist: () => {
        console.log(" ");
        console.log("Certificate and Private Key not found or don't exist, they should be in the ssl folder");
        console.log(" ");
        console.log("You need to generate or provide an SSL Certificate and Private Key in PEM format");
        console.log("You can use the following command from git bash or run start-windows.bat with no arguments");
        console.log(" ");
        console.log('openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ssl/production/private-key.pem -out ssl/production/certificate.pem -days 365 -subj "/CN=localhost"');
        console.log('openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ssl/staging/private-key.pem -out ssl/staging/certificate.pem -days 365 -subj "/CN=localhost"');
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
    extractDomainsAnyFormat: (input) => {
        const bracketsRemoved = String(input).trim().replace(/[\[\]]/g, '');
        const commaSplit = bracketsRemoved.split(',').map(d => d.trim().replace(/^['"]|['"]$/g, ''));
        return commaSplit.length > 0 && commaSplit[0] ? commaSplit : domains;
    },
    checkNodeForUpdates: async () => {
        if (STATE.optNoVersionCheck !== true) {
            const response = await fetchAndRetryUntilOk(STATE.NODE_URL, { method: 'GET', redirect: 'follow' });

            if (response.ok) {
                const split = response.url.split("/");

                if (split.length === STATE.NODE_URL_SPLITS) {
                    for (let index = 0; index < split.length; index++) {
                        if (split[index][0] === STATE.NODE_VERSION) {
                            if (split[index] !== process.version) {
                                console.log("There is a more recent version of Node.js available:", split[index]);
                            }
                            else {
                                console.log("Node.js is up to date:", process.version);
                            }

                            return;
                        }
                    }
                }
            }

            console.log("Could not determine if Node.js version is recent");
        }
    },
    loadLetsEncryptAcmeDaemon: async (certificateCallback) => {
        STATE.optLetsEncrypt && STATE.optDomains !== null && (STATE.urlsArray = STATE.extractDomainsAnyFormat(STATE.optDomains));
        STATE.optLetsEncrypt && await STATE.__daemon.startLetsEncryptDaemon(STATE.urlsArray, STATE.__sslFolder, certificateCallback,
            STATE.optGenerateAnyway,
            STATE.optStaging,
            STATE.optUseDnsProvider ? { name: STATE.optProviderName, token: STATE.optProviderToken, zone: STATE.optProviderZone } : null);
    },
    redirect: (res, req) => {
        res.writeHead(STATE.REDIRECT, { [STATE.REDIRECT_LOCATION]: `${STATE.HTTPS}${req.headers.host}${req.url}` });
        res.end();
    },
    startHttpChallengeListener: () => {
        createServerHTTP(async (req, res) => {
            if (STATE.optLetsEncrypt && STATE.__daemon.checkChallengesMixin(req, res)) { return; }

            STATE.redirect(res, req);
        }).on('error', (e) => e.code === STATE.ADDR_IN_USE && console.error(`${STATE.optPortHttp}${STATE.IN_USE}`)).listen(STATE.optPortHttp, () => console.log(`${STATE.STARTED_HTTP}${STATE.optPort}`)); // Lets Encrypt! HTTP-01 ACME Challenge Mixin - Always Redirect HTTP to HTTPS unless doing a ACME Challenge
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