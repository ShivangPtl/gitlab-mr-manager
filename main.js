const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const ElectronStore = require('electron-store');
const store = new ElectronStore.default();
const { exec } = require('child_process');
const log = require('electron-log');

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));


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

  ipcMain.handle('save-token', async (event, token, username, isAdmin) => {
    store.set('gitlabToken', token);
    store.set('gitlabUser', username);
    store.set('gitlabAdmin', isAdmin);
    return true;
  });
  
  ipcMain.handle('get-token', () => {
    return {
      token: store.get('gitlabToken'),
      username: store.get('gitlabUser'),
      isAdmin: store.get('gitlabAdmin'),
    };
  });
  
  ipcMain.handle('clear-token', () => {
    store.delete('gitlabToken');
    store.delete('gitlabUser');
    store.delete('gitlabAdmin');
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



  ipcMain.on('log-info', (_, msg, data) => {
    log.info(msg, data ?? '');
  });

  ipcMain.on('log-error', (_, msg, data) => {
    log.error(msg, data ?? '');
  });

  ipcMain.on('log-warn', (_, msg, data) => {
    log.warn(msg, data ?? '');
  });

  ipcMain.on('log-debug', (_, msg, data) => {
    log.debug(msg, data ?? '');
  });

  ipcMain.on('show-notification', (event, data) => {
    showNotification(data.title, data.body);
  });  

  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'my-app', 'dist', 'my-app', 'browser', 'index.html'));
  }

}

app.setAppUserModelId('GitLab MR Manager');

app.whenReady().then(() => {
  var isAdmin = store.get('gitlabAdmin');
  if(isAdmin) {
    startPipelineWatcher();   // 🔥 background watcher
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

const lastStates = new Map();

async function startPipelineWatcher() {
  await checkPipelines(); // Run immediately
  setInterval(checkPipelines, 5 * 60 * 1000); // Every 5 minutes
}

async function checkPipelines() {
  try {
    //log.info('🔁 Checking pipelines...');

    const settings = store.get('settings') || {};
    const projects = getWatchedProjects(settings);
    const branches = getWatchedBranches(settings);

    if (!projects.length || !branches.length) {
      //log.info('⏭ No projects or branches configured');
      return;
    }

    // Fetch current status for all projects
    for (const project of projects) {
      await checkProjectPipelines(project.project_name, branches, settings);
    }

  } catch (err) {
    log.error('Pipeline check error:', err);
  }
}

async function checkProjectPipelines(projectName, branches, settings) {
  const token = store.get('gitlabToken');
  if (!token) {
    log.warn('❌ No GitLab token');
    return;
  }

  //log.info(`🔍 Checking: ${projectName}`);

  // Build GraphQL query for all branches
  const branchQueries = branches.map((branch, i) => `
    b${i}: pipelines(first: 5, ref: "${branch}") {
      nodes { status source }
    }
  `).join('\n');

  const query = `{
    group(fullPath: "pdp") {
      projects(first: 1, search: "${projectName}") {
        nodes { ${branchQueries} }
      }
    }
  }`;

  try {
    const res = await fetch('https://git.promptdairytech.com/api/graphql', {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    const projectNode = data?.data?.group?.projects?.nodes?.[0];
    if (!projectNode) return;

    // Check each branch for this project
    branches.forEach((branch, i) => {
      const pipelines = projectNode[`b${i}`]?.nodes || [];
      const scheduled = pipelines.filter(p => p.source?.toLowerCase() === 'schedule');

      if (!scheduled.length) {
        checkStateAndNotify(branch, projectName, 'idle', settings);
        return;
      }

      const status = scheduled[0].status?.toLowerCase();
      let currentState = 'idle';

      if (status === 'running') {
        currentState = 'running';
      } else if (['success', 'failed', 'canceled'].includes(status)) {
        currentState = 'completed';
      }

      //log.info(`  ${branch} - ${projectName}: ${status} (${currentState})`);
      checkStateAndNotify(branch, projectName, currentState, settings);
    });

  } catch (err) {
    log.error(`Failed to fetch ${projectName}:`, err);
  }
}

function checkStateAndNotify(branch, project, newState, settings) {
  const key = `${branch}:${project}`;
  const previousState = lastStates.get(key) || 'idle';

  // Only notify when state CHANGES
  if (previousState === newState) {
    return; // No change, skip notification
  }

  // Update state
  lastStates.set(key, newState);

  // Notify on state change
  if (newState === 'running' && previousState !== 'running') {
    //log.info(`🔔 NOTIFY: ${project} on ${branch} → STARTED`);
    sendNotification(branch, project, 'STARTED', settings);
  } 
  else if (newState === 'completed' && previousState === 'running') {
    //log.info(`🔔 NOTIFY: ${project} on ${branch} → COMPLETED`);
    sendNotification(branch, project, 'COMPLETED', settings);
  }
  else if (newState === 'idle' && previousState === 'running') {
    //log.info(`🔔 NOTIFY: ${project} on ${branch} → STOPPED`);
    sendNotification(branch, project, 'STOPPED', settings);
  }
}

function sendNotification(branch, project, status, settings) {
  if (!Notification.isSupported()) {
    log.warn('Notifications not supported');
    return;
  }

  // Determine branch type
  let branchType = 'RELEASE';
  if (branch === settings.supportBranch) branchType = 'SUPPORT';
  else if (branch === settings.liveBranch) branchType = 'UAT';

  let icon = '🔵';
  let action = 'Pipeline';
  
  if (status === 'STARTED') {
    icon = '🟡';
    action = 'Pipeline Started';
  } else if (status === 'COMPLETED') {
    icon = '✅';
    action = 'Deployment Done';
  } else if (status === 'STOPPED') {
    icon = '⚫';
    action = 'Pipeline Stopped';
  }

  const title = `${icon} ${branchType} - ${branch}`;
  const body = `${action}\n\n📦 Project: ${project}`;

  const notification = new Notification({ 
    title, 
    body,
    timeoutType: 'default'
  });
  
  notification.show();
}

// ==================== HELPERS ====================
function getWatchedProjects(settings) {
  return (settings.projects || []).filter(p => p.is_selected === true);
}

function getWatchedBranches(settings) {
  const branches = [
    settings.supportBranch,
    settings.releaseBranch,
    settings.liveBranch
  ].filter(b => !!b);
  
  return [...new Set(branches)]; // Remove duplicates
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}