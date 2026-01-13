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

  logInfo: (msg, data) =>
    ipcRenderer.send('log-info', msg, data),

  logError: (msg, data) =>
    ipcRenderer.send('log-error', msg, data),

  logWarn: (msg, data) =>
    ipcRenderer.send('log-warn', msg, data),

  logDebug: (msg, data) =>
    ipcRenderer.send('log-debug', msg, data),

  showNotification: (title, body) => 
    ipcRenderer.send('show-notification', { title, body })
  
});

// contextBridge.exposeInMainWorld('logger', {
//   info: (msg, data) => log.info(msg, data ?? ''),
//   error: (msg, data) => log.error(msg, data ?? ''),
//   warn: (msg, data) => log.warn(msg, data ?? ''),
//   debug: (msg, data) => log.debug(msg, data ?? '')
// });