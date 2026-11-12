@echo off
REM Robo do Clube da Venda (TradePro): visitas e vendas do dia -> D1. Roda no PC do Vitorio (decisao dele, 12/11/2026). Login fica em %USERPROFILE%\.ceven\clube.env (fora do repositorio).
cd /d "%~dp0"
for /f "usebackq tokens=1,* delims==" %%a in ("%USERPROFILE%\.ceven\clube.env") do set "%%a=%%b"
if not exist "%USERPROFILE%\.ceven\logs" mkdir "%USERPROFILE%\.ceven\logs"
node pipeline\clube_coletor.mjs --d1 --saida="%TEMP%\clube_ultimo.json" >> "%USERPROFILE%\.ceven\logs\clube.log" 2>&1
