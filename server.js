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
const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');

const app = express();
const PORT = 3000;

const STORAGE_FILE = path.resolve(__dirname, 'selectedPrinter.json');
const AUTH_FILE = path.resolve(__dirname, 'auth.json');
const SECURITY_FILE = path.resolve(__dirname, 'security.json');

// Načtení autentizačních dat
let authData = {
  user: process.env.USER || 'admin',
  pass: process.env.PASSWD || 'admin',
};
try {
  const data = fs.readFileSync(AUTH_FILE, 'utf-8');
  authData = JSON.parse(data);
  console.log(`🔐 Načtená autentizace uživatel: ${authData.user}`);
} catch {
  console.log('⚠️ Autentizace se načítá z .env nebo výchozí hodnoty');
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), 'utf-8');
}

// Načtení security nastavení (zda je povinné auth na /print)
let printAuthEnabled = true;
try {
  const secData = fs.readFileSync(SECURITY_FILE, 'utf-8');
  const parsed = JSON.parse(secData);
  printAuthEnabled = parsed.printAuthEnabled ?? true;
  console.log(`🔒 Zabezpečení tisku: ${printAuthEnabled ? 'zapnuto' : 'vypnuto'}`);
} catch {
  console.log('⚠️ Žádné uložené nastavení zabezpečení, nastavuje se zapnuto');
  fs.writeFileSync(SECURITY_FILE, JSON.stringify({ printAuthEnabled: true }, null, 2));
}

// Middleware
app.use(cors());
app.use(session({
  secret: 'QJ6wN6AbePUGl1IPsELCbRL1xZOm3Asq',
  resave: false,
  saveUninitialized: true,
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Basic Auth middleware
const auth = (req, res, next) => {
  const user = basicAuth(req);
  if (!user || user.name !== authData.user || user.pass !== authData.pass) {
    res.set('WWW-Authenticate', 'Basic realm="Print Server"');
    return res.status(401).send('Přístup zamítnut');
  }
  next();
};

// Načtení uložené tiskárny
let selectedPrinter = null;
try {
  const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
  selectedPrinter = JSON.parse(data);
  console.log(`✅ Načtena tiskárna: ${selectedPrinter.name}`);
} catch {
  console.log('⚠️ Žádná uložená tiskárna');
}

// Uložení tiskárny
function saveSelectedPrinter(printer) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(printer), 'utf-8');
  console.log(`💾 Uložena tiskárna: ${printer.name}`);
}

// Uložení bezpečnostního nastavení
function saveSecuritySetting(enabled) {
  fs.writeFileSync(SECURITY_FILE, JSON.stringify({ printAuthEnabled: enabled }, null, 2), 'utf-8');
  printAuthEnabled = enabled;
  console.log(`🔒 Zabezpečení tisku změněno na: ${enabled ? 'zapnuto' : 'vypnuto'}`);
}

// Hlavní stránka
app.get('/', auth, (req, res) => {
  res.render('index', { selectedPrinter, authData, printAuthEnabled, message: null });
});

// Uložení názvu tiskárny
app.post('/set-printer', auth, (req, res) => {
  const { printerName } = req.body;
  if (!printerName) return res.status(400).send('Nebyl zadán název tiskárny');
  selectedPrinter = { name: printerName };
  saveSelectedPrinter(selectedPrinter);
  res.redirect('/');
});

// Uložení uživatele a hesla
app.post('/settings', auth, (req, res) => {
  const { user, pass } = req.body;
  if (!user || !pass) {
    return res.render('index', { selectedPrinter, authData, printAuthEnabled, message: 'Uživatel i heslo musí být vyplněny' });
  }
  authData = { user, pass };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), 'utf-8');
  res.render('index', { selectedPrinter, authData, printAuthEnabled, message: '✅ Nastavení uloženo, použijte nové přihlašovací údaje' });
});

