# server-ssl.js

Easy to configure `SSL Web Server` that can be used for development or production

`HTTP` requests are redirected to `HTTPS`

Includes the style-sheet from [`responsive`](https://github.com/FirstTimeEZ/responsive)

--------

### Start the Server

`start-windows.bat` will start the server for development if you provide no arguments.

This will be on port `443` with a `self signed certificate`

```
# Start for development
./start-windows.bat

# Start for production
./start-windows.bat --cert="your-certificate.pem" --pk="your-private-key.pem"
```

<details> <summary>Show the differences between starting with <a href="https://git-scm.com/downloads/win">Git Bash</a> or Command Prompt</summary>

Right click and select [`Open Git Bash Here`](https://git-scm.com/downloads/win) in the same folder as `start-windows.bat` (recommended)

[![](https://i.imgur.com/3QTywrk.png)](https://git-scm.com/downloads/win)[![](https://i.imgur.com/dGRvsRe.png)](https://git-scm.com/downloads/win)

You can also use the `Command Prompt`

Portable [`OpenSSL`](https://github.com/FirstTimeEZ/openssl) will be downloaded temporarily if required to generate keys if you use `Command Prompt`

[![](https://i.imgur.com/2anEyXe.png)](https://github.com/FirstTimeEZ/responsive)[![](https://i.imgur.com/wzs3sXc.png)](https://github.com/FirstTimeEZ/responsive)

</details>

You can view the website in your browser at `https://localhost`

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
| `--pk=`        | Specifies the path to the private key file associated with the `SSL` certificate. | `"private-key.pem"` |
| `--site=`      | Specifies the directory for the website files | `"website"` |
| `--error=`     | Specifies the directory for error messages (404,500) | `"error"` |
| `--entry=`     | Specifies the page to use for the entry point | `"index.html"` |
| `--noRedirect` | Specifies that `HTTP` requests should not be redirected | `not present` |

> [!IMPORTANT]
> Your `Certificate` and `Private Key` should be relative to the `SSL` folder if you bring your own

--------

### Bring Your Own SSL Certificate

```
./start-windows.bat --cert="your-certificate.pem" --pk="your-private-key.pem"
```

or

```
node server-ssl.js --cert="your-certificate.pem" --pk="your-private-key.pem"
```

> [!IMPORTANT]
> Your `Certificate` and `Private Key` should be relative to the `SSL` folder if you bring your own

### Create SSL Certificate

`start-windows.bat` will automatically create a `Certificate` and `Private Key` when you run it if you don't provide any and none exist

![](https://i.imgur.com/vAMuDOG.png)

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
│   ├── your-private-key.pem
│   └── your-certificate.pem
│
├── /website
│   └── index.html
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