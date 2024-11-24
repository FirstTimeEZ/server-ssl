@echo off

set currentPath=%cd%
set "AR=0"

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

if NOT EXIST "%currentPath%/ssl" ( mkdir "%currentPath%/ssl" )

if NOT "%PORT%"=="" ( echo Port: %PORT% )

if "%CERT%"=="" (
    if NOT EXIST "%currentPath%/ssl/certificate.pem" ( set "KEYS=1" )
) else ( echo Certificate: %CERT% )

if "%PK%"=="" ( 
    if NOT EXIST "%currentPath%/ssl/private-key.pem" ( set "KEYS=1" )
) else ( echo Private Key: %PK% )

if "%KEYS%"=="1" (
    echo Generating Keys for Local Development
    openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ssl/private-key.pem -out ssl/certificate.pem -days 365 -subj "/CN=localhost"
    if EXIST "%currentPath%/ssl/private-key.pem" ( echo Successfully Generated Private Key ) else (
        echo Download GitBash OpenSSL and Generate Keys
        curl -o "openssl.zip" "https://github.com/FirstTimeEZ/openssl/raw/899c6ee03d25e0bc37f3d624969ac5e6018144e0/openssl-3-2-3.zip" -L --ssl-no-revoke --retry 5
        tar -xf openssl.zip
        del openssl.zip
        cd openssl/bin
        openssl.exe req -x509 -newkey rsa:2048 -nodes -sha256 -keyout "%currentPath%/ssl/private-key.pem" -out "%currentPath%/ssl/certificate.pem" -days 365 -subj "/CN=localhost"
        cd ../..
        rmdir /S /Q openssl
        echo Cleaning up Open SSL
        if EXIST "%currentPath%/ssl/private-key.pem" ( echo Successfully Generated Private Key ) else ( echo Private Key Needed, Install OpenSSL and run again. )
    )

    if EXIST "%currentPath%/ssl/certificate.pem" ( echo Successfully Generated Certificate ) else ( echo Certificate Needed, Install OpenSSL and run again. )
)

setlocal

if EXIST "node.exe" ( echo Node.js already exists ) else (
    echo Downloading Node.js
    curl -o "node.exe" "https://nodejs.org/dist/latest/win-x64/node.exe" -L --retry 5
)

:restartLoop

echo Starting SSL Web Server

node.exe server-ssl.js %* --arAvailable

set exitCode=%errorlevel%

if %exitCode%==123 (
    echo Server exited because certificates were generated. 
    echo Restarting...
    goto restartLoop
)

endlocal