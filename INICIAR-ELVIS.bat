@echo off
chcp 65001 >nul
title Elvis Automotores - versión completa
cd /d "%~dp0"
echo.
echo   ELVIS AUTOMOTORES - sitio + panel + base de datos (todo en esta PC)
echo.
where docker >nul 2>nul
if errorlevel 1 (
  echo   Falta Docker Desktop. Se abre la pagina para descargarlo.
  echo   Instálalo, ábrelo una vez y vuelve a ejecutar este archivo.
  start "" https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
  echo   Abre Docker Desktop, espera a que diga "Engine running" y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
echo   Iniciando... la primera vez tarda varios minutos.
docker compose up -d --build
if errorlevel 1 ( echo   No se pudo iniciar. Revisa los mensajes de arriba. & pause & exit /b 1 )
echo   Esperando a que el sitio responda...
powershell -NoProfile -Command "for($i=0;$i -lt 180;$i++){try{Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0}catch{Start-Sleep 2}}; exit 1"
start "" http://localhost:3000
start "" http://localhost:3000/dashboard
echo.
echo   Listo. Sitio: http://localhost:3000   Panel: http://localhost:3000/dashboard
echo   Usuario: 123   Contraseña: 123
echo   Para apagar: DETENER-ELVIS.bat (los datos quedan guardados).
echo.
pause
