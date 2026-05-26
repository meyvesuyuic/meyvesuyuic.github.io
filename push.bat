@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  bira. — GitHub Push
echo  ========================
echo.

git status --short
echo.

set /p "MSG=Commit mesajı (boş bırakırsan otomatik): "

if "%MSG%"=="" (
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set TARIH=%%a/%%b/%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set SAAT=%%a:%%b
    set MSG=güncelleme — %TARIH% %SAAT%
)

git add -A
git commit -m "%MSG%"
git push origin main

echo.
if %ERRORLEVEL%==0 (
    echo  Push basarili!
) else (
    echo  Hata olustu. Lutfen git ayarlarini kontrol et.
)

echo.
pause
