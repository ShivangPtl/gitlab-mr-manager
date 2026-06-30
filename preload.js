const { contextBridge, ipcRenderer } = require('electron');
// const log = require('electron-log/main'); 

contextBridge.exposeInMainWorld('electronAPI', {
  saveToken: (token, username, isAdmin) => ipcRenderer.invoke('save-token', token, username, isAdmin),
  getToken: () => ipcRenderer.invoke('get-token'),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),

  runGitCommand: (repoPath, args) => ipcRenderer.invoke('run-git-command', repoPath, args),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  logInfo: (msg, data) => ipcRenderer.send('log-info', msg, data),
  logError: (msg, data) => ipcRenderer.send('log-error', msg, data),
  logWarn: (msg, data) => ipcRenderer.send('log-warn', msg, data),
  logDebug: (msg, data) => ipcRenderer.send('log-debug', msg, data),
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  
  // ---- Promoter (QA → Live) ----
  promoterListServices: (credentials) => ipcRenderer.invoke('promoter-list-services', credentials),
  promoterBackup: (credentials, selectedItems) => ipcRenderer.invoke('promoter-backup', credentials, selectedItems),
  promoterGetConfig: () => ipcRenderer.invoke('promoter-get-config'),
  promoterSaveConfig: (cfg) => ipcRenderer.invoke('promoter-save-config', cfg),
  promoterSaveCredentials: (credentials) => ipcRenderer.invoke('promoter-save-credentials', credentials),
  promoterGetCredentials: () => ipcRenderer.invoke('promoter-get-credentials'),
  promoterClearCredentials: () => ipcRenderer.invoke('promoter-clear-credentials'),
  onPromoterProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('promoter-progress', listener);
    return () => ipcRenderer.removeListener('promoter-progress', listener);
  }
});

// contextBridge.exposeInMainWorld('logger', {
//   info: (msg, data) => log.info(msg, data ?? ''),
//   error: (msg, data) => log.error(msg, data ?? ''),
//   warn: (msg, data) => log.warn(msg, data ?? ''),
//   debug: (msg, data) => log.debug(msg, data ?? '')
// });