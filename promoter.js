const { NodeSSH } = require('node-ssh');
const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DEFAULTS = {
  apiServer: '172.16.0.149',
  uiServer: '172.16.0.158',
  port: 2233,
  qaApiPath: '/opt/hosting_ah_support',
  qaUiPath: '/data/hosting_ah_support',
  filePattern: '[Pp][Dd][Pp].*',
  networkBackupPath: '\\\\LT147\\OShared',
  networkFolderName: 'PdpPromote',
  fallbackToDesktop: true,
  uiFolders: ['org.ahsupportqa.orbitron.in', 'config.ahsupportqa.orbitron.in']
};

function mergeConfig(userConfig) {
  return { ...DEFAULTS, ...(userConfig || {}) };
}

function prepareExportFolder(cfg) {
  let backupRoot;
  let usedFallback = false;

  
  if (fs.existsSync(cfg.networkBackupPath)) {
    backupRoot = path.join(cfg.networkBackupPath, cfg.networkFolderName);
  } else {
    if (!cfg.fallbackToDesktop) {
      throw new Error(
        `Network backup location is unavailable: ${cfg.networkBackupPath}`
      );
    }

    usedFallback = true;
    backupRoot = path.join(
      os.homedir(),
      'Desktop',
      cfg.networkFolderName
    );
  }

  fs.mkdirSync(backupRoot, { recursive: true });

  const timestamp = getFormattedDate();

  const exportFolder = path.join(
    backupRoot,
    `backup-${timestamp}`
  );

  fs.mkdirSync(exportFolder, { recursive: true });

  return {
    folder: exportFolder,
    usedFallback
  };
}

function getFormattedDate() {
  const now = new Date();

  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `${dd}-${mm}-${yyyy}_${hh}-${min}-${ss}`;
}

async function listApiServices(cfg, credentials) {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: cfg.apiServer,
    port: cfg.port,
    username: credentials.username,
    password: credentials.password
  });

  try {
    const result = await ssh.execCommand(`ls -d ${cfg.qaApiPath}/*/ | xargs -n1 basename`);
    const services = (result.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
    return services;
  } finally {
    ssh.dispose();
  }
}

async function countFiles(sftp, remoteDir) {
  let count = 0;
  const items = await sftp.list(remoteDir);
  for (const item of items) {
    if (item.type === 'd') count += await countFiles(sftp, `${remoteDir}/${item.name}`);
    else count++;
  }
  return count;
}

async function downloadDirectoryRecursive(sftp, remoteDir, localDir, onProgress, doneRef = { count: 0 }) {
  fs.mkdirSync(localDir, { recursive: true });
  const items = await sftp.list(remoteDir);

  for (const item of items) {
    const remotePath = `${remoteDir}/${item.name}`;
    const localPath = path.join(localDir, item.name);

    if (item.type === 'd') {
      await downloadDirectoryRecursive(sftp, remotePath, localPath, onProgress, doneRef);
    } else {
      await sftp.fastGet(remotePath, localPath);
      doneRef.count++;
      onProgress(doneRef.count);
    }
  }
}





const pLimit = (concurrency) => {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
};

async function backupSelected(cfg, credentials, selectedItems, onProgress) {
  const ssh = new NodeSSH();
  const apiSftp = new SftpClient();
  const uiSftp = new SftpClient();

  const rowUpdate = (id, type, current, total, status) =>
    onProgress?.({ type: 'row', id, itemType: type, current, total, status });

  onProgress?.({ type: 'status', stage: 'checking-network', message: 'Connecting to backup location…' });

  const { folder: exportDir, usedFallback } = prepareExportFolder(cfg);

  onProgress?.({ type: 'status', stage: 'network-checked', usedFallback });
  onProgress?.({ type: 'info', exportDir, usedFallback });

  const needsApi = selectedItems.some(i => i.type === 'API');
  const needsUi = selectedItems.some(i => i.type === 'UI');

  try {
    if (needsApi) {
      onProgress?.({ type: 'status', stage: 'connecting-api', message: 'Connecting to API server…' });
      await ssh.connect({ host: cfg.apiServer, port: cfg.port, username: credentials.username, password: credentials.password });
      await apiSftp.connect({ host: cfg.apiServer, port: cfg.port, username: credentials.username, password: credentials.password });
      onProgress?.({ type: 'status', stage: 'connected-api' });
    }
    if (needsUi) {
      onProgress?.({ type: 'status', stage: 'connecting-ui', message: 'Connecting to UI server…' });
      await uiSftp.connect({ host: cfg.uiServer, port: cfg.port, username: credentials.username, password: credentials.password });
      onProgress?.({ type: 'status', stage: 'connected-ui' });
    }
  } catch (err) {
    onProgress?.({ type: 'status', stage: 'connect-failed', message: err.message });
    throw err; // bubble up so backupSelected's caller still gets success:false
  }

  // concurrency: 4 services at once is safe for most SFTP servers
  const limit = pLimit(4);

  try {
    const tasks = selectedItems.map(item => limit(async () => {
      const id = item.name;                  // full name = stable unique id
      const finalPath = item.finalPath;
      rowUpdate(id, item.type, 0, 0, 'START');

      try {
        const total = item.type === 'API'
          ? await backupApi(ssh, apiSftp, cfg, item.name, finalPath, exportDir, (cur, tot) => rowUpdate(id, 'API', cur, tot, 'RUN'))
          : await backupUi(uiSftp, cfg, item.name, finalPath, exportDir, (cur, tot) => rowUpdate(id, 'UI', cur, tot, 'RUN'));

        rowUpdate(id, item.type, total, total, 'DONE');
        return { id, name: item.name, type: item.type, status: 'success', files: total };
      } catch (err) {
        rowUpdate(id, item.type, 0, 0, 'FAILED');
        return { id, name: item.name, type: item.type, status: 'failed', message: err.message };
      }
    }));

    const results = await Promise.all(tasks);
    return { exportDir, usedFallback, results };
  } finally {
    if (needsApi) { ssh.dispose(); await apiSftp.end().catch(() => {}); }
    if (needsUi) { await uiSftp.end().catch(() => {}); }
  }
}

async function backupApi(ssh, sftp, cfg, fullName, finalPath, exportDir, onProgress) {
  const qaDir = `${cfg.qaApiPath}/${fullName}`;
  const local = path.join(exportDir, 'API', finalPath);   // local folders use short name — fine, it's just disk layout
  fs.mkdirSync(local, { recursive: true });

  const listResult = await ssh.execCommand(`ls ${qaDir}/${cfg.filePattern} 2>/dev/null`);
  const files = (listResult.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);

  if (!files.length) throw new Error('No matching files found');

  let done = 0;
  // also parallelize individual file downloads, capped
  const fileLimit = pLimit(5);
  await Promise.all(files.map(f => fileLimit(async () => {
    const localPath = path.join(local, path.basename(f));
    await sftp.fastGet(f, localPath);
    done++;
    onProgress(done, files.length);
  })));

  return files.length;
}

async function backupUi(sftp, cfg, fullName, finalPath, exportDir, onProgress) {
  const remoteRoot = `${cfg.qaUiPath}/${fullName}`;
  const local = path.join(exportDir, 'UI', finalPath);
  fs.mkdirSync(local, { recursive: true });

  const total = await countFiles(sftp, remoteRoot);
  let done = 0;

  await downloadDirectoryRecursive(sftp, remoteRoot, local, (d) => {
    done = d;
    onProgress(done, total);
  });

  return total;
}



module.exports = {
  mergeConfig,
  listApiServices,
  backupSelected
};