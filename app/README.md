
# API Dokumentace tiskových endpointů

Tady najdeš stručný přehled tří hlavních endpointů pro tisk v Print Serveru.

## Adresa a port
Tiskový server běží na adrese `http://localhost:60420`.

---

## POST `/print`

Tiskne posloupnost příkazů jako JSON pole, které tvoří obsah a formát výtisku.

### Request

- Content-Type: `application/json`
- Body:

```json
{
  "data": [
    { "type": "text", "content": "Váš text" },
    { "type": "bold", "content": true },
    { "type": "text", "content": "Tučný text" },
    { "type": "bold", "content": false },
    { "type": "line" },
    { "type": "qr", "content": "https://example.com" },
    { "type": "barcode", "content": "123456789012" },
    { "type": "size", "content": "2.2" },
    { "type": "align", "content": "center" },
    { "type": "underline", "content": true },
    { "type": "newline" },
    { "type": "cut" }
  ]
}
```

### Podporované typy příkazů (`type`):

| Typ        | Popis                                          | Content                          |
|------------|------------------------------------------------|--------------------------------|
| `text`     | Vytiskne text                                  | String s textem                |
| `line`     | Vytiskne čáru (----)                           | -                              |
| `qr`       | Vytiskne QR kód                                | Text pro QR kód                |
| `barcode`  | Vytiskne čárový kód                            | Číselný kód (code128)          |
| `size`     | Nastaví velikost textu (šířka.výška, max 7)   | String např. `"2.2"`           |
| `align`    | Zarovnání textu (`left`, `center`, `right`)   | String s hodnotou              |
| `bold`     | Zapne/vypne tučný tisk                         | Boolean (true/false)           |
| `underline`| Zapne/vypne podtržení                          | Boolean (true/false)           |
| `cut`      | Ustřihnutí papíru                              | -                             |
| `newline`  | Prázdný řádek                                   | -                             |

### Response

- `200 OK` + `{ "success": true }`
- `400 Bad Request` pokud jsou data špatně nebo tiskárna není vybrána
- `401 Unauthorized` pokud chybí nebo je špatná autentizace (pokud je povolena)

---

## POST `/print-buffer`

Tiskne přímo binární tiskový buffer zakódovaný base64.

### Request

- Content-Type: `application/json`
- Body:

```json
{
  "bufferBase64": "<base64-encoded-buffer>"
}
```

### Response

- `200 OK` + `{ "success": true }`
- `400 Bad Request` pokud chybí `bufferBase64` nebo tiskárna není vybrána
- `401 Unauthorized` pokud chybí nebo je špatná autentizace (pokud je povolena)

---

## POST `/print-raw`

Tiskne surový text (např. ESC/POS příkazy nebo prostý text). Po tisku automaticky posílá příkaz pro ustřižení papíru.

### Request

- Content-Type: `application/json`
- Body:

```json
{
  "text": "Toto je surový tiskový text\ns novým řádkem."
}
```

### Response

- `200 OK` + `{ "success": true }`
- `400 Bad Request` pokud chybí `text` nebo tiskárna není vybrána
- `401 Unauthorized` pokud chybí nebo je špatná autentizace (pokud je povolena)

---

## Autentizace

Pokud je tisková bezpečnost zapnutá, všechny endpointy vyžadují HTTP Basic Auth.

---

## Příklad použití s `curl`

```bash
curl -u admin:admin -X POST http://localhost:60420/print-raw \
  -H "Content-Type: application/json" \
  -d '{"text":"Ahoj, tady tisknu surový text a hned střih."}'
```

```bash
curl -u admin:admin -X POST http://localhost:60420/print \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"type":"text","content":"Nadpis"},
      {"type":"bold","content":true},
      {"type":"text","content":"Tučný text"},
      {"type":"bold","content":false},
      {"type":"line"},
      {"type":"qr","content":"https://github.com"},
      {"type":"cut"}
    ]
  }'
```

```bash
curl -u admin:admin -X POST http://localhost:60420/print-buffer \
  -H "Content-Type: application/json" \
  -d '{"bufferBase64":"<base64_data>"}'
```
