@echo off
cd /d "%~dp0"
pm2 delete brindi-bot
pm2 start startup.js --name "brindi-bot" --watch --max-memory-restart "1G" --exp-backoff-restart-delay 100 --max-restarts 10 --restart-delay 5000
pm2 save