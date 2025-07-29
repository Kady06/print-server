const { app, Tray, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const kill = require('tree-kill');
const net = require('net');
const fs = require('fs');

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

  if (!fs.existsSync(serverPath)) {
    console.error('Server script nenalezen:', serverPath);
    return;
  }

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    detached: true,
    stdio: 'ignore',
  });
  serverProcess.unref();
}

function stopServer() {
  if (serverProcess && serverProcess.pid) {
    kill(serverProcess.pid, 'SIGTERM', (err) => {
      if (err) console.error('Chyba při ukončení procesu:', err);
    });
    serverProcess = null;
  } else {
    // Fallback: pokud server běží mimo náš proces
    if (process.platform === 'win32') {
      // Pozor: zabije všechny node procesy – použij jen v nouzi
      require('child_process').exec('taskkill /F /IM node.exe');
    } else {
      require('child_process').exec(`pkill -f "${serverPath}"`);
    }
  }
}

function openTerminal() {
  if (process.platform === 'win32') {
    require('child_process').exec('start cmd', { shell: 'cmd.exe' });
  } else if (process.platform === 'darwin') {
    require('child_process').exec('open -a Terminal');
  } else {
    require('child_process').exec(
      'x-terminal-emulator || gnome-terminal || konsole || xfce4-terminal || lxterminal || xterm'
    );
  }
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
        setTimeout(() => {
          startServer();
          setTimeout(updateMenu, 1000);
        }, 1000);
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
  setInterval(updateMenu, 3000);
});

app.on('before-quit', () => {
  stopServer();
});
