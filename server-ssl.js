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

S_SSL.importRequiredArguments(dirname(fileURLToPath(import.meta.url))); // S_SSL - https://i.imgur.com/vK4Rf7c.png

const HTTPS_SERVER = createServerHTTPS(S_SSL.loadDefaultSecureContext(), (req, res) => {
    MethodPath(req, res);
}).on('error', (e) => e.code === S_SSL.ADDR_IN_USE && console.error(`${S_SSL.optPort}${S_SSL.IN_USE}`)).listen(S_SSL.optPort, (err) => err ? console.error(S_SSL.ERROR_STARTING, err) : console.log(`${S_SSL.STARTED_HTTPS}${S_SSL.optPort}`));

S_SSL.startHttpChallengeListener();  // Lets Encrypt! HTTP-01 ACME Challenge Mixin - Always Redirects HTTP to HTTPS unless doing a ACME Challenge

S_SSL.loadLetsEncryptAcmeDaemon(() => console.log("Restarting Soon"), 30, () => S_SSL.loadNewSecureContext(HTTPS_SERVER));
//                              ^^ Restart Callbacks       cb/seconds ^^  ^^ Update Certificates Callback
S_SSL.checkNodeForUpdates(); // Check Node.js version

function MethodPath(req, res) {
    switch (req.method) {
        case "GET":
        case "POST":
        case "PUT":
        case "DELETE":
        case "PATCH":
        case "HEAD":
        case "OPTIONS":
        case "CONNECT":
        case "TRACE": {
            let route = undefined;

            if (req.url === S_SSL.WEBSITE_ROOT) {
                route = S_SSL.optEntry;
            }
            // else if (req.url === "/md") {
            //     route = join("md", S_SSL.optEntry); // route example
            // }
            // else if (req.url === "/someapi") {
            //     return S_SSL.respondWithContent(res, "response data", S_SSL.TEXT_HTML); // api example
            // }

            route == undefined && (route = req.url); // no route, follow the url

            S_SSL.defaultFileHandling(res, S_SSL.finishRoute(route), CONTENT_TYPES);

            break;
        }

        // case "POST": {
        //     let body = '';

        //     req.on('data', chunk => {
        //         body += chunk.toString();
        //     });

        //     req.on('end', () => {
        //         console.log('Received POST data:', body);
        //         res.writeHead(200, { 'Content-Type': 'text/plain' });
        //         res.end('POST request received');
        //     });
        //     break;
        // }

        // case "PUT": {
        //     let body = '';

        //     req.on('data', chunk => {
        //         body += chunk.toString();
        //     });

        //     req.on('end', () => {
        //         console.log('Received PUT data:', body);
        //         res.writeHead(200, { 'Content-Type': 'text/plain' });
        //         res.end('PUT request received');
        //     });
        //     break;
        // }

        // case "DELETE": {
        //     res.writeHead(200, { 'Content-Type': 'text/plain' });
        //     res.end('DELETE request received');
        //     break;
        // }

        // case "PATCH": {
        //     let body = '';

        //     req.on('data', chunk => {
        //         body += chunk.toString();
        //     });

        //     req.on('end', () => {
        //         console.log('Received PATCH data:', body);
        //         res.writeHead(200, { 'Content-Type': 'text/plain' });
        //         res.end('PATCH request received');
        //     });
        //     break;
        // }

        // case "HEAD": {
        //     res.writeHead(200, { 'Content-Type': 'text/plain' });
        //     res.end();
        //     break;
        // }

        // case "OPTIONS": {
        //     res.writeHead(200, { 'Content-Type': 'text/plain' });
        //     res.end('OPTIONS request received');
        //     break;
        // }

        // case "CONNECT": {
        //     res.writeHead(200, { 'Content-Type': 'text/plain' });
        //     res.end('CONNECT request received');
        //     break;
        // }

        // case "TRACE": {
        //     res.writeHead(200, { 'Content-Type': 'text/plain' });
        //     res.end('TRACE request received');
        //     break;
        // }

        default: {
            return S_SSL.respondWithServerError(res);
        }
    }
}