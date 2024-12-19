import { fileURLToPath } from 'url';
import { join, extname as _extname, dirname } from 'path';
import { createServer as createServerHTTPS } from 'https';
import { STATE } from './ssl/state.js';
import { Api, Endpoint } from 'simple-api-router';

STATE.importRequiredArguments(dirname(fileURLToPath(import.meta.url)));

const API = new Api("/api/");

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

API.addEndpoint(new Endpoint("time", "GET", (req, res) => {
    return STATE.respondWithContent(res, Date.now().toString(), STATE.TEXT_HTML);
}));

const HTTPS_SERVER = createServerHTTPS(STATE.loadDefaultSecureContext(), (req, res) => {
    //const host = req.headers.host; // e.g., api.example.com
    let route = undefined;

    if (req.url === STATE.WEBSITE_ROOT) {
        route = STATE.optEntry;
    }
    else if (API.checkFindExecute(req, res)) {
        return;
    }

    route == undefined && (route = req.url); // no route, follow the url

    STATE.defaultFileHandling(res, STATE.finishRoute(route), CONTENT_TYPES);
}).on('error', (e) => e.code === STATE.ADDR_IN_USE && console.error(`${STATE.optPort}${STATE.IN_USE}`)).listen(STATE.optPort, (err) => err ? console.error(STATE.ERROR_STARTING, err) : console.log(`${STATE.STARTED_HTTPS}${STATE.optPort}`));

STATE.startHttpChallengeListener();  // Lets Encrypt! HTTP-01 ACME Challenge Mixin - Always Redirects HTTP to HTTPS unless doing a ACME Challenge

let dnsProvider = null;

// dnsProvider = {
//     name: "Cloud Flare",
//     token: "apiTokenWithDnsEditPermission"
// }

STATE.loadLetsEncryptAcmeDaemon(() => { STATE.loadNewSecureContext(HTTPS_SERVER); }, dnsProvider);
//                              ^^ Update Certificates Callback
STATE.checkNodeForUpdates(); // Check Node.js version