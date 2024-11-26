import { fileURLToPath } from 'url';
import { createServer as createServerHTTPS } from 'https';
import { createServer as createServerHTTP } from 'http';
import { readFile, readFileSync, existsSync } from 'fs';
import { join, extname as _extname, dirname } from 'path';
import { checkChallengesMixin } from './ssl/module/lets-encrypt-acme-client.js'
import { S_SSL, importRequiredArguments, loadLetsEncryptDaemon } from './ssl/ssl.js'

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

importRequiredArguments();

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
    // Lets Encrypt! HTTP-01 ACME Challenge Mixin
    if (S_SSL.optLetsEncrypt) { if (checkChallengesMixin(req, res)) { return; } }

    // Always Redirect HTTP to HTTPS unless doing a ACME Challenge
    res.writeHead(S_SSL.REDIRECT, { [S_SSL.REDIRECT_LOCATION]: `${S_SSL.HTTPS}${req.headers.host}${req.url}` });
    res.end();
}).listen(S_SSL.optPortHttp, () => console.log(`${S_SSL.STARTED_HTTP}${S_SSL.optPort}`));

loadLetsEncryptDaemon(__sslFolder, () => { console.log("Restarting Soon"); }, 30); // Lets Encrypt! ACME Daemon