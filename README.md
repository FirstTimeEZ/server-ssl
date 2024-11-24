# server-ssl.js

Easy to configure `SSL Web Server` that can be used for development or production

`HTTP` requests are redirected to `HTTPS`

Production servers can use and renew `Lets Encrypt 90 Day Certificates` automatically.

--------

### Start the Server

`start-windows.bat` takes arguments and starts the server, it also restarts the server when certificates are renewed.

```
# Start for development (Self Signed Certificate, Port 443, https://localhost)
./start-windows.bat

# Start for production (Lets Encrypt!)
./start-windows.bat --letsEncrypt --domains=["www.ssl.boats","ssl.boats"]

# Start for production (BYO)
./start-windows.bat --cert="your-certificate.pem" --pk="your-private-key.pem"
```

[![](https://i.imgur.com/4AeJ9Rs.png)](https://github.com/FirstTimeEZ/responsive)

Your browser may warn you the certificate is self signed, this is normal.

If you changed the port to something other than `443` or `80` then you have to use `https://localhost:PORT/`

--------

### Arguments

To use `server-ssl.js` in production you will need to provide arguments, they are case sensitive.

| Arguments/Flags       | Description                                      | Default Value         |
|-------------------------|----------------------------------|-----------------------|
| `--port=`      | Specifies the port number for `HTTPS` | `443` |
| `--portHttp=`  | Specifies the port number for HTTP that will be redirected | `80` |
| `--cert=`      | Specifies the path to the `SSL` certificate file. | `"certificate.pem"` |
| `--pk=`        | Specifies the path to the private key file for the `SSL` certificate. | `"private-key.pem"` |
| `--site=`      | Specifies the directory for the website files | `"website"` |
| `--error=`     | Specifies the directory for error messages (404,500) | `"error"` |
| `--entry=`     | Specifies the page to use for the entry point | `"index.html"` |
| `--noRedirect` | Specifies that `HTTP` requests should not be redirected | `not present` |

| Automated Lets Encrypt!       | Description                                      |
|-------------------------|----------------------------------|
| `--letsEncrypt` | Specifies that `Lets Encrypt!` should be used to generate 90 day certificates |
| `--domains=` | Specifies the domains to generate certificates for, this can not include wild cards, this should be an array. eg. `--domains=["www.ssl.boats","ssl.boats"]` |
| `--generateAnyway` | Specifies that certificates should always be generated when the server starts, this could get you rate limited, maybe use `--staging`  |
| `--staging` | Specifies that the `Lets Encrypt!` staging server should be used instead of production |
| `--autoRestart` | Specifies that the server should restart after certificates are generated, must use with `start-windows.bat` |

--------

### Use Lets Encrypt!

You can use `Lets Encrypt` to generate certificates, these are valid for 90 days.

These certificates will renew when you restart your server, so make sure you restart at least every 30 days.

```
./start-windows.bat --letsEncrypt --domains=["www.ssl.boats","ssl.boats"]
```

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
│   ├── /module
│   │   ├── /crypt
│   │   ├── /jose
│   │   └── lets-encrypt-acme-client.js
│   │ 
│   ├── acmeKeys
│   ├── private-key.pem
│   └── certificate.pem
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

[![](https://i.imgur.com/LvLnXMR.png)](https://github.com/FirstTimeEZ/responsive)

Currently everything is treated like a `Server Error` except for `Page Not Found`

[![](https://i.imgur.com/HJoNquS.png)](https://github.com/FirstTimeEZ/responsive)

If you want to add more specific custom error pages, place them in the `/error` folder and update `server-ssl.js`

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