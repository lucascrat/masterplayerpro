@echo off
REM Krator+ relay agent — keeps running, auto-restarts if it exits.
REM Put this machine's residential IP to work for the app.

cd /d "%~dp0"

REM ---- CONFIG: paste the key the server uses (RELAY_KEY) ----
set KRATOR_KEY=otvQPnr7rO9GQZRAgqCHaF5U_rD8vRcP
set KRATOR_HUB=wss://krator.appbr.pro/api/relay/agent
REM ----------------------------------------------------------

:loop
echo [%date% %time%] starting agent...
node "%~dp0agent.mjs"
echo [%date% %time%] agent exited, restarting in 5s
timeout /t 5 /nobreak >nul
goto loop
