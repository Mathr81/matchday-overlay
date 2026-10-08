@echo off
rem Lance matchday-overlay : installe les dependances, construit les pages, demarre le serveur.
cd /d "%~dp0"
call pnpm install
call pnpm start
pause
