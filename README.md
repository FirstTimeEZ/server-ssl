# server-ssl.js

Easily configure a `Web Server` that uses `SSL`

Includes the style-sheet from [`responsive`](https://github.com/FirstTimeEZ/responsive)

--------

### Start the Server

Right click and select [`Open Git Bash Here`](https://git-scm.com/downloads/win) in the same folder as `start-windows.bat` (recommended)

![](https://i.imgur.com/WkLlML1.png)

You can also use the `Command Prompt`

Portable [`OpenSSL`](https://github.com/FirstTimeEZ/openssl) will be downloaded temporarily if you don't have it installed.

![](https://i.imgur.com/COxLCaf.png)

```
./start-windows.bat
```

With no arguments the server will start on port `443` with a `self signed certificate`

You can view the website in your browser at `https://localhost`

![](https://i.imgur.com/4AeJ9Rs.png)

Your browser may warn you the certificate is self signed, this is normal.

If you changed the port to something other than `443` or `80` then you have to use `https://localhost:PORT/`

--------

### Arguments

| Arguments       | Description                                      | Default Value         |
|--------------|--------------------------------------------------|-----------------------|
| `--port=`    | Specifies the port number (443 for HTTPS, 80 for HTTP) | `443` |
| `--cert=`    | Specifies the path to the SSL certificate file. | `"certificate.pem"` |
| `--pk=`      | Specifies the path to the private key file associated with the SSL certificate. | `"private-key.pem"` |
| `--site=`    | Specifies the directory for the website files | `"website"` |
| `--error=`   | Specifies the directory for error messages (404,500) | `"error"` |

--------

### Create SSL Certificate

`start-windows.bat` will automatically create a `certificate` and `private key` when you run it if you don't provide any and none exist

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
├── /website
│   └── index.html
│
├── server-ssl.js
└── start-windows.bat
```

--------

### 404/500 Pages

The server is configured to serve custom `404` and `500` error pages. 

![](https://i.imgur.com/LvLnXMR.png)

Currently everything is treated like a `Server Error` except for `Page Not Found`

![](https://i.imgur.com/HJoNquS.png)

If you want to add more specific custom error pages, place them in the `/error` folder and update `server-ssl.js`

--------

### Port

By default, the server runs on port `443`

You can provide a different port as an argument.

```
./start-windows.bat --port=443 --cert="certificate.pem" --pk="private-key.pem"
```

You can also set the `PORT` env variable in `Node.js` or modify `server-ssl.js`

--------

### Node.js

When you run `start-windows.bat` the first time the latest version of `node.exe` portable will be downloaded

### Use Directly

You can use `server-ssl.js` directly if you have a valid `certificate`,`private key` and `Node.js` already installed