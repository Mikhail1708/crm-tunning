@echo off
cd /d "C:\Users\User\crm-tunning"

echo ========================================
echo    LocalTunnel - CRM TUNING
echo ========================================
echo.

:: Запуск бэкенда
start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 2 >nul

:: Запуск фронтенда
start "Frontend" cmd /k "cd frontend && npm run dev -- --host"
timeout /t 2 >nul

echo.
echo 🌍 Запуск LocalTunnel...
echo.
echo 💡 Ссылка: https://crm-tunning.loca.lt
echo.

npx localtunnel --port 5173 --subdomain crm-tunning

pause