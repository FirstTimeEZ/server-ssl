> [!IMPORTANT]
> Your `Cerfificate` and `Private Key` should be relative to the `SSL` folder if your bring your own

```
./start-windows.bat --cert="your-certificate.pem" --pk="your-private-key.pem"
```

If a `Certificate` and `Private Key` are created automatically, they will be placed in this folder.

```
node server-ssl.js --cert="certificate.pem" --pk="private-key.pem"
```

If you delete this folder, it will be recreated.