import { fileURLToPath } from 'url';
import { join, extname as _extname, dirname } from 'path';
import { createServer as createServerHTTPS } from 'https';
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
const __websiteDir = S_SSL.importRequiredArguments(__rootDir);

const HTTPS_SERVER = createServerHTTPS(S_SSL.loadDefaultSecureContext(), (req, res) => {
    let route = undefined;

    if (req.url === S_SSL.WEBSITE_ROOT) {
        route = join(__websiteDir, S_SSL.optEntry);
    }
    else if (req.url === "/md") {
        route = join(__websiteDir, "md", S_SSL.optEntry);
    }

    route == undefined && (route = req.url); // no route, follow the url

    S_SSL.defaultFileHandling(res, route, CONTENT_TYPES);
}).on('error', (e) => e.code === S_SSL.ADDR_IN_USE && console.error(`${S_SSL.optPort}${S_SSL.IN_USE}`)).listen(S_SSL.optPort, (err) => err ? console.error(S_SSL.ERROR_STARTING, err) : console.log(`${S_SSL.STARTED_HTTPS}${S_SSL.optPort}`));

S_SSL.startHttpChallengeListener();  // Lets Encrypt! HTTP-01 ACME Challenge Mixin - Always Redirects HTTP to HTTPS unless doing a ACME Challenge
//                                           .. Restart Callbacks/Seconds              .. Update Certificates Callback
S_SSL.loadLetsEncryptAcmeDaemon(() => console.log("Restarting Soon"), 30, () => S_SSL.loadNewSecureContext(HTTPS_SERVER));

S_SSL.checkNodeForUpdates(); // Check Node.js version