const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const ElectronStore = require('electron-store');
const store = new ElectronStore.default();
const { exec } = require('child_process');

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

  win.setMenu(null);

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
    store.delete('settings');
  });  


  ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  
  ipcMain.handle('save-settings', async (event, settings) => {
    store.set('settings', settings);
  });
  
  ipcMain.handle('get-settings', async () => {
    return store.get('settings') || {};
  });

  ipcMain.handle('run-git-command', async (event, repoPath, args) => {
    return new Promise((resolve) => {
      exec(`git ${args}`, { cwd: repoPath }, (err, stdout) => {
        if (err) return resolve('');
        resolve(stdout.trim());
      });
    });
  });

  ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
  });


  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'my-app', 'dist', 'my-app', 'browser', 'index.html'));
  }

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
