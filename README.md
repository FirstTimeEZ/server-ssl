[![](https://i.imgur.com/nSEjI0t.jpeg)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

# server-ssl.js

Configurable `SSL Server` that runs on [`Node.js`](https://nodejs.org/en) which can be used for development or production

Create and renew `Lets Encrypt Certificates` automatically using `ACME` using `DNS-01` with supported providers or `HTTP-01`

Designed to get out of your way so you can still change _anything_

--------

### Getting Started

The easiest usage would be to serve a website:

1. [`Clone`](https://github.com/FirstTimeEZ/server-ssl.git) or [`Download`](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) the main branch and extract it somewhere
2. Put your website in the `website` folder
3. Open the `server-ssl` folder in `Command Prompt` or `Git Bash`
4. Run `npm install`
5. Run `node server-ssl.js`
6. View your website at `https://localhost`

[![](https://i.imgur.com/0IVqrfn.gif)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

The default page/config is a simple [`API`](https://github.com/FirstTimeEZ/simple-api-router) that serves and displays the `time`

[![](https://i.imgur.com/DEbJVUq.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

### Advanced/Production Usage

`node server-ssl.js` takes your arguments and starts the server

```
# Start for production (Lets Encrypt!) with SAN Extension
node server-ssl.js --letsEncrypt --domains=['www.ssl.boats','ssl.boats']
```

[![](https://i.imgur.com/BT8EEWj.gif)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

### Optional Arguments

`server-ssl.js` has some optional arguments you can use in production if the defaults aren't enough.

| Arguments/Flags       | Description                                      | Default Value         |
|-------------------------|----------------------------------|-----------------------|
| `--port=`      | The port number for `HTTPS` | `443` |
| `--portHttp=`  | The port number for HTTP that will be redirected | `80` |
| `--cert=`      | The path to the `SSL` certificate file. | `"certificate.pem"` |
| `--pk=`        | The path to the private key file for the `SSL` certificate. | `"private-key.pem"` |
| `--site=`      | The directory for the website files | `"wwwroot"` |
| `--error=`     | The directory for error messages (404,500) | `"error"` |
| `--entry=`     | The page to use for the entry point | `"index.html"` |

All Arguments are case sensitive.

### Use Lets Encrypt!

You can use `Lets Encrypt` to generate certificates.

Certificates are valid for `90 days` but are renewed automatically sooner.

The certificates will be changed automatically when they are updated, you don't need to do anything.

| Automated Lets Encrypt!       | Description                                      |
|-------------------------|----------------------------------|
| `--letsEncrypt` | `Lets Encrypt!` should be used to generate 90 day certificates automatically |
| `--domains=` | Domains to generate certificates for, this can not include wild cards, this should be an array. eg. `--domains=['www.ssl.boats','ssl.boats']` |
| `--generateAnyway` | Certificates should always be generated when the server starts, this could get you rate limited, maybe use `--staging`  |
| `--staging` | The `Lets Encrypt!` staging server should be used instead of production |

```
node server-ssl.js --letsEncrypt --domains=['www.ssl.boats','ssl.boats']
```

### Wild Card Certificates

You can generate `Wild Card Certificates` if you use a supported `DNS-01` provider

At this present moment that is only `Cloud Flare`

```
let dnsProvider = {
    name: "Cloud Flare",
    token: "apiTokenWithDnsEditPermission",
    zone: "zoneId" // optional if it cant be found automatically.
}
```

Then to generate the certificate add a wildcard to the apex, eg. `*.ssl.boats`

```
--domains=['*.ssl.boats'] --staging
```

--------

### Always Redirect HTTP to HTTPS

`HTTP` requests from end users are always redirected to `HTTPS`

`ACME Challenges` transparently happen over `HTTP` to create/issue a new certificate

--------

### Anything [Node.js](https://nodejs.org/docs/latest/api/) can do..

At the end of the day, this is just a [`Node.js`](https://nodejs.org/docs/latest/api/) server that sets up `SSL` automatically

```
const HTTPS_SERVER = createServerHTTPS(STATE.loadDefaultSecureContext(), (req, res) => {
    // do whatever you like
})...
```

You can remove everything inside `HTTPS_SERVER` and do whatever you like.

There are also helpers you can use in `STATE`

--------

### Default Layout

This layout keeps the project organized and maintainable, separating error handling, website content, and server configuration.

```
/root
│
├── /error
│   ├── 404.html
│   └── 500.html
│
├── /ssl
│   ├── /production
│   │   │
│   │   ├── ...
│   │   ├── private-key.pem
│   │   └── certificate.pem
│   │
│   ├── /staging
│   │   │
│   │   ├── ...
│   │   ├── private-key.pem
│   │   └── certificate.pem
│   │
│   └── state.js
│
├── /wwwroot
│   └── index.html <---- Your website goes here
│
└── server-ssl.js
```

--------

### 404/500 Pages

The server is configured to serve custom `404` and `500` error pages, instead of plain-text.

[![](https://i.imgur.com/gzgRNdQ.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) [![](https://i.imgur.com/KSixh7q.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

Currently everything is treated like a `Server Error` except for `Not Found`

[![](https://i.imgur.com/l8DMrQY.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) [![](https://i.imgur.com/mP2d4vi.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

These pages will automatically select light/dark mode

--------

### Bring Your Own SSL Certificate

Convert your `certificate` and `private key` to `PEM` format and place them in the `ssl` folder

```
├── /ssl
│   ├── /production <> staging
│   │   │
│   │   ├── ...
│   │   ├── private-key.pem <--- Your private key goes here
│   │   └── certificate.pem <--- Your certificate goes here
```