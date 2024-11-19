# server-ssl.js

Easily configure a `Web Server` that uses `SSL`

Includes the style-sheet from [`responsive`](https://github.com/FirstTimeEZ/responsive)

--------

### Start the Server

Right click and select [`Open Git Bash Here`](https://git-scm.com/downloads/win) in the same folder as `start-windows.bat`

```
./start-windows.bat
```

![](https://i.imgur.com/rXINeXI.png)

The server will start on port `443` and you can view the website in your browser at `https://localhost`

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

`start-windows.bat` will automatically create keys when you run it if you don't provide any and none exist

You must be using [`Git Bash`](https://git-scm.com/downloads/win) for keys to get created automatically

![](https://i.imgur.com/rXINeXI.png)

If you don't have a `certificate` and `private key` in `pem format` and are developing locally you can also create them manually.

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

By default, the server runs on port `3000`

You can provide a different port as an argument.

```
 ./start-windows.bat --port=443 --cert="certificate.pem" --pk="private-key.pem"
```

You can also set the `PORT` env variable in `Node.js` or modify `server-ssl.js`

--------

### Node.js

When you run `start-windows.bat` the latest version of `node.exe` portable will be downloaded

If you already have `Node.js` installed you can run `server-ssl.js` directly instead

--------

### Command Prompt

If you run `start-windows.bat` with command prompt and keys need to be generated then `openssl` will be downloaded.

![](https://i.imgur.com/COxLCaf.png)

`openssl` is only `3mb` and will be downloaded from the release page

Its recommended you use [`Git Bash`](https://git-scm.com/downloads/win) (its the same files)