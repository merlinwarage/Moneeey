@rem Do these steps for the first build
winget install Oven-sh.Bun
bun install
bun --watch server/server.ts