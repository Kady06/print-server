# 🖨️ Print Server  
### by [@kady06](https://github.com/kady06) – Jan Karlík  

Tento Print Server slouží pro **tisk účtenek na tiskárnách typu Epson**.  
Jednoduše běží na pozadí a umožňuje plnou správu přes ikonku v systémové liště.  
Podporuje ESC/POS tiskárny přes USB nebo systémové zařízení (např. `/dev/usb/lp0`).
Dále podporuje ESC/POS tiskárny přes IP adresu a sdílené přes windows.

---

## 🔧 Instalace

### 1️⃣ Naklonujte repozitář
```bash
git clone https://github.com/kady06/print-server.git
cd print-server
```

### 2️⃣ Instalace Print Serveru

#### 🐧 Linux
Spusťte instalační skript:
```bash
./linux.sh
```

#### 🪟 Windows  
Dvojklikem spusťte:
```
windows.bat
```

---

### 3️⃣ Spuštění Print Serveru

Po instalaci se server spustí automaticky. Pokud ne, můžete ho spustit ručně:

#### 🐧 Linux
```bash
./start-tray.sh
```

#### 🪟 Windows  
Spusťte:
```
start-tray.bat
```

---

## 🧑‍💻 Použití

Po spuštění se v **tray oblasti** (stavovém řádku systému) zobrazí ikona Print Serveru. Kliknutím na ikonu se zobrazí menu s následujícími možnostmi:

| Funkce | Popis |
|--------|-------|
| 🖥️ **Otevřít v prohlížeči** | Otevře webové rozhraní serveru (např. http://localhost:60420) |
| ▶️ / ⏹️ **Spustit / Zastavit server** | Spuštění nebo vypnutí běžícího Print Serveru |
| 🔄 **Restartovat server** | Restartuje server i webové rozhraní |
| 📟 **Otevřít terminál** | Otevře terminál s logy serveru (BETA funkce) |
| ❌ **Konec** | Ukončí pouze tray aplikaci (server zůstane aktivní) |

---

## 🌐 Webové rozhraní

Základní login a heslo pro přístup do webového rozhraní je:
```
login: admin
heslo: admin
```

Print Server obsahuje jednoduché a přehledné webové UI:

- ✅ Odesílání tiskových požadavků (text, formátování, QR kódy...)
- 📦 Přehled připojených tiskáren
- 📋 Náhled odesílaného tisku
- 🔧 Konfigurace serveru (porty, režimy...)

---

## 📂 Dokumentace

Podrobné informace o použití API, podpoře formátování textu a další technické detaily najdete v souboru:  

[app/README.md](https://github.com/Kady06/print-server/tree/main/app/README.md)

---

## Ukázka odesílání z jiného serveru

[example.html](https://github.com/Kady06/print-server/blob/main/example.html)

## 🖨️ Podporované tiskárny

- Epson TM-T20, TM-T88 a další tiskárny podporující ESC/POS
- Připojení přes:
  - USB (přes `usb://`)
  - Systémové zařízení (např. `/dev/usb/lp0`)
  - Síťové tiskárny (plánováno)

---

## 🛠️ Technologie

Tento projekt je postaven na:

- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [node-thermal-printer](https://github.com/Klemen1337/node-thermal-printer)
- [Electron](https://www.electronjs.org/) (tray aplikace)

---

## 💬 Autor

Vytvořil: **Jan Karlík**  
GitHub: [@kady06](https://github.com/kady06)

---

## 📢 Nápady, bugy, návrhy?

👉 Otevřete nové [issue](https://github.com/kady06/print-server/issues)  
👉 Nebo mě kontaktujte napřímo přes GitHub

---

## 🧪 Vývojová poznámka

Projekt je ve fázi aktivního vývoje. Přijímám pull requesty, připomínky a vylepšení.