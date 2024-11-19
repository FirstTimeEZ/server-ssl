@echo off

set currentPath=%cd%
setlocal

set "PORT="
set "CERT="
set "PK="
set "KEYS=0"

:loop
if "%~1"=="" goto endloop
if "%~1"=="--port" (
    set PORT=%~2
    shift
) else if "%~1"=="--cert" (
    set CERT=%~2
    shift
) else if "%~1"=="--pk" (
    set PK=%~2
    shift
)
shift
goto loop
:endloop

if NOT "%PORT%"=="" ( echo Port: %PORT% )

if "%CERT%"=="" (
    if NOT EXIST "certificate.pem" ( set "KEYS=1" )
) else ( echo Certificate: %CERT% )

if "%PK%"=="" ( 
    if NOT EXIST "private-key.pem" ( set "KEYS=1" )
) else ( echo Private Key: %PK% )

if "%KEYS%"=="1" (
    echo Generating Keys for Local Development
    openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout private-key.pem -out certificate.pem -days 365 -subj "/CN=localhost"
    if EXIST "private-key.pem" ( echo Successfully Generated Private Key ) else (
        echo Download GitBash OpenSSL and Generate Keys
        curl -o "openssl.zip" "https://github.com/FirstTimeEZ/openssl/raw/899c6ee03d25e0bc37f3d624969ac5e6018144e0/openssl-3-2-3.zip" -L --ssl-no-revoke --retry 5
        tar -xf openssl.zip
        del openssl.zip
        cd openssl/bin
        openssl.exe req -x509 -newkey rsa:2048 -nodes -sha256 -keyout "%currentPath%/private-key.pem" -out "%currentPath%/certificate.pem" -days 365 -subj "/CN=localhost"
        cd ../..
        rmdir /S /Q openssl
        echo Cleaning up Open SSL
        if EXIST "private-key.pem" ( echo Successfully Generated Private Key ) else ( echo Private Key Needed, Install OpenSSL and run again. )
    )

    if EXIST "certificate.pem" ( echo Successfully Generated Certificate ) else ( echo Certificate Needed, Install OpenSSL and run again. )
)

endlocal

setlocal

if EXIST "node.exe" ( echo Node.js already exists ) else (
    echo Downloading Node.js
    curl -o "node.exe" "https://nodejs.org/dist/latest/win-x64/node.exe" -L --retry 5
)

echo Starting SSL Web Server

node.exe server-ssl.js %*

endlocal