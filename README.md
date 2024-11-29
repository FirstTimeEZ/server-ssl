[![](https://i.imgur.com/nSEjI0t.jpeg)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

# server-ssl.js

Easy to configure `SSL Web Server` that can be used for development or production

`HTTP` requests are redirected to `HTTPS`

Production servers can use and renew `Lets Encrypt 90 Day Certificates` automatically.

Designed to get out of your way, you can still change anything about the server.

--------

### Getting Started

It can be as simple as this:

1. [`Clone`](https://github.com/FirstTimeEZ/server-ssl.git) or [`Download`](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) the main branch and extract it somewhere
2. Put your website in the `website` folder
3. Open the `server-ssl` folder in `Command Prompt` or `Git Bash`
4. Run `start-windows.bat`

`start-windows.bat` takes your arguments and starts the server

```
# Start for development (Self Signed Certificate, Port 443, https://localhost)
./start-windows.bat

# Start for production (Lets Encrypt!)
./start-windows.bat --letsEncrypt --domains=['www.ssl.boats','ssl.boats']

# Start for production (BYO)
./start-windows.bat --cert="your-certificate.pem" --pk="your-private-key.pem"
```

[![](https://i.imgur.com/NxJQeLm.gif)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

### Optional Arguments

`server-ssl.js` has some optional arguments you can use in production if the defaults aren't enough.

| Arguments/Flags       | Description                                      | Default Value         |
|-------------------------|----------------------------------|-----------------------|
| `--port=`      | The port number for `HTTPS` | `443` |
| `--portHttp=`  | The port number for HTTP that will be redirected | `80` |
| `--cert=`      | The path to the `SSL` certificate file. | `"certificate.pem"` |
| `--pk=`        | The path to the private key file for the `SSL` certificate. | `"private-key.pem"` |
| `--site=`      | The directory for the website files | `"website"` |
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
| `--autoRestart` | Restart the server after cert generation, firing a callback to notify of the restart (not required) |

`start-windows.bat` is required to use `--autoRestart`

```
./start-windows.bat --letsEncrypt --domains=['www.ssl.boats','ssl.boats']
```

--------

### Default Structure

This structure is designed to keep the project organized and maintainable, separating error handling, website content, and server configuration.

```
/root
│
├── /error
│   ├── 404.html
│   └── 500.html
│
├── /ssl
│   ├── /openssl
│   ├── /module
│   │   ├── /crypt
│   │   ├── /jose
│   │   └── lets-encrypt-acme-client.js
│   │
│   ├── acmeKeys
│   ├── private-key.pem
│   └── certificate.pem
│   └── ssl.js
│
├── /website
│   └── index.html <---- Your website goes here
│
├── node.exe
├── server-ssl.js            <--- server config
└── start-windows.bat
```

--------

### Default Page

The default page is a little boat game, the goal is to survive.

[![](https://i.imgur.com/lNhCeBN.gif)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

You can adjust the difficulty by zooming.

--------

### 404/500 Pages

The server is configured to serve custom `404` and `500` error pages.

[![](https://i.imgur.com/w4Awnc1.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

Currently everything is treated like a `Server Error` except for `Page Not Found`

[![](https://i.imgur.com/mQlVhjL.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

--------

### Bring Your Own SSL Certificate

```
./start-windows.bat --cert="your-certificate.pem" --pk="your-private-key.pem"
node server-ssl.js --cert="your-certificate.pem" --pk="your-private-key.pem"
```

> [!IMPORTANT]
> Your `Certificate` and `Private Key` should be relative to the `SSL` folder if you bring your own

### Create SSL Certificate

`start-windows.bat` will automatically create a `Certificate` and `Private Key` when you run it if you don't provide any and none exist

[![](https://i.imgur.com/vAMuDOG.png)](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip)

--------

### Node.js

When you run `start-windows.bat` the first time the latest version of `node.exe` portable will be downloaded