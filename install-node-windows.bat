@echo off
setlocal

set "NODE_MSI_URL=https://nodejs.org/dist/v23.2.0/node-v23.2.0-x64.msi"
set "MSI_FILE=node-v23.2.0-x64.msi"

echo Downloading Node.js
curl -o "%MSI_FILE%" "%NODE_MSI_URL%"

if exist "%MSI_FILE%" (
    echo Installing Node.js...
    msiexec /i "%MSI_FILE%" /quiet /norestart

    if %errorlevel% equ 0 (
        echo Node.js installed successfully.
    ) else (
        echo Installation failed with error code %errorlevel%.
    )
) else (
    echo Failed to download the MSI file.
)

:: Clean up
del "%MSI_FILE%"
endlocal