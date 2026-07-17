const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { AdapterRegistry } = require('./core/registry');
const { MessageRouter } = require('./core/router');
const { SessionManager } = require('./session-manager');
const { FileTracker } = require('./file-tracker');
const { registerHandlers } = require('./ipc-handlers');

// 日志
const logFile = path.join('/tmp', 'codehub-main.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch(e) {}
  console.log(msg);
}

// 窗口状态持久化
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(windowStateFile, 'utf8'));
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const isMaximized = mainWindow.isMaximized();
  try {
    fs.writeFileSync(windowStateFile, JSON.stringify({ bounds, isMaximized }), 'utf8');
  } catch {}
}

let mainWindow;
let registry;
let router;
let sessionManager;
let fileTracker;
let currentSessionId = null;

log('Main process started');

function createWindow() {
  const savedState = loadWindowState();
  const defaults = { width: 1400, height: 900 };
  const bounds = savedState?.bounds || defaults;

  mainWindow = new BrowserWindow({
    ...bounds,
    show: false,
    title: 'CodeHub',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (savedState?.isMaximized) mainWindow.maximize();
  mainWindow.show();

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
}

// === 启动 ===

app.whenReady().then(() => {
  registry = new AdapterRegistry();
  router = new MessageRouter(registry);
  sessionManager = new SessionManager();
  fileTracker = new FileTracker();
  createWindow();

  registerHandlers({
    registry, router, sessionManager, fileTracker,
    getMainWindow: () => mainWindow,
    getCurrentSessionId: () => currentSessionId,
    setCurrentSessionId: (id) => { currentSessionId = id; },
    log,
  });

  log('App ready');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
