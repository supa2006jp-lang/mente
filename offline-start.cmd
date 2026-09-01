@echo off
setlocal
set "CALENDAR_APP_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$root=$env:CALENDAR_APP_DIR.TrimEnd('\'); $url='http://127.0.0.1:8000/index.html'; $running=$false; try { $response=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; $running=$response.StatusCode -eq 200 } catch {}; if (-not $running) { Start-Process -FilePath 'python' -ArgumentList @('-m','http.server','8000','--bind','127.0.0.1') -WorkingDirectory $root -WindowStyle Hidden; Start-Sleep -Seconds 1 }; Start-Process $url"
endlocal