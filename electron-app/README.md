# Convention Manager Desktop App

This is the desktop application wrapper for Convention Manager using Electron.

## Structure

- `main.js` - Electron main process
- `preload.js` - Secure IPC bridge
- `setup.js` - Build script for dependencies
- `package.json` - Electron app configuration

## Quick Start

1. **Setup (build all dependencies):**
   ```bash
   cd electron-app
   npm run setup
   ```

2. **Run in development:**
   ```bash
   npm start
   ```

3. **Build Windows installer:**
   ```bash
   npm run build:win
   ```

## Output

The Windows installer will be created at:
`dist/Convention Manager Setup 1.0.0.exe`

## Features

- Bundles backend API server
- Serves admin panel UI
- Includes all PWAs (NFC, Store, Player, Registration)
- Auto-starts server on launch
- Single executable for easy distribution
