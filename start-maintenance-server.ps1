param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$url = 'http://127.0.0.1:8000/index.html'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-MaintenanceServer {
    try {
        return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200
    } catch {
        return $false
    }
}

$ready = Test-MaintenanceServer
if (-not $ready) {
    $python = Get-Command py -ErrorAction SilentlyContinue
    if ($python) {
        Start-Process -FilePath $python.Source -ArgumentList @('-3', '-m', 'http.server', '8000', '--bind', '127.0.0.1') -WorkingDirectory $root -WindowStyle Hidden
    } else {
        $python = Get-Command python -ErrorAction SilentlyContinue
        if (-not $python) { throw 'Python was not found.' }
        Start-Process -FilePath $python.Source -ArgumentList @('-m', 'http.server', '8000', '--bind', '127.0.0.1') -WorkingDirectory $root -WindowStyle Hidden
    }
    for ($attempt = 0; $attempt -lt 30 -and -not $ready; $attempt++) {
        Start-Sleep -Milliseconds 150
        $ready = Test-MaintenanceServer
    }
}

if (-not $ready) { throw 'The local server could not be started.' }
if (-not $NoBrowser) { Start-Process $url }