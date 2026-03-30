$env:Path = $env:Path + ";C:\Program Files\nodejs"
Set-Location "C:\Users\joewc\gintracker"
& "C:\Program Files\nodejs\node_modules\corepack\shims\nodewin\pnpm.cmd" install --no-frozen-lockfile
