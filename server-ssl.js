import { fileURLToPath } from 'url';
import { createServer } from 'https';
import { readFile, readFileSync, existsSync } from 'fs';
import { join, extname as _extname, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __args = process.argv.slice(2);
const options = {};

let optPk = null;
let optCert = null;
let optError = null;
let optWebsite = null;
let optPort = process.env.PORT || 443;

function certificateNotExist() {
    console.log("You need to generate or provide an SSL Certificate and Private Key in PEM format");
    console.log("You can use the following command from git bash");
    console.log(" ");
    console.log('openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout private-key.pem -out certificate.pem -days 365 -subj "//CN=localhost"');
    process.exit(1);
}

function loadArguments() {
    __args.forEach((e) => {
        let portArg = e.toLowerCase().includes("--port=") ? e.split("=")[1] : null
        if (portArg !== null) {
            optPort = portArg;
        }

        let certPath = e.toLowerCase().includes("--cert=") ? e.split("=")[1] : null
        if (certPath !== null) {
            optCert = certPath;
        }

        let privateKeyPath = e.toLowerCase().includes("--pk=") ? e.split("=")[1] : null
        if (privateKeyPath !== null) {
            optPk = privateKeyPath;
        }

        let websiteFolder = e.toLowerCase().includes("--site=") ? e.split("=")[1] : null
        if (websiteFolder !== null) {
            optWebsite = websiteFolder;
        }

        let errorFolder = e.toLowerCase().includes("--error=") ? e.split("=")[1] : null
        if (errorFolder !== null) {
            optError = errorFolder;
        }
    });

    !optPk && (optPk = 'private-key.pem');
    !optCert && (optCert = 'certificate.pem');
    !optWebsite && (optWebsite = 'website');
    !optError && (optError = 'error');
}

loadArguments();

!existsSync(optPk) && certificateNotExist();
!existsSync(optCert) && certificateNotExist();

options.key = readFileSync(optPk);
options.cert = readFileSync(optCert);

/**
 * Creates an HTTPS server that handles incoming requests.
 * 
 * @function
 * @param {Request} req - The incoming request object.
 * @param {Response} res - The response object to send data back to the client.
 */
createServer(options, (req, res) => {
    let filePath = join(__dirname, optWebsite, req.url === '/' ? 'index.html' : req.url);

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
    console.log(`Server is running on https://localhost:${optPort}`);
});