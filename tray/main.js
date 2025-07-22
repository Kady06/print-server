const { app, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const net = require('net');

let tray = null;
let serverProcess = null;
const serverPort = 60420;

const serverPath = path.join(__dirname, '../app/server.js');

function isServerRunning(callback) {
  const client = net.createConnection({ port: serverPort }, () => {
    client.end();
    callback(true);
  });
  client.on('error', () => callback(false));
}

function startServer() {
  if (serverProcess) return;
  serverProcess = spawn('node', [serverPath], {
    cwd: path.dirname(serverPath),
    detached: true,
    stdio: 'ignore',
  });
  serverProcess.unref();
}

function stopServer() {
  exec(`pkill -f "${serverPath}"`);
  serverProcess = null;
}

function openTerminal() {
  const terminal = process.platform === 'linux'
    ? 'x-terminal-emulator'
    : process.platform === 'darwin'
    ? 'open -a Terminal'
    : 'start cmd';

  exec(terminal);
}

function buildMenu(isRunning) {
  return Menu.buildFromTemplate([
    {
      label: '🌐 Otevřít v prohlížeči',
      click: () => shell.openExternal(`http://localhost:${serverPort}`),
    },
    {
      label: isRunning ? '🛑 Zastavit server' : '▶️ Spustit server',
      click: () => {
        isRunning ? stopServer() : startServer();
        setTimeout(updateMenu, 1000);
      },
    },
    {
      label: '🔄 Restartovat server',
      click: () => {
        stopServer();
        setTimeout(startServer, 1000);
        setTimeout(updateMenu, 2000);
      },
    },
    {
      label: '🖥️ Otevřít terminál',
      click: openTerminal,
    },
    { type: 'separator' },
    {
      label: '❌ Konec',
      click: () => {
        stopServer();
        app.quit();
      },
    },
  ]);
}

function updateMenu() {
  isServerRunning((running) => {
    const menu = buildMenu(running);
    tray.setContextMenu(menu);
    tray.setToolTip(`Print server: ${running ? 'běží' : 'zastaven'}`);
  });
}

app.whenReady().then(() => {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  startServer();
  updateMenu();
  setInterval(updateMenu, 3000); // obnovovat stav každé 3s
});
