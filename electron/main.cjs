const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./logger.cjs');
const syncServer = require('./syncServer.cjs');
const db = require('./database.cjs');
const cloudSync = require('./cloudSync.cjs');

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
      sandbox: true,
    },
  });

  // Load the built Vite production app
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  // Never let the POS window navigate away or open arbitrary windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

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

ipcMain.handle('get-sync-token', () => {
  return syncServer.syncToken;
});

// Sync tables broadcast from counter window
ipcMain.on('sync-tables', (event, tables) => {
  syncServer.updateState(tables);
});

// Get connected waiters list
ipcMain.handle('get-waiters', () => {
  return syncServer.getWaitersList();
});

// Prompt to fix Windows Defender Firewall for Port 5050 and set Wi-Fi to Private
ipcMain.handle('fix-firewall', async () => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    const psScript = `Set-NetConnectionProfile -InterfaceAlias ''Wi-Fi'' -NetworkCategory Private -ErrorAction SilentlyContinue; netsh advfirewall firewall add rule name=\\\"Hotel RJ Counter POS (Port 5050)\\\" dir=in action=allow protocol=TCP localport=5050 profile=any`;
    const psCmd = `powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -Command ${psScript}' -Verb RunAs"`;
    exec(psCmd, (err) => {
      if (err) {
        logger.error('Firewall', 'Failed to prompt for firewall rule', err);
        resolve({ success: false, error: err.message });
      } else {
        logger.warn('Firewall', 'Windows Firewall rule and Private network profile prompt initiated');
        resolve({ success: true, message: 'Firewall rule & Private Wi-Fi configured' });
      }
    });
  });
});

// -------------------------------------------------------------
// Database & Analytics IPC Handlers
// -------------------------------------------------------------
ipcMain.handle('get-analytics', async (event, query) => {
  return db.getAnalytics(query);
});

ipcMain.handle('export-backup', async () => {
  return db.exportBackup();
});

ipcMain.handle('settle-bill', async (event, bill) => {
  const record = db.saveSettledBill(bill);
  if (bill && bill.tableId) {
    const currentTable = syncServer.tablesState[bill.tableId];
    const vacantTable = {
      tableId: bill.tableId,
      serverName: bill.serverName || 'Staff',
      openedAt: '',
      status: 'vacant',
      kotNumber: currentTable ? (currentTable.kotNumber || 1) + 1 : 1,
      items: {},
      generalNote: '',
      updatedAt: Date.now(),
    };
    syncServer.updateState({ [bill.tableId]: vacantTable });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-tables-updated', {
        tables: syncServer.tablesState,
        incomingPatch: { [bill.tableId]: vacantTable },
      });
    }
  }
  return { success: true, bill: record };
});

ipcMain.handle('save-audit-log', async (event, log) => {
  const record = db.saveAuditLog(log);
  return { success: true, log: record };
});

ipcMain.handle('save-expense', async (event, expense) => {
  const record = db.saveExpense(expense);
  return { success: true, expense: record };
});

ipcMain.handle('delete-expense', async (event, id) => {
  db.deleteExpense(id);
  return { success: true };
});

ipcMain.handle('cancel-bill', async (event, { billId, reason, cancelledBy }) => {
  const result = db.cancelBill(billId, reason, cancelledBy);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    cloudSync.syncAll().catch((err) => console.warn('[CloudSync] Background sync error on bill cancel:', err));
  }
  return result;
});

ipcMain.handle('get-recent-bills', async (event, { limit } = {}) => {
  return db.getRecentBills(limit || 60);
});

ipcMain.handle('get-bills', async () => {
  return db.data.settledBills.slice(0, 50);
});

// -------------------------------------------------------------
// Hotel Operations IPC Handlers (Dishes, Rooms, Tables Config)
// -------------------------------------------------------------
ipcMain.handle('get-menu', async () => {
  return db.getMenu();
});

ipcMain.handle('toggle-dish-availability', async (event, { dishId, isAvailable }) => {
  const result = db.toggleDishAvailability(dishId, isAvailable);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('save-dish', async (event, dishData) => {
  const result = db.saveDish(dishData);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('delete-dish', async (event, dishId) => {
  const result = db.deleteDish(dishId);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('get-rooms', async () => {
  return db.getRooms();
});

ipcMain.handle('update-room-status', async (event, { roomId, status, guestDetails }) => {
  const result = db.updateRoomStatus(roomId, status, guestDetails);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('save-room', async (event, roomData) => {
  const result = db.saveRoom(roomData);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('delete-room', async (event, roomId) => {
  const result = db.deleteRoom(roomId);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('get-tables-config', async () => {
  return db.getTablesConfig();
});

ipcMain.handle('save-table-config', async (event, tableData) => {
  const result = db.saveTableConfig(tableData);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('delete-table-config', async (event, tableId) => {
  const result = db.deleteTableConfig(tableId);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

// Banquet & Event Bookings IPC Handlers
ipcMain.handle('get-banquet-bookings', async () => {
  return db.getBanquetBookings();
});

ipcMain.handle('save-banquet-booking', async (event, booking) => {
  const result = db.saveBanquetBooking(booking);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

ipcMain.handle('delete-banquet-booking', async (event, id) => {
  const result = db.deleteBanquetBooking(id);
  if (result.success && cloudSync && cloudSync.isConfigured()) {
    setTimeout(() => cloudSync.syncAll(), 100);
  }
  return result;
});

// -------------------------------------------------------------
// Supabase Cloud Sync IPC Handlers
// -------------------------------------------------------------
ipcMain.handle('get-cloud-config', async () => {
  return cloudSync.getPublicConfig();
});

ipcMain.handle('save-cloud-config', async (event, config) => {
  return cloudSync.saveConfig(config);
});

ipcMain.handle('test-cloud-connection', async (event, { url, key }) => {
  return cloudSync.testConnection(url, key);
});

ipcMain.handle('sync-cloud-now', async () => {
  return cloudSync.syncAll();
});

ipcMain.handle('set-cloud-session', async (event, session) => {
  return cloudSync.setSession(session);
});

ipcMain.handle('get-cloud-access-token', async () => {
  return cloudSync.getAccessToken();
});

ipcMain.handle('clear-cloud-session', async () => {
  return cloudSync.clearSession();
});
