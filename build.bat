@rem winget install Oven-sh.Bun
@rem bun install
mkdir dist\data
copy finance.db dist\data\finance.db
xcopy /E /I public dist\public
bun build --compile --minify --windows-hide-console src/server.ts --outfile dist/moneeey.exe