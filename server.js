require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const basicAuth = require('basic-auth');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { printer: ThermalPrinter, types: PrinterTypes, CharacterSet } = require('node-thermal-printer');
const usb = require('usb');

const app = express();
const PORT = 3000;

const STORAGE_FILE = path.resolve(__dirname, 'selectedPrinter.json');
const AUTH_FILE = path.resolve(__dirname, 'auth.json');
const SECURITY_FILE = path.resolve(__dirname, 'security.json');

let authData = {
  user: process.env.USER || 'admin',
  pass: process.env.PASSWD || 'admin',
};
try {
  const data = fs.readFileSync(AUTH_FILE, 'utf-8');
  authData = JSON.parse(data);
  console.log(`🔐 Loaded auth user: ${authData.user}`);
} catch {
  console.log('⚠️ Using default or .env auth');
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), 'utf-8');
}

let printAuthEnabled = true;
try {
  const secData = fs.readFileSync(SECURITY_FILE, 'utf-8');
  const parsed = JSON.parse(secData);
  printAuthEnabled = parsed.printAuthEnabled ?? true;
  console.log(`🔒 Print security: ${printAuthEnabled ? 'enabled' : 'disabled'}`);
} catch {
  console.log('⚠️ No security settings found, enabling by default');
  fs.writeFileSync(SECURITY_FILE, JSON.stringify({ printAuthEnabled: true }, null, 2));
}

app.use(cors());
app.use(session({
  secret: 'QJ6wN6AbePUGl1IPsELCbRL1xZOm3Asq',
  resave: false,
  saveUninitialized: true,
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

const auth = (req, res, next) => {
  const user = basicAuth(req);
  if (!user || user.name !== authData.user || user.pass !== authData.pass) {
    console.warn(`Unauthorized access attempt from ${req.ip} at ${new Date().toISOString()}`);
    res.set('WWW-Authenticate', 'Basic realm="Print Server"');
    return res.status(401).send('Access denied');
  }
  next();
};


let selectedPrinter = null;
try {
  const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
  selectedPrinter = JSON.parse(data);
  console.log(`✅ Loaded printer: ${selectedPrinter.type} - ${selectedPrinter.name || selectedPrinter.device}`);
} catch {
  console.log('⚠️ No saved printer');
}

function saveSelectedPrinter(printer) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(printer, null, 2), 'utf-8');
  selectedPrinter = printer;
  console.log(`💾 Saved printer: ${printer.type} - ${printer.name || printer.device}`);
}

function saveSecuritySetting(enabled) {
  fs.writeFileSync(SECURITY_FILE, JSON.stringify({ printAuthEnabled: enabled }, null, 2), 'utf-8');
  printAuthEnabled = enabled;
  console.log(`🔒 Print security set to: ${enabled ? 'enabled' : 'disabled'}`);
}

function listSystemPrinters() {
  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      exec('wmic printer get name,portname /format:csv', (err, stdout) => {
        if (err) return resolve([]);
        const lines = stdout.split('\n').slice(1);
        const printers = lines.map(line => line.trim()).filter(Boolean).map(line => {
          const parts = line.split(',');
          return {
            device: parts[2],
            label: parts[1],
          };
        });
        resolve(printers);
      });
    } else {
      exec('lpstat -p -d', (err, stdout) => {
        if (err) return resolve([]);
        const printers = stdout.split('\n').filter(line => line.startsWith('printer')).map(line => {
          const parts = line.split(' ');
          return {
            device: parts[1],
            label: line,
          };
        });
        resolve(printers);
      });
    }
  });
}

function listUSBPrinters() {
  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      resolve(
        Array.from({ length: 3 }, (_, i) => ({
          device: `LPT${i + 1}`,
          label: `Paralelní port LPT${i + 1}`,
        }))
      );
    } else {
      const usbPath = '/dev/usb';
      if (!fs.existsSync(usbPath)) return resolve([]);
      const devices = fs
        .readdirSync(usbPath)
        .filter((name) => name.startsWith('lp'))
        .map((name) => ({
          device: path.join(usbPath, name),
          label: `USB Device (${name})`,
        }));
      resolve(devices);
    }
  });
}




