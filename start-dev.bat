@echo off
echo ===================================================
echo    Lancement de liteAndSlash (Serveur + Client)
echo ===================================================
echo.

echo [1/2] Lancement du Serveur de Jeu (Port 3000)...
start "liteAndSlash - SERVEUR" cmd /k "npm run server"

echo [2/2] Lancement du Serveur Web Client (Vite)...
start "liteAndSlash - CLIENT" cmd /k "npm run dev"

echo.
echo Le serveur et le client ont ete lances dans des fenetres separees.
echo Vous pouvez fermer ou relancer chaque fenetre independamment pour retester.
echo.
pause
