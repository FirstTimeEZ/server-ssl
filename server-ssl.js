import { fileURLToPath } from 'url';
import { createServer as createServerHTTPS } from 'https';
import { createServer as createServerHTTP } from 'http';
import { readFile, readFileSync, existsSync, mkdir } from 'fs';
import { join, extname as _extname, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __args = process.argv.slice(2);
const options = {};

let optPk = null;
let optCert = null;
let optError = null;
let optEntry = null;
let optWebsite = null;
let optDisableRedirectHttp = false;
let optPort = process.env.PORT || 443;
let optPortHttp = process.env.PORT_HTTP || 80;

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

function useSslFolder() {
    mkdir(sslFolder, { recursive: true }, () => { });
    console.log(" ");
    console.log("Put your Certificate and Private Key in the SSL folder that was just created");
    console.log(" ");
    process.exit(1);
}

function loadArguments() {
    __args.forEach((arg) => {
        let rightSide = arg.split("=")[1];
        arg.includes("--port=") && (optPort = rightSide);
        arg.includes("--portHttp=") && (optPortHttp = rightSide);
        arg.includes("--cert=") && (optCert = rightSide);
        arg.includes("--pk=") && (optPk = rightSide);
        arg.includes("--site=") && (optWebsite = rightSide);
        arg.includes("--error=") && (optError = rightSide);
        arg.includes("--entry=") && (optEntry = rightSide);
        arg.includes("--noRedirect") && (optDisableRedirectHttp = true);
    });

    !optPk && (optPk = 'private-key.pem');
    !optCert && (optCert = 'certificate.pem');
    !optWebsite && (optWebsite = 'website');
    !optError && (optError = 'error');
    !optEntry && (optEntry = 'index.html');
}

loadArguments();

const sslFolder = join(__dirname, "ssl");
const pkPath = join(sslFolder, optPk);
const certPath = join(sslFolder, optCert);

!existsSync(sslFolder) && useSslFolder();
!existsSync(pkPath) && certificateNotExist();
!existsSync(certPath) && certificateNotExist();

options.key = readFileSync(pkPath);
options.cert = readFileSync(certPath);

/**
 * Creates an HTTPS server that handles incoming requests.
 * 
 */
createServerHTTPS(options, (req, res) => {
    let filePath = join(__dirname, optWebsite, req.url === '/' ? optEntry : req.url);

    const extname = _extname(filePath);

    let contentType;

    switch (extname) {
        case '.html':
            contentType = 'text/html';
            break;
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
                readFile(join(__dirname, optError, '/404.html'), (err404, content404) => {
                    if (err404) {
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content404);
                    }
                });
            } else {
                readFile(join(__dirname, optError, '/500.html'), (error500, content500) => {
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
}).listen(optPort, (err) => {
    if (err) {
        console.error('Error starting server:', err);
        return;
    }
    console.log(`HTTPS Server is running on port ${optPort}`);
})

/**
 * Creates an HTTP server that redirects incoming requests to HTTPS
 * using the --noRedirect flag will disable this
 *
 */
!optDisableRedirectHttp && createServerHTTP((req, res) => {
    res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
    res.end();
}).listen(optPortHttp, () => {
    console.log(`HTTP Server is redirecting requests to ${optPort}`);
});