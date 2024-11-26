@echo off
setlocal enabledelayedexpansion

set currentPath=%cd%
set "AR=0"

set "PORT="
set "CERT="
set "PK="
set "DATE="
set "KEYS=0"
set "OPEN_SSL="
set "OPEN_SSL_IN_PATH=0"

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

@REM check if openssl has been downloaded already
IF "%OPEN_SSL_IN_PATH%"=="0" (
    IF EXIST "%currentPath%/ssl/openssl/bin/" (
        set OPEN_SSL_IN_PATH=2
    )
)

@REM check if openssl is in the path
IF "%OPEN_SSL_IN_PATH%"=="0" (
for /f "tokens=1 delims==" %%a in ('openssl -v') do (
        set "firstChar=%%a"
        if "!firstChar:~0,1!"=="O" (
            echo --------
            echo %%a
            set OPEN_SSL_IN_PATH=1
        )
    )
)

@REM openssl still hasn't been found, download minimum requirements
IF "!OPEN_SSL_IN_PATH!"=="0" (
      echo --------
      echo OpenSSL not found, downloading Git Bash OpenSSL
      echo OpenSSL will be stored in the SSL folder for future use.
      echo %currentPath%
      curl -o "%currentPath%/ssl/openssl.zip" "https://github.com/FirstTimeEZ/openssl/raw/899c6ee03d25e0bc37f3d624969ac5e6018144e0/openssl-3-2-3.zip" -L --ssl-no-revoke --retry 5
      echo %currentPath%
      cd %currentPath%/ssl/
      tar -xf openssl.zip
      del openssl.zip
      cd ..

      set OPEN_SSL_IN_PATH=2
)

@REM unable to continue without openssl
IF "!OPEN_SSL_IN_PATH!"=="0" (
    echo You need OpenSSL in your path to use this
    exit
)

if "!OPEN_SSL_IN_PATH!"=="1" (
    for /f "tokens=2 delims==" %%a in ('openssl x509 -in "%currentPath%/ssl/certificate.pem" -enddate -noout') do (
        set "DATE=%%a"
        echo --------
        echo The certificate expires on: %%a
    )
)

if "!OPEN_SSL_IN_PATH!"=="2" (
    for /f "tokens=2 delims==" %%a in ('%currentPath%/ssl/openssl/bin/openssl.exe x509 -in "%currentPath%/ssl/certificate.pem" -enddate -noout') do (
        set "DATE=%%a"
        echo --------
        echo The certificate expires on: %%a
    )
)

if "%CERT%"=="" (
    if NOT EXIST "%currentPath%/ssl/certificate.pem" ( set "KEYS=1" )
)

if "%PK%"=="" (
    if NOT EXIST "%currentPath%/ssl/private-key.pem" ( set "KEYS=1" )
)

if "%KEYS%"=="1" (
    echo --------
    echo Generating Keys for Local Development

    if "!OPEN_SSL_IN_PATH!"=="1" (
        openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ssl/private-key.pem -out ssl/certificate.pem -days 365 -subj "/CN=localhost"
    )

    if "!OPEN_SSL_IN_PATH!"=="2" (
        %currentPath%/ssl/openssl/bin/openssl.exe req -x509 -newkey rsa:2048 -nodes -sha256 -keyout ssl/private-key.pem -out ssl/certificate.pem -days 365 -subj "/CN=localhost"
    )

    if EXIST "%currentPath%/ssl/private-key.pem" ( echo Successfully Generated Private Key ) 
    if EXIST "%currentPath%/ssl/certificate.pem" ( echo Successfully Generated Certificate ) else (
        echo Certificate Needed to continue Install OpenSSL and try again
        exit
    )
)

if EXIST "node.exe" ( echo Node.js already exists ) else (
    echo Downloading Node.js
    curl -o "node.exe" "https://nodejs.org/dist/latest/win-x64/node.exe" -L --retry 5
)

setlocal

:restartLoop

echo Starting SSL Web Server

node.exe server-ssl.js %* --arAvailable --notAfter=!DATE!

set exitCode=%errorlevel%

if %exitCode%==123 (
    echo Server exited because certificates were generated. 
    echo Restarting...
    goto restartLoop
)

endlocal