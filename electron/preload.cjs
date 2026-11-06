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

  // Active connected waiters list
  getWaiters: () => ipcRenderer.invoke('get-waiters'),
  onWaitersUpdate: (callback) => {
    const handler = (event, waiters) => callback(waiters);
    ipcRenderer.on('sync-waiters-updated', handler);
    return () => ipcRenderer.removeListener('sync-waiters-updated', handler);
  },

  // Prompt to add inbound Windows Firewall rule for port 5050
  fixFirewall: () => ipcRenderer.invoke('fix-firewall'),

  // Local Database & Owner Analytics
  getAnalytics: (query) => ipcRenderer.invoke('get-analytics', query),
  settleBill: (bill) => ipcRenderer.invoke('settle-bill', bill),
  cancelBill: (data) => ipcRenderer.invoke('cancel-bill', data),
  getRecentBills: (options) => ipcRenderer.invoke('get-recent-bills', options),
  saveAuditLog: (log) => ipcRenderer.invoke('save-audit-log', log),
  saveExpense: (expense) => ipcRenderer.invoke('save-expense', expense),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),
  getBills: () => ipcRenderer.invoke('get-bills'),
  exportBackup: () => ipcRenderer.invoke('export-backup'),

  // Hotel Operations (Dishes, Rooms & Tables Configuration)
  getMenu: () => ipcRenderer.invoke('get-menu'),
  toggleDishAvailability: (dishId, isAvailable) => ipcRenderer.invoke('toggle-dish-availability', { dishId, isAvailable }),
  saveDish: (dishData) => ipcRenderer.invoke('save-dish', dishData),
  deleteDish: (dishId) => ipcRenderer.invoke('delete-dish', dishId),

  getRooms: () => ipcRenderer.invoke('get-rooms'),
  updateRoomStatus: (roomId, status, guestDetails) => ipcRenderer.invoke('update-room-status', { roomId, status, guestDetails }),
  saveRoom: (roomData) => ipcRenderer.invoke('save-room', roomData),
  deleteRoom: (roomId) => ipcRenderer.invoke('delete-room', roomId),

  getTablesConfig: () => ipcRenderer.invoke('get-tables-config'),
  saveTableConfig: (tableData) => ipcRenderer.invoke('save-table-config', tableData),
  deleteTableConfig: (tableId) => ipcRenderer.invoke('delete-table-config', tableId),

  // Supabase Cloud Sync
  getCloudConfig: () => ipcRenderer.invoke('get-cloud-config'),
  saveCloudConfig: (config) => ipcRenderer.invoke('save-cloud-config', config),
  testCloudConnection: (url, key) => ipcRenderer.invoke('test-cloud-connection', { url, key }),
  syncCloudNow: () => ipcRenderer.invoke('sync-cloud-now'),
});
