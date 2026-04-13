@echo off
REM App-carro - Instalador automatico (wrapper .bat pra clicar duas vezes)
REM
REM Este .bat e so um atalho: ele baixa e executa o install-windows.ps1
REM do GitHub com ExecutionPolicy relaxada. Util pra quem nao quer abrir
REM o PowerShell manualmente.

title App-carro - Instalador

echo.
echo ================================
echo   App-carro - Instalador
echo ================================
echo.
echo Este instalador vai:
echo   - Instalar Node.js e Git (se precisar)
echo   - Baixar o App-carro em %%USERPROFILE%%\App-carro
echo   - Iniciar o servidor
echo   - Abrir http://localhost:3000 no navegador
echo.
echo Voce vai precisar aceitar uma ou duas vezes um popup de
echo Administrador (UAC). Isso e normal.
echo.
pause

powershell -ExecutionPolicy Bypass -NoProfile -Command "irm https://raw.githubusercontent.com/videon8n/App-carro/main/install-windows.ps1 | iex"

echo.
echo Instalador terminou. Voce pode fechar esta janela.
pause
