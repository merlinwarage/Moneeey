# dev-start.ps1
# PowerShell script to check/install Node.js via nvm, install dependencies, start dev server, and open browser

# --- 1. Ensure nvm-windows is installed ---
function Test-CommandExists {
    param($cmd)
    return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

if (-not (Test-CommandExists "nvm")) {
    Write-Host "nvm not found. Installing nvm-windows..." -ForegroundColor Yellow

    $nvmDir = "$env:TEMP\nvm-setup"
    New-Item -ItemType Directory -Path $nvmDir -Force | Out-Null

    $nvmZipUrl = "https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.zip"
    $nvmZipPath = "$nvmDir\nvm-setup.zip"

    Write-Host "Downloading nvm-windows installer..." -ForegroundColor Green
    Invoke-WebRequest -Uri $nvmZipUrl -OutFile $nvmZipPath

    Write-Host "Extracting installer..." -ForegroundColor Green
    Expand-Archive -Path $nvmZipPath -DestinationPath $nvmDir -Force

    $installerPath = "$nvmDir\nvm-setup.exe"
    Write-Host "Running nvm-windows installer (silent)..." -ForegroundColor Green
    Start-Process -FilePath $installerPath -ArgumentList "/quiet" -Wait -Verb RunAs

    # Refresh environment variables in current session so `nvm` is recognized without reopening the shell
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"

    if (-not (Test-CommandExists "nvm")) {
        Write-Host "nvm installation completed, but 'nvm' is not recognized in this session." -ForegroundColor Red
        Write-Host "Please close and reopen PowerShell, then re-run this script." -ForegroundColor Red
        exit 1
    }

    Write-Host "nvm-windows installed successfully." -ForegroundColor Cyan
} else {
    Write-Host "nvm is already installed." -ForegroundColor Cyan
}

# --- 2. Install and use latest Node.js LTS via nvm ---
Write-Host "Checking Node.js LTS version..." -ForegroundColor Green

# nvm-windows requires admin rights for install/use operations
#nvm install lts
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install Node.js LTS via nvm. Try running PowerShell as Administrator." -ForegroundColor Red
    exit 1
}

# Determine the installed LTS version number and switch to it
$ltsLine = (nvm list) | Select-String -Pattern "\d+\.\d+\.\d+" | Select-Object -First 1
$ltsVersion = ($ltsLine -match "(\d+\.\d+\.\d+)") | Out-Null
$ltsVersion = $Matches[1]

if ($ltsVersion) {
    nvm use $ltsVersion
} else {
    nvm use lts
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to switch to Node.js LTS. Try running PowerShell as Administrator." -ForegroundColor Red
    exit 1
}

Write-Host "Node.js version in use:" -ForegroundColor Cyan
node -v
npm -v

# --- 3. Install dependencies ---
Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Starting development server..." -ForegroundColor Green
# Start npm start in a new PowerShell window so it stays open after this script ends
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WorkingDirectory $PSScriptRoot

Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Opening browser..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host "Development server started in a separate PowerShell window." -ForegroundColor Cyan
Write-Host "You can close this window." -ForegroundColor Cyan