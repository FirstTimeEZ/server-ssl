@echo off
setlocal

IF EXIST "node.exe" (
    echo Node.js already exists
) ELSE (
    echo Downloading Node.js
    curl -o "node.exe" "https://nodejs.org/dist/latest/win-x64/node.exe" -L
)

node.exe server-ssl.js %*

endlocal
pause