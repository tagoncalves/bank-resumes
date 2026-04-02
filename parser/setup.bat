@echo off
echo === Setup Parser Service ===
echo.
echo Creando entorno virtual...
python -m venv .venv

echo Activando entorno virtual...
call .venv\Scripts\activate.bat

echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo Setup completo! Para iniciar el servicio:
echo   .venv\Scripts\activate.bat
echo   uvicorn main:app --port 8001 --reload
pause
