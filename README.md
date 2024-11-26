# server-ssl.js

Easy to configure `SSL Web Server` that can be used for development or production

`HTTP` requests are redirected to `HTTPS`

Production servers can use and renew `Lets Encrypt 90 Day Certificates` automatically.

Designed to get out of your way, you can still change anything about the server.

--------

### Getting Started

1. [`Clone`](https://github.com/FirstTimeEZ/server-ssl.git) or [`Download`](https://github.com/FirstTimeEZ/server-ssl/archive/refs/heads/main.zip) the main branch and extract it somewhere
2. Open the folder in `Command Prompt` or `Git Bash`
3. Run `start-windows.bat` 

`start-windows.bat` takes arguments and starts the server, it also restarts the server when certificates are renewed.

```
# Start for development (Self Signed Certificate, Port 443, https://localhost)
./start-windows.bat

# Start for production (Lets Encrypt!)
./start-windows.bat --letsEncrypt --domains=["www.ssl.boats","ssl.boats"]

# Start for production (BYO)
./start-windows.bat --cert="your-certificate.pem" --pk="your-private-key.pem"
```

[![](https://i.imgur.com/s4bhdHK.png)](https://github.com/FirstTimeEZ/server-ssl)

--------

### Optional Arguments

`server-ssl.js` has some optional arguments you can use in production if the defaults aren't enough.

| Arguments/Flags       | Description                                      | Default Value         |
|-------------------------|----------------------------------|-----------------------|
| `--port=`      | Specifies the port number for `HTTPS` | `443` |
| `--portHttp=`  | Specifies the port number for HTTP that will be redirected | `80` |
| `--cert=`      | Specifies the path to the `SSL` certificate file. | `"certificate.pem"` |
| `--pk=`        | Specifies the path to the private key file for the `SSL` certificate. | `"private-key.pem"` |
| `--site=`      | Specifies the directory for the website files | `"website"` |
| `--error=`     | Specifies the directory for error messages (404,500) | `"error"` |
| `--entry=`     | Specifies the page to use for the entry point | `"index.html"` |

All Arguments are case sensitive.

### Use Lets Encrypt!

You can use `Lets Encrypt` to generate certificates, 

Certificates are valid for `90 days` but are renewed automatically sooner.

| Automated Lets Encrypt!       | Description                                      |
|-------------------------|----------------------------------|
| `--letsEncrypt` | Specifies that `Lets Encrypt!` should be used to generate 90 day certificates |
| `--domains=` | Specifies the domains to generate certificates for, this can not include wild cards, this should be an array. eg. `--domains=["www.ssl.boats","ssl.boats"]` |
| `--generateAnyway` | Specifies that certificates should always be generated when the server starts, this could get you rate limited, maybe use `--staging`  |
| `--staging` | Specifies that the `Lets Encrypt!` staging server should be used instead of production |
| `--autoRestart` | Specifies that the server should restart after certificates are generated, must use with `start-windows.bat` |

Certificates renew when you restart your server unless you use `--autoRestart`, so restart at least once a month.

```
./start-windows.bat --letsEncrypt --domains=["www.ssl.boats","ssl.boats"] --autoRestart
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
├── server-ssl.js
└── start-windows.bat
```

--------

### 404/500 Pages

The server is configured to serve custom `404` and `500` error pages.

[![](https://i.imgur.com/nMBfDnr.png)](https://github.com/FirstTimeEZ/server-ssl)

Currently everything is treated like a `Server Error` except for `Page Not Found`

[![](https://i.imgur.com/ryZTxII.png)](https://github.com/FirstTimeEZ/server-ssl)

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

![](https://i.imgur.com/vAMuDOG.png)

--------

### Node.js

When you run `start-windows.bat` the first time the latest version of `node.exe` portable will be downloaded