const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ElectronAPI', {
  isElectron: true,

  // Windows Thermal Printing (Silent background print)
  printThermal: (html, deviceName) => ipcRenderer.invoke('print-thermal', { html, deviceName }),

  // Get all Windows installed / paired printers
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // Open Windows logs directory in File Explorer
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),

  // Logging (Warning and Error only, no order details)
  logWarning: (category, message) => ipcRenderer.send('log-warn', { category, message }),
  logError: (category, message, details) => ipcRenderer.send('log-error', { category, message, details }),

  // Local Wi-Fi Sync Server Info
  getSyncInfo: () => ipcRenderer.invoke('get-sync-info'),

  // Broadcast tables update to sync server
  syncTables: (tables) => ipcRenderer.send('sync-tables', tables),

  // Listen for table updates from other devices (waiter phones)
  onSyncUpdate: (callback) => {
    const handler = (event, tables) => callback(tables);
    ipcRenderer.on('sync-tables-updated', handler);
    return () => ipcRenderer.removeListener('sync-tables-updated', handler);
  },
});
