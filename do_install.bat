@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "C:\Users\joewc\gintracker"
"C:\Program Files\nodejs\node_modules\corepack\shims\nodewin\pnpm.cmd" install --no-frozen-lockfile > install_output.txt 2>&1
echo %errorlevel% > install_exit.txt
