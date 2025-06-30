const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ElectronStore = require('electron-store');
const store = new ElectronStore.default();

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "GitLab MR Manager",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false
    }
  });

  ipcMain.handle('save-token', async (event, token, username) => {
    store.set('gitlabToken', token);
    store.set('gitlabUser', username);
    return true;
  });
  
  ipcMain.handle('get-token', () => {
    return {
      token: store.get('gitlabToken'),
      username: store.get('gitlabUser'),
    };
  });
  
  ipcMain.handle('clear-token', () => {
    store.delete('gitlabToken');
    store.delete('gitlabUser');
  });  

  // Load Angular app (from dist)
  win.loadFile(path.join(__dirname, 'my-app', 'dist', 'my-app','browser', 'index.html'));
  win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
