@rem Do these steps for the first build 
winget install Oven-sh.Bun
bun install
mkdir dist\data
xcopy /E /I public dist\public
bun build --compile --minify --windows-hide-console server/server.ts --outfile dist/moneeey.exe