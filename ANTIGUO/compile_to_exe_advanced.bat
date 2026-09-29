@echo off
setlocal EnableDelayedExpansion

echo ***************************************************
echo * Compilador de Aplicacion CIDENT a Ejecutable   *
echo ***************************************************
echo.

REM Verificar si Python esta instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python no esta instalado o no esta en el PATH
    pause
    exit /b 1
)

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
echo Verificando dependencias necesarias...
pip install pillow reportlab ttkthemes tkcalendar

echo.
echo Directorio actual: %CD%

REM Crear carpeta para el build si no existe
if not exist "build" mkdir build
if not exist "dist" mkdir dist

REM Variables de configuracion
set "APP_NAME=CIDENT"
set "MAIN_FILE=main.py"

echo.
echo Iniciando compilacion de !APP_NAME!...
echo ===================================================

REM Compilar la aplicacion con PyInstaller
pyinstaller ^
    --onefile ^
    --windowed ^
    --name "!APP_NAME!" ^
    --icon="" ^
    --add-data "CIDENT.png;." ^
    --add-data "data;data" ^
    --hidden-import=PIL ^
    --hidden-import=PIL.Image ^
    --hidden-import=PIL.ImageDraw ^
    --hidden-import=PIL.ImageFont ^
    --hidden-import=PIL.ImageTk ^
    --hidden-import=reportlab ^
    --hidden-import=reportlab.pdfgen ^
    --hidden-import=reportlab.lib ^
    --hidden-import=reportlab.lib.utils ^
    --hidden-import=reportlab.lib.pagesizes ^
    --hidden-import=reportlab.lib.units ^
    --hidden-import=ttkthemes ^
    --hidden-import=tkcalendar ^
    --distpath "./dist" ^
    --workpath "./build" ^
    --specpath "./" ^
    --clean ^
    !MAIN_FILE!

REM Verificar si la compilacion fue exitosa
if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo Compilacion completada exitosamente!
    echo.
    echo El ejecutable se encuentra en: dist\!APP_NAME!.exe
    echo.
    
    REM Mostrar detalles del archivo generado
    if exist "dist\!APP_NAME!.exe" (
        echo Detalles del ejecutable:
        dir "dist\!APP_NAME!.exe"
        echo.
    ) else (
        echo Advertencia: El archivo ejecutable no se encontro en la ubicacion esperada.
    )
    
    REM Preguntar si se desea crear un instalador o comprimir
    set /p create_zip="Desea crear un archivo ZIP con el ejecutable? (s/n): "
    if /i "!create_zip!"=="s" (
        if exist "dist\!APP_NAME!.exe" (
            if not exist "C:\Program Files\7-Zip\7z.exe" (
                echo 7-Zip no encontrado. Por favor instale 7-Zip o cree el ZIP manualmente.
            ) else (
                echo Creando archivo ZIP...
                "C:\Program Files\7-Zip\7z.exe" a -tzip "dist\!APP_NAME!_portable.zip" "dist\!APP_NAME!.exe"
                if %errorlevel% equ 0 (
                    echo Archivo ZIP creado: dist\!APP_NAME!_portable.zip
                ) else (
                    echo Error al crear el archivo ZIP.
                )
            )
        )
    )
) else (
    echo.
    echo ===================================================
    echo Error durante la compilacion.
    echo.
    echo Posibles soluciones:
    echo 1. Asegurese de tener todas las dependencias instaladas
    echo 2. Verifique que el archivo main.py exista
    echo 3. Ejecute este script como administrador
    echo 4. Verifique que no haya caracteres especiales en la ruta
    echo.
    pause
    exit /b 1
)

echo.
echo Compilacion finalizada.
echo ===================================================
pause