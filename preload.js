const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveToken: (token, username) => ipcRenderer.invoke('save-token', token, username),
  getToken: () => ipcRenderer.invoke('get-token'),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),

  runGitCommand: (repoPath, args) => ipcRenderer.invoke('run-git-command', repoPath, args),
});
