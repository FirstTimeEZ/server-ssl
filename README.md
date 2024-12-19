[![](https://i.imgur.com/nSEjI0t.jpeg)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

# server-ssl.js

[`Node.js`](https://nodejs.org/en) server that is `SSL` by default that can be used for development or production

Designed to get out of your way so you can still change _anything_

Creates and renews `Lets Encrypt Certificates` automatically using `ACME`

If you use `CloudFlare` you can get `Wildcard Certificates`

## Getting Started

The easiest usage would be to serve a website:

1. [`Clone`](https://github.com/FirstTimeEZ/server-ssl.git) or [`Download`](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) the main branch and extract it somewhere
2. Put your website in the `website` folder
3. Open the `server-ssl` folder in `Command Prompt` or `Git Bash`
4. Run `npm install`
5. Run `node server-ssl.js`
6. View your website at `https://localhost`

![](https://i.imgur.com/ZYXoLMy.gif)

You can also use different kinds of `Lets Encrypt!` certificates, see configuration below.

![](https://i.imgur.com/mQ4uaxL.gif)


The default page/config is a simple [`API`](https://github.com/FirstTimeEZ/simple-api-router) that serves and displays the `time`

[![](https://i.imgur.com/DEbJVUq.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

## Advanced/Production Usage

`server-ssl.js` has a configuration file called `server-ssl.sc` that contains all the options you can change

#### Default Configuration `(server-ssl.sc)`
 
```
portHttps          :: 443                                // The port number for HTTPS
portHttp           :: 80                                 // The port number for HTTP that will be redirected

certificate        :: "certificate.pem"                  // The path to the certificate file.
private-key        :: "private-key.pem"                  // The path to the private key for the certificate.

websiteRoot        :: "wwwroot"                          // The directory for the website files
entryPage          :: "index.html"                       // The page to use for the websites entry point 
errorRoot          :: "error"                            // The directory for error messages (404,500)

noCheckNodeVersion :: false                              // True to skip checking Node.js version

useLetsEncrypt     :: false                              // Use Lets Encrypt! to generate a certificate
domains            :: ["ssl.boats","www.ssl.boats"]      // Domains to generate the certificate for
generateCertAnyway :: false                              // True to generate before the recommended time
useStaging         :: false                              // True to use the staging server to avoid rate limits

useDnsProvider     :: false                              // Use the DNS-01 Challenge to generate certificate
providerName       :: "Cloud Flare"                      // Name of supported DNS Provider
providerToken      :: "apiTokenWithDnsEditPermission"    // API Token for DNS Provider
providerZone       :: ""                                 // ZoneId for DNS Provider, may found automatically.
```

#### Multiple Configuration Files

You can create multiple configuration files and choose which one to load as an argument.

```
node server-ssl --config="server-ssl-staging.sc"
```

If no argument is provided the default configuration file is loaded. `(server-ssl.sc)`

#### Generate Wild Card Certificates

You can generate `Wild Card Certificates` if you use a supported `DNS-01` provider

At this present moment that is only `Cloud Flare`

![](https://i.imgur.com/R132a6z.gif)

#### Generate SAN Certificates

These certificates can have up to `50` sub-domains and no `Wild Card`

You can generate `Lets Encrypt Certificates` with the `SAN Extension` using the `HTTP-01` challenge 

This is the default configuration.

![](https://i.imgur.com/VkOrZcX.gif)

#### Always Redirects `HTTP` to `HTTPS`

`HTTP` requests from end users are always redirected to `HTTPS`

`ACME Challenges` transparently happen over `HTTP` to create/issue a new certificate

## Default Layout

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
├── server-ssl.sc
└── server-ssl.js
```

## 404/500 Pages

The server is configured to serve custom `404` and `500` error pages, instead of plain-text.

[![](https://i.imgur.com/gzgRNdQ.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) [![](https://i.imgur.com/KSixh7q.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

Currently everything is treated like a `Server Error` except for `Not Found`

[![](https://i.imgur.com/l8DMrQY.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) [![](https://i.imgur.com/mP2d4vi.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

These pages will automatically select light/dark mode