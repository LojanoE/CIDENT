@echo off
echo Compilando CIDENT...
echo.

REM Instalar PyInstaller si no esta presente
pip install pyinstaller pillow reportlab ttkthemes tkcalendar

REM Compilar la aplicacion
pyinstaller --onefile --windowed --name "CIDENT" --add-data "CIDENT.png;." --add-data "data;data" main.py

echo.
echo Compilacion completada. El ejecutable esta en la carpeta dist/
pause