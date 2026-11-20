@echo off
title Elvis Automotores - detener
cd /d "%~dp0"
docker compose down
echo   Detenido. Los datos quedan guardados en esta PC.
pause
