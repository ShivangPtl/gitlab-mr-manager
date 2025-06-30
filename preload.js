const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveToken: (token, username) => ipcRenderer.invoke('save-token', token, username),
  getToken: () => ipcRenderer.invoke('get-token'),
  clearToken: () => ipcRenderer.invoke('clear-token')
});
