@echo off
echo === Iniciando BankResume Web ===
cd web
set DATABASE_URL=file:./prisma/dev.db
npx next dev