// Render main page
app.get('/', auth, async (req, res) => {
  const systemPrinters = await listSystemPrinters();
  const usbPrinters = await listUSBPrinters();
  res.render('index', {
    selectedPrinter,
    authData,
    printAuthEnabled,
    message: null,
    systemPrinters,
    usbPrinters,
  });
});

// Save printer selection (accepting type and name/device)
app.post('/set-printer', auth, (req, res) => {
  const { printerType, sharedPrinterName, usbDevice, systemPrinterName, ipAddress } = req.body;

  let printer = null;
  switch (printerType) {
    case 'shared':
      if (!sharedPrinterName) return res.status(400).send('Shared printer name required');
      printer = { type: 'shared', name: sharedPrinterName };
      break;
    case 'usb':
      if (!usbDevice) return res.status(400).send('USB device required');
      printer = { type: 'usb', device: usbDevice };
      break;
    case 'system':
      if (!systemPrinterName) return res.status(400).send('System printer name required');
      printer = { type: 'system', name: systemPrinterName };
      break;
    case 'ip':
      if (!ipAddress || !ipAddress.startsWith('tcp://')) return res.status(400).send('Invalid IP address');
      printer = { type: 'ip', interface: ipAddress };
      break;
    default:
      return res.status(400).send('Invalid printer type');
  }


  saveSelectedPrinter(printer);
  res.redirect('/');
});


// Save auth settings
app.post('/settings', auth, (req, res) => {
  const { user, pass } = req.body;
  if (!user || !pass) {
    return res.render('index', {
      selectedPrinter,
      authData,
      printAuthEnabled,
      message: 'User and password must be filled',
      systemPrinters: [],
      usbPrinters: [],
    });
  }
  authData = { user, pass };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), 'utf-8');
  res.render('index', {
    selectedPrinter,
    authData,
    printAuthEnabled,
    message: '✅ Settings saved. Use new credentials.',
    systemPrinters: [],
    usbPrinters: [],
  });
});

// Save security settings
app.post('/set-security', auth, (req, res) => {
  const enabled = req.body.printAuthEnabled === 'on';
  saveSecuritySetting(enabled);
  res.render('index', {
    selectedPrinter,
    authData,
    printAuthEnabled: enabled,
    message: `🔒 Print security ${enabled ? 'enabled' : 'disabled'}`,
    systemPrinters: [],
    usbPrinters: [],
  });
});

// Generic function to send data to printer
async function sendToPrinter(bufferPath, res) {
  if (!selectedPrinter) return res.status(400).json({ error: 'No printer selected' });

  try {
    if (selectedPrinter.type === 'ip') {
      // Přečti buffer
      const buffer = fs.readFileSync(bufferPath);

      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON, // nebo STARPřizpůsob si podle potřeby
        interface: selectedPrinter.interface, // např. "192.168.0.123"
        //characterSet: CharacterSet.PC852_LATIN2,
        encoding: 'UTF-8',
      });

      console.log(`📤 Sending data to IP printer: ${selectedPrinter.interface}`);
      

      // Nastav buffer do tiskárny a pošli ho
      await printer.setBuffer(buffer);
      await printer.execute();

      fs.unlinkSync(bufferPath);
      return res.json({ success: true });
    } else {
      // Pro ostatní typy tiskáren stále původní exec
      const isWin = os.platform() === 'win32';
      let cmd;

      switch (selectedPrinter.type) {
        case 'shared':
        case 'system':
          cmd = isWin
            ? `copy /B "${bufferPath}" "\\\\localhost\\${selectedPrinter.name}"`
            : `lp -d "${selectedPrinter.name}" "${bufferPath}"`;
          break;

        case 'usb':
          if (isWin) {
            cmd = `copy /B "${bufferPath}" "${selectedPrinter.device}"`;
          } else {
            cmd = `cat "${bufferPath}" > "${selectedPrinter.device}"`;
          }
          break;

        default:
          return res.status(400).json({ error: 'Unknown printer type' });
      }

      exec(cmd, (err, stdout, stderr) => {
        fs.unlinkSync(bufferPath);
        if (err) {
          console.error('Print error:', err, stderr);
          return res.status(500).json({ error: 'Print failed', detail: stderr || err.message });
        }
        res.json({ success: true });
      });
    }
  } catch (err) {
    console.error('Print error:', err);
    if (fs.existsSync(bufferPath)) fs.unlinkSync(bufferPath);
    res.status(500).json({ error: 'Print failed', detail: err.message });
  }
}


