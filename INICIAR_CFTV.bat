@echo off
title CEVEN CFTV - Central de Monitoramento
color 0A
echo =============================================================
echo   INICIANDO A CENTRAL DE CFTV COMERCIAL (11 FILIAIS)...
echo =============================================================

:: Fecha processos antigos do Node
taskkill /F /IM node.exe >nul 2>&1

:: Abre o navegador automaticamente em 2 segundos
start "" http://localhost:3000

:: Inicia o servidor Node
node server.js
pause
