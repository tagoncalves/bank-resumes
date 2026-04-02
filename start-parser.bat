@echo off
echo === Iniciando Parser Service ===
cd parser
call .venv\Scripts\activate.bat
uvicorn main:app --port 8001 --reload