// POST /print-buffer - print base64 buffer from other node-thermal-printer apps
app.post('/print-buffer', printAuthEnabled ? auth : (req, res, next) => next(), async (req, res) => {
  const { bufferBase64 } = req.body;
  if (!bufferBase64) return res.status(400).json({ error: 'Missing bufferBase64' });
  if (!selectedPrinter) return res.status(400).json({ error: 'No printer selected' });

  try {
    const tmpFile = path.join(os.tmpdir(), `printbuffer_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, Buffer.from(bufferBase64, 'base64'));
    sendToPrinter(tmpFile, res);
  } catch (err) {
    res.status(500).json({ error: 'Buffer processing error', detail: err.message });
  }
});

// POST /print-raw - print raw text (like Java StringBuilder)
app.post('/print-raw', printAuthEnabled ? auth : (req, res, next) => next(), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  if (!selectedPrinter) return res.status(400).json({ error: 'No printer selected' });

  try {
    const tmpFile = path.join(os.tmpdir(), `printraw_${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, text, 'utf8');
    sendToPrinter(tmpFile, res);
  } catch (err) {
    res.status(500).json({ error: 'Raw text processing error', detail: err.message });
  }
});

app.post('/print', printAuthEnabled ? auth : (req, res, next) => next(), async (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected array of print commands' });
  if (!selectedPrinter) return res.status(400).json({ error: 'No printer selected' });

  try {
    console.log('Inicializuji tiskárnu s encodingem UTF-8...');
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,  // nebo PrinterTypes.STAR
      interface: selectedPrinter.interface || `\\\\localhost\\${selectedPrinter.name}`,
      encoding: 'UTF-8',
      characterSet: CharacterSet.PC852_LATIN2,
    });


    // Init printer - kontrola
    const isConnected = await printer.isPrinterConnected();
    console.log('Printer connected:', isConnected);

    for (const item of data) {
      switch (item.type) {
        case 'text': {
          const text = typeof item.content === 'string' ? item.content : String(item.content ?? '');
          printer.println(text);
          break;
        }
        case 'line':
          printer.drawLine();
          break;
        case 'qr':
          if (typeof item.content === 'string' && item.content.trim() !== '') {
            printer.printQR(item.content, { cellSize: 6, correction: 'H' });
          } else {
            printer.println('[Chybí QR obsah]');
          }
          break;
        case 'size': {
          if (typeof item.content === 'string') {
            const parts = item.content.split('.').map(n => parseInt(n, 10));
            if (parts.length === 2 && parts.every(n => !isNaN(n))) {
              const [w, h] = parts.map(n => Math.min(Math.max(n, 0), 7));
              printer.setTextSize(w, h);
              console.log(`Nastavuji velikost textu: ${w}x${h}`);
            } else {
              printer.println('[Chybný formát size]');
            }
          } else {
            printer.println('[Nevalidní size]');
          }
          break;
        }


        case 'align': {
          if (typeof item.content === 'string') {
            const alignVal = item.content.toLowerCase();
            if (alignVal === 'left') printer.alignLeft();
            else if (alignVal === 'center') printer.alignCenter();
            else if (alignVal === 'right') printer.alignRight();
            else printer.println(`[Neznámé zarovnání: ${item.content}]`);
          } else {
            printer.println('[Nevalidní align]');
          }
          break;
        }
        case 'bold':
          printer.bold(!!item.content);
          break;
        case 'underline':
          printer.underline(!!item.content);
          break;

        case 'cut':
          printer.cut();
          break;
        case 'newline':
          printer.newLine();
          break;
        default:
          printer.println(`[NEZNÁMÝ TYP]: ${item.content || ''}`);
          break;
      }
    }

    // Získej buffer a ulož jako binární data (důležité Buffer.from)
    const buffer = await printer.getBuffer();
    const tmpFile = path.join(os.tmpdir(), `printjson_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, Buffer.from(buffer));

    sendToPrinter(tmpFile, res);
  } catch (err) {
    console.error('Print generation error:', err);
    res.status(500).json({ error: 'Print generation error', detail: err.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🖨️ Print server running at http://localhost:${PORT}`);
});
