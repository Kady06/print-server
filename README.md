# Print Server API

Tento tiskový server umožňuje ovládat termální tiskárnu přes HTTP API. Podporuje různé typy tiskáren (USB, systémové, sdílené, IP) a základní tiskové příkazy v ESC/POS formátu.

---

## Obsah

- [Autentizace](#autentizace)
- [Nastavení tiskárny](#nastavení-tiskárny)
- [Bezpečnost](#bezpečnost)
- [API Endpoints](#api-endpoints)
  - [`POST /print`](#post-print)
  - [`POST /print-buffer`](#post-print-buffer)
  - [`POST /print-raw`](#post-print-raw)
- [Příklady použití](#příklady-použití)

---

## Autentizace

Ve výchozím nastavení je aktivní HTTP Basic Authentication. Přihlašovací údaje jsou ve formátu:

- Uživatelské jméno: `admin` (nebo dle `.env` / `auth.json`)
- Heslo: `admin` (nebo dle `.env` / `auth.json`)

Při požadavcích na chráněné endpointy je třeba tyto údaje posílat v hlavičce `Authorization`.

---

## Nastavení tiskárny

Vyber si typ tiskárny a její název nebo zařízení pomocí endpointu `/set-printer` (musíš být autentizovaný).

Možné typy:

- `shared` – sdílená síťová tiskárna (Windows)
- `usb` – USB zařízení (např. `/dev/usb/lp0`)
- `system` – systémová tiskárna (např. CUPS na Linuxu)
- `ip` – IP tiskárna (adresa ve formátu `tcp://192.168.0.123`)

---

## Bezpečnost

Tiskové API je chráněné Basic Auth, ale ochranu můžeš vypnout nebo zapnout přes `/set-security`.

---

## API Endpoints

### POST `/print`

Přijímá JSON pole tiskových příkazů v pořadí, které se mají vykreslit.

```json
{
  "data": [
    { "type": "text", "content": "Ahoj světe!" },
    { "type": "bold", "content": true },
    { "type": "text", "content": "Tučně" },
    { "type": "bold", "content": false },
    { "type": "line" },
    { "type": "qr", "content": "https://example.com" },
    { "type": "cut" }
  ]
}
