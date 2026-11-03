const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./logger.cjs');
const syncServer = require('./syncServer.cjs');

// Global Exception Handlers (Writes to Windows logs folder)
process.on('uncaughtException', (error) => {
  logger.error('System', 'Uncaught Exception in Electron Main Process', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('System', 'Unhandled Promise Rejection in Electron Main Process', reason);
});

let mainWindow = null;

function createWindow() {
  let iconPath = path.join(__dirname, '../dist/icons/hotel-rj-emblem.png');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../public/icons/hotel-rj-emblem.png');
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    title: 'Hotel RJ - Counter POS',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load the built Vite production app
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Start the Local Wi-Fi Sync Server for Waiter Android Phones
  try {
    syncServer.start(
      (updatedTables, incomingPatch) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-tables-updated', {
            tables: updatedTables,
            incomingPatch: incomingPatch || null,
          });
        }
      },
      (waitersList) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-waiters-updated', waitersList);
        }
      }
    );
  } catch (err) {
    logger.error('SyncServer', 'Could not initialize local sync server', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  syncServer.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

// Silent Background Thermal Printing (Windows Bluetooth or USB)
ipcMain.handle('print-thermal', async (event, { html, deviceName }) => {
  return new Promise((resolve) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page { size: 58mm auto; margin: 0; }
              body {
                width: 58mm;
                margin: 0;
                padding: 4px;
                font-family: 'Courier New', Courier, monospace;
                font-size: 11px;
                line-height: 1.35;
                color: #000;
                background: #fff;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

      printWin.webContents.on('did-finish-load', () => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: deviceName ? deviceName : undefined,
            margins: { marginType: 'none' },
          },
          (success, failureReason) => {
            if (!success) {
              logger.warn('Printer', `Silent print failed for device "${deviceName || 'Default'}": ${failureReason}`);
              resolve({ success: false, error: failureReason });
            } else {
              resolve({ success: true, method: deviceName ? `Windows Printer (${deviceName})` : 'Windows Default Printer' });
            }
            try {
              printWin.close();
            } catch {}
          }
        );
      });

      printWin.webContents.on('did-fail-load', (e, code, desc) => {
        logger.error('Printer', `Failed to render receipt HTML: ${desc}`);
        resolve({ success: false, error: desc });
        try {
          printWin.close();
        } catch {}
      });
    } catch (err) {
      logger.error('Printer', 'Thermal print execution error', err);
      resolve({ success: false, error: err.message });
    }
  });
});

// Get installed Windows printers (Bluetooth & USB)
ipcMain.handle('get-printers', async () => {
  try {
    if (!mainWindow) return [];
    const list = await mainWindow.webContents.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      isDefault: p.isDefault,
      status: p.status,
    }));
  } catch (err) {
    logger.warn('Printer', 'Could not query Windows printers', err.message);
    return [];
  }
});

// Open Logs Folder in Windows File Explorer
ipcMain.handle('open-logs-folder', async () => {
  try {
    const dir = logger.getLogsDirectory();
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (err) {
    logger.error('System', 'Failed to open logs folder', err);
    return { success: false, error: err.message };
  }
});

// Logging IPC from renderer (Strictly WARN and ERROR only)
ipcMain.on('log-warn', (event, { category, message }) => {
  logger.warn(category || 'App', message);
});

ipcMain.on('log-error', (event, { category, message, details }) => {
  logger.error(category || 'App', message, details);
});

// Sync server info
ipcMain.handle('get-sync-info', () => {
  return syncServer.getServerInfo();
});

// Sync tables broadcast from counter window
ipcMain.on('sync-tables', (event, tables) => {
  syncServer.updateState(tables);
});

// Get connected waiters list
ipcMain.handle('get-waiters', () => {
  return syncServer.getWaitersList();
});

// Prompt to fix Windows Defender Firewall for Port 5050
ipcMain.handle('fix-firewall', async () => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    const psCmd = `powershell -Command "Start-Process netsh -ArgumentList 'advfirewall firewall add rule name=\\"Hotel RJ Counter POS (Port 5050)\\" dir=in action=allow protocol=TCP localport=5050' -Verb RunAs"`;
    exec(psCmd, (err) => {
      if (err) {
        logger.error('Firewall', 'Failed to prompt for firewall rule', err);
        resolve({ success: false, error: err.message });
      } else {
        logger.warn('Firewall', 'Windows Firewall rule prompt initiated for port 5050');
        resolve({ success: true });
      }
    });
  });
});
