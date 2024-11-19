# server-ssl.js

Easily configure a `Web Server` that uses `SSL`

Includes the style-sheet from [`responsive`](https://github.com/FirstTimeEZ/responsive)

### Node.js

The server is [`Node.js`](https://nodejs.org/en), so you should install the most recent version.

You can run the included scripts to install [`Node.js`](https://nodejs.org/en) or download it from their website.

--------

### Arguments

| Arguments       | Description                                      | Default Value         |
|--------------|--------------------------------------------------|-----------------------|
| `--port=`    | Specifies the port number (443 for HTTPS, 80 for HTTP) | `3000` |
| `--cert=`    | Specifies the path to the SSL certificate file. | `"certificate.pem"` |
| `--pk=`      | Specifies the path to the private key file associated with the SSL certificate. | `"private-key.pem"` |
| `--site=`    | Specifies the directory for the website files | `"website"` |
| `--error=`   | Specifies the directory for error messages (404,500) | `"error"` |

--------

### Start the Server

Right click and select [`Open Git Bash Here`](https://git-scm.com/downloads/win) in the same folder as `server-ssl.js`

start `server-ssl.js` with `node.js` using whatever arguments you need, eg.

```
node server-ssl.js --port=443 --cert="certificate.pem" --pk="private-key.pem"
```

![](https://i.imgur.com/ULvqsvt.png)

You can then view the website in your browser at `https://localhost`

![](https://i.imgur.com/4AeJ9Rs.png)

Your browser may warn you the certificate is self signed, this is normal.

If you changed the port you have to use `https://localhost:PORT/`

--------

### Create SSL Certificate

If you don't have a `certificate` and `private key` in `pem format` and are developing locally you can create one

Right click and select [`Open Git Bash Here`](https://git-scm.com/downloads/win) in the same folder as `server-ssl.js` and run this command.

```
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout private-key.pem -out certificate.pem -days 365 -subj "//CN=localhost"
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
├── /website
│   └── index.html
│
└── server-ssl.js
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

By default, the server runs on port `3000`

You can provide a different port as an argument.

```
node server-ssl.js --port=443 --cert="certificate.pem" --pk="private-key.pem"
```

You can also set the `PORT` env variable in `Node.js` or modify `server-ssl.js`