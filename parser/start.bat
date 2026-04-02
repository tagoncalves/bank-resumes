@echo off
call .venv\Scripts\activate.bat
uvicorn main:app --port 8001 --reload
