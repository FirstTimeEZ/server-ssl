import { createServer as createServerHTTPS } from 'https';
import { fileURLToPath } from 'url';
import { readFile, readFileSync } from 'fs';
import { join, extname as _extname, dirname } from 'path';
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
    let route = undefined;

    if (req.url === S_SSL.WEBSITE_ROOT) {
        route = join(__websiteDir, S_SSL.optEntry);
    }
    else if (req.url === "/md") {
        route = join(__websiteDir, "md", S_SSL.optEntry);
    }

    route == undefined && (route = req.url); // no route, follow the url

    const fileExtension = _extname(route);

    let contentType = CONTENT_TYPES[fileExtension];
    !contentType && (contentType = S_SSL.TEXT_HTML);

    readFile(route, (err, content) => !err ? (res.writeHead(S_SSL.SUCCESS, { [S_SSL.CONTENT_TYPE]: contentType }), res.end(content)) : S_SSL.getErrorPage(res, err));
}).on('error', (e) => e.code === S_SSL.ADDR_IN_USE && console.error(`${S_SSL.optPort}${S_SSL.IN_USE}`)).listen(S_SSL.optPort, (err) => err ? console.error(S_SSL.ERROR_STARTING, err) : console.log(`${S_SSL.STARTED_HTTPS}${S_SSL.optPort}`));

S_SSL.startHttpChallengeListener();  // Lets Encrypt! HTTP-01 ACME Challenge Mixin - Always Redirects HTTP to HTTPS unless doing a ACME Challenge

S_SSL.loadLetsEncryptDaemon(__sslFolder, // Lets Encrypt! ACME Daemon
    () => console.log("Restarting Soon"), 30, // Restart Callback (seconds is also # of callbacks)
    () => (HTTPS_SERVER.setSecureContext({ key: readFileSync(__pkPath), cert: readFileSync(__certPath) }), console.log("Updated Server Certificate"))); // Update Certificates Callback

S_SSL.checkNodeForUpdates(__sslFolder); // Check Node.js version