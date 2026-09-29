@echo off
echo Compilando la aplicacion CIDENT a ejecutable...
echo.

REM Verificar si PyInstaller esta instalado
pip show pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo PyInstaller no esta instalado. Instalandolo ahora...
    pip install pyinstaller
    if %errorlevel% neq 0 (
        echo Error al instalar PyInstaller
        pause
        exit /b 1
    )
)

REM Instalar dependencias necesarias si no estan presentes
echo Instalando dependencias necesarias...
pip install pillow reportlab ttkthemes tkcalendar

REM Compilar la aplicacion
echo.
echo Compilando main.py...
pyinstaller --onefile --windowed --name "CIDENT" ^
    --add-data "CIDENT.png;." ^
    --add-data "data;data" ^
    --hidden-import=PIL ^
    --hidden-import=reportlab ^
    --hidden-import=reportlab.lib ^
    --hidden-import=reportlab.lib.utils ^
    --hidden-import=ttkthemes ^
    --hidden-import=tkcalendar ^
    --distpath "./dist" ^
    --workpath "./build" ^
    --specpath "./" ^
    main.py

if %errorlevel% equ 0 (
    echo.
    echo Compilacion completada exitosamente!
    echo El ejecutable esta en la carpeta dist/
    echo.
    dir dist\CIDENT.exe
) else (
    echo.
    echo Error durante la compilacion.
)

echo.
echo Presione cualquier tecla para salir...
pause >nul