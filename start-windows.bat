@REM author : Copyright © 2024 FirstTimeEZ
@REM license: http://www.apache.org/licenses/LICENSE-2.0

@echo off
setlocal enabledelayedexpansion

set currentPath=%cd%
set "AR=0"

set "PORT="
set "CERT="
set "PK="
set "DATE="
set "KEYS=0"
set "SKIPNODE=0"
set "OPEN_SSL="
set "OPEN_SSL_IN_PATH=0"
set "STAGING=0"
set "PATH1=production"

title Starting SSL Web Server

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
) else if "%~1"=="--skipNodeUpdate" (
    set "SKIPNODE=1"
    shift
) else if "%~1"=="--staging" (
    set "STAGING=1"
    shift
)

shift
goto loop
:endloop

if NOT "%PORT%"=="" ( echo Port: %PORT% )

IF "%STAGING%"=="1" (
    set "PATH1=staging"
)

if NOT EXIST "%currentPath%/ssl/!PATH1!" (
    mkdir "%currentPath%/ssl/%PATH1%"
)

@REM check if openssl is in the ssl folder
@REM prefers openssl from the ssl folder
IF "%OPEN_SSL_IN_PATH%"=="0" (
    IF EXIST "%currentPath%/ssl/openssl/bin/" (
        set OPEN_SSL_IN_PATH=2
    )
)

@REM check if openssl is in the path
@REM if you already have openssl installed this should find it
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

@REM OpenSSL isn't intalled and the folder is missing, download minimum requirements from Github raw commit
@REM this is the same files from Git Bash MINGW64
IF "!OPEN_SSL_IN_PATH!"=="0" (
      echo --------
      echo OpenSSL not found, downloading Git Bash OpenSSL
      echo OpenSSL will be stored in the SSL folder for future use.
      echo %currentPath%
      curl -o "%currentPath%/ssl/openssl.zip" "https://github.com/FirstTimeEZ/openssl/raw/899c6ee03d25e0bc37f3d624969ac5e6018144e0/openssl-3-2-3.zip" -L --ssl-no-revoke --retry 5
      mkdir "%currentPath%/ssl"
      cd %currentPath%/ssl/
      tar -xf openssl.zip
      del openssl.zip
      cd ..

      set OPEN_SSL_IN_PATH=2
)

@REM unable to continue without openssl
@REM OpenSSL is required for the fallback renewal timing mechanism and to generate local certificates
@REM You can run server-ssl.js directly if you don't care about either of these things
IF "!OPEN_SSL_IN_PATH!"=="0" (
    echo You need OpenSSL in your path to use this
    exit
)

if "%CERT%"=="" (
    set "CERT=certificate.pem"
    if NOT EXIST "%currentPath%/ssl/%PATH1%/!CERT!" ( set "KEYS=1" )
)

if "%PK%"=="" (
    set "PK=private-key.pem"
    if NOT EXIST "%currentPath%/ssl/%PATH1%/!PK!" ( set "KEYS=1" )
)

if "%KEYS%"=="1" (
    echo --------
    echo Generating Keys for Local Development

    if "!OPEN_SSL_IN_PATH!"=="1" (
        openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout "ssl/%PATH1%/%PK%" -out "ssl/%PATH1%/%CERT%" -days 365 -subj "/CN=localhost"
    )

    if "!OPEN_SSL_IN_PATH!"=="2" (
        %currentPath%/ssl/openssl/bin/openssl.exe req -x509 -newkey rsa:2048 -nodes -sha256 -keyout "ssl/%PATH1%/%PK%" -out "ssl/%PATH1%/%CERT%" -days 365 -subj "/CN=localhost"
    )

    if EXIST "%currentPath%/ssl/%PATH1%/%PK%" ( echo Successfully Generated Private Key ) 
    if EXIST "%currentPath%/ssl/%PATH1%/%CERT%" ( echo Successfully Generated Certificate ) else (
        echo Certificate Needed to continue Install OpenSSL and try again
        exit
    )
)

IF "%SKIPNODE%"=="0" (
    @REM Install/Update NPM Packages

    call npm update

    if %errorlevel% neq 0 ( echo Npm is missing, Install Node.js and try again
        exit 0
    )
)

node -v >nul 2>&1

if %errorlevel% neq 0 ( echo Install Node.js and try again
    exit 0
)

echo Starting SSL Web Server
title SSL Web Server
:restartLoop
setlocal

@REM Check Certificate end date

if "!OPEN_SSL_IN_PATH!"=="1" (
    for /f "tokens=2 delims==" %%a in ('openssl x509 -in "%currentPath%/ssl/%PATH1%/%CERT%" -enddate -noout') do (
        set "DATE=%%a"
    )
)

if "!OPEN_SSL_IN_PATH!"=="2" (
    for /f "tokens=2 delims==" %%a in ('%currentPath%/ssl/openssl/bin/openssl.exe x509 -in "%currentPath%/ssl/%PATH1%/%CERT%" -enddate -noout') do (
        set "DATE=%%a"
    )
)

node.exe server-ssl.js %* --arAvailable --notAfter="!DATE!"

set exitCode=%errorlevel%

if %exitCode%==123 (
    echo Server exited because certificates were generated. 
    echo Restarting...
    goto restartLoop
)

endlocal