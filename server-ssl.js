import { createServer as createServerHTTPS } from 'https';
import { createServer as createServerHTTP } from 'http';
import { fileURLToPath } from 'url';
import { readFile, readFileSync } from 'fs';
import { join, extname as _extname, dirname } from 'path';
import { checkChallengesMixin } from './ssl/module/lets-encrypt-acme-client.js';
import { S_SSL } from './ssl/ssl.js';

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

const __rootDir = dirname(fileURLToPath(import.meta.url));
const { __websiteDir, __errorDir, __sslFolder, __pkPath, __certPath } = S_SSL.importRequiredArguments(__rootDir);

S_SSL.loadErrorPages(__errorDir);

const HTTPS_SERVER = createServerHTTPS({ key: readFileSync(__pkPath), cert: readFileSync(__certPath) }, (req, res) => {
    const filePath = join(__websiteDir, req.url === S_SSL.WEBSITE_ROOT ? S_SSL.optEntry : req.url);
    const fileExtension = _extname(filePath);

    let contentType = CONTENT_TYPES[fileExtension];
    !contentType && (contentType = S_SSL.TEXT_HTML);

    readFile(filePath, (err, content) => !err ? (res.writeHead(S_SSL.SUCCESS, { [S_SSL.CONTENT_TYPE]: contentType }), res.end(content)) : S_SSL.getErrorPage(res, err));
}).on('error', (e) => e.code === S_SSL.ADDR_IN_USE && console.error(`${S_SSL.optPort}${S_SSL.IN_USE}`)).listen(S_SSL.optPort, (err) => err ? console.error(S_SSL.ERROR_STARTING, err) : console.log(`${S_SSL.STARTED_HTTPS}${S_SSL.optPort}`));

createServerHTTP((req, res) => {
    if (S_SSL.optLetsEncrypt) { if (checkChallengesMixin(req, res)) { return; } } // Lets Encrypt! HTTP-01 ACME Challenge Mixin
    res.writeHead(S_SSL.REDIRECT, { [S_SSL.REDIRECT_LOCATION]: `${S_SSL.HTTPS}${req.headers.host}${req.url}` }); // Always Redirect HTTP to HTTPS unless doing a ACME Challenge
    res.end();
}).on('error', (e) => e.code === S_SSL.ADDR_IN_USE && console.error(`${S_SSL.optPortHttp}${S_SSL.IN_USE}`)).listen(S_SSL.optPortHttp, () => console.log(`${S_SSL.STARTED_HTTP}${S_SSL.optPort}`));

S_SSL.loadLetsEncryptDaemon(__sslFolder, // Lets Encrypt! ACME Daemon
    () => { // Restart Callback, use --autoRestart
        console.log("Restarting Soon");
    }, 30, // Restart Seconds (number of callbacks)
    () => { // Update Certificates Callback
        HTTPS_SERVER.setSecureContext({ key: readFileSync(__pkPath), cert: readFileSync(__certPath) });
        console.log("Updated Server Certificate");
    });
S_SSL.checkNodeForUpdates(__sslFolder); // Check Node.js version