// Uložení nastavení zabezpečení
app.post('/set-security', auth, (req, res) => {
  const enabled = req.body.printAuthEnabled === 'on';
  saveSecuritySetting(enabled);
  res.render('index', { selectedPrinter, authData, printAuthEnabled: enabled, message: `🔒 Zabezpečení tisku ${enabled ? 'zapnuto' : 'vypnuto'}` });
});

// Handler tisku
async function printHandler(req, res) {
  const { text, bufferBase64 } = req.body;

  if (!selectedPrinter || !selectedPrinter.name) return res.status(400).json({ error: 'Není nastavena tiskárna' });

  if (text === '[demo]') {
    const tmpFile = path.join(os.tmpdir(), `print_demo_${Date.now()}.bin`);
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'buffer',
      options: {}
    });

    try {
      printer.alignCenter();
      printer.println('Tisková ukázka');
      printer.newLine();

      printer.setTextQuadArea();
      printer.println('ROBUSTNÍ TEXT');
      printer.setTextNormal();
      printer.newLine();

      printer.alignLeft();
      printer.println('Zarovnání vlevo');
      printer.alignRight();
      printer.println('Zarovnání vpravo');
      printer.alignCenter();
      printer.println('Zarovnání na střed');
      printer.newLine();

      printer.drawLine();

      printer.println('🔹 Ukázka QR kódu:');
      printer.printQR('https://jankarlik.cz', { cellSize: 8, correction: 'H' });
      printer.newLine();

      printer.println('www.jankarlik.cz');
      printer.newLine();

      printer.println('Pokud toto čteš, tak to funguje :D');
      printer.newLine();

      printer.cut();

      const buffer = await printer.getBuffer();
      fs.writeFileSync(tmpFile, buffer);

      const cmd = `copy /B "${tmpFile}" "\\\\localhost\\${selectedPrinter.name}"`;
      exec(cmd, (err, stdout, stderr) => {
        fs.unlinkSync(tmpFile);
        if (err) {
          console.error('❌ Chyba při odesílání:', err);
          return res.status(500).json({ error: 'Tisk selhal při odesílání', details: stderr });
        }
        console.log(`📄 Vytisknuto na \\${selectedPrinter.name}: demo`);
        res.json({ success: true, message: '✅ Demo tisk proběhl' });
      });

    } catch (err) {
      console.error('❌ Chyba při generování demo bufferu:', err);
      res.status(500).json({ error: 'Demo tisk selhal při generování', details: err.message });
    }

  } else if (bufferBase64) {
    const tmpFile = path.join(os.tmpdir(), `print_raw_${Date.now()}.bin`);
    try {
      const buffer = Buffer.from(bufferBase64, 'base64');
      fs.writeFileSync(tmpFile, buffer);

      const cmd = `copy /B "${tmpFile}" "\\\\localhost\\${selectedPrinter.name}"`;
      exec(cmd, (err, stdout, stderr) => {
        fs.unlinkSync(tmpFile);
        if (err) {
          console.error('❌ Chyba při odesílání raw bufferu:', err);
          return res.status(500).json({ error: 'Tisk selhal při odesílání raw bufferu', details: stderr });
        }
        console.log(`📄 Vytisknuto na \\${selectedPrinter.name}: raw buffer`);
        res.json({ success: true, message: '✅ Tisk z raw bufferu proběhl' });
      });

    } catch (err) {
      console.error('❌ Chyba při zpracování raw bufferu:', err);
      res.status(500).json({ error: 'Tisk selhal při zpracování raw bufferu', details: err.message });
    }
  } else {
    res.status(400).json({ error: 'Chybí parametry pro tisk (text nebo bufferBase64)' });
  }
}

// Endpoint /print s podmínkou zabezpečení
if (printAuthEnabled) {
  app.post('/print', auth, printHandler);
} else {
  app.post('/print', printHandler);
}

app.listen(PORT, () => {
  console.log(`🖨️ Server běží na http://localhost:${PORT}`);
});
