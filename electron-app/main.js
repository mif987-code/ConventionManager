const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Convention Manager',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the admin panel
  const isDev = !app.isPackaged;
  const adminPath = isDev 
    ? 'http://localhost:3000'
    : 'http://localhost:3000';

  mainWindow.loadURL(adminPath);

  // Remove menu bar for cleaner look
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

function startBackend() {
  const isDev = !app.isPackaged;
  const serverPath = isDev
    ? path.join(__dirname, '../backend/dist/server.js')
    : path.join(process.resourcesPath, 'backend/dist/server.js');

  console.log('Starting backend from:', serverPath);

  // Set environment variables
  const env = {
    ...process.env,
    PORT: '3000',
    NODE_ENV: isDev ? 'development' : 'production'
  };

  // Start the server process
  serverProcess = spawn('node', [serverPath], {
    env,
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data}`);
    // Once server is ready, create window
    if (data.toString().includes('running on port')) {
      setTimeout(createWindow, 500);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`[Server] Process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  startBackend();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Handle IPC messages
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-data-path', () => {
  return app.getPath('userData');
});
