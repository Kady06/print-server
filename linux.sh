#!/bin/bash

set -e

echo "🔎 Kontrola Node.js a npm..."

install_node() {
  echo "❌ Node.js a/nebo npm nebyly nalezeny. Instalace..."

  if [ -f /etc/debian_version ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif [ -f /etc/arch-release ]; then
    sudo pacman -Sy --noconfirm nodejs npm
  else
    echo "⚠️ Nepodporovaná distribuce. Instaluj Node.js ručně."
    exit 1
  fi
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  install_node
else
  echo "✅ Node.js a npm jsou nainstalovány: $(node -v), $(npm -v)"
fi

echo "📦 Instalace závislostí v rootu projektu..."
npm install

# Absolutní cesta k projektu
PROJECT_DIR=$(pwd)

# Vytvoříme spouštěcí skript, na který bude ukazovat .desktop soubor
START_SCRIPT="$PROJECT_DIR/start-tray.sh"

cat > "$START_SCRIPT" <<EOF
#!/bin/bash
cd "$PROJECT_DIR"
npm start
EOF

chmod +x "$START_SCRIPT"

echo "🔧 Vytvořen startovací skript $START_SCRIPT"

# Vytvoření autostart složky
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

# Ikona (přizpůsob podle skutečné cesty nebo ji vymaž, pokud ji nemáš)
ICON_PATH="$PROJECT_DIR/tray/icon.png"

# Vytvoření .desktop souboru
DESKTOP_FILE="$AUTOSTART_DIR/print-server-tray.desktop"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Exec=$START_SCRIPT
Path=$PROJECT_DIR
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Kady Print server Tray
Comment=Tray appka pro print server
Icon=$ICON_PATH
EOF

echo "✅ Autostart nastaven v $DESKTOP_FILE"

echo "📦 Instalace závislostí print serveru v ./app..."
cd app
npm install --force
cd ..

echo "🚀 Spouštím Electron tray aplikaci..."
npm start
