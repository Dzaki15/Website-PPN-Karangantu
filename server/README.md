# Backend for PPN Karangantu (Arsip Pintar)

Backend API untuk Website PPN Karangantu menggunakan Node.js + Express + SQLite.

## 🚀 CARA CEPAT MENJALANKAN SERVER

### Windows (Termudah - Double Click)
1. **Double-click file** `START_SERVER.bat` di folder ini
2. Server akan otomatis start di port 8080
3. Buka browser: **http://127.0.0.1:8080/register.html**

### Manual (PowerShell/CMD)
```powershell
cd server
npm install
node server.js
```

## ⚠️ PENTING: Cara Membuka Website

**BENAR** ✅
- Buka dari backend server: http://127.0.0.1:8080/register.html
- Buka dari backend server: http://127.0.0.1:8080/login.html

**SALAH** ❌
- JANGAN buka dari Live Server (http://127.0.0.1:5500)
- JANGAN buka dari Five Server atau static file server lain
- Kalau buka dari port selain 8080, kamu akan dapat error "Failed to fetch" atau "File not found"

## Persyaratan

- **Node.js** versi 16+
  - Download: https://nodejs.org (pilih LTS)
  - Setelah install, restart terminal/PowerShell

## Port & URLs

- **Backend API**: http://127.0.0.1:8080
- **Health Check**: http://127.0.0.1:8080/ping (test server hidup)
- **Register**: http://127.0.0.1:8080/register.html
- **Login**: http://127.0.0.1:8080/login.html
- **Home**: http://127.0.0.1:8080/home.html

## API Examples

- Register:
```http
POST /api/register
Content-Type: application/json
{
  "name": "Budi",
  "email": "budi@example.com",
  "password": "secret"
}
```

- Login:
```http
POST /api/login
Content-Type: application/json
{
  "email": "budi@example.com",
  "password": "secret"
}
```
Response includes `token` to use as `Authorization: Bearer <token>`.

- Create PB draft:
```http
POST /api/pb
Authorization: Bearer <token>
Content-Type: application/json
{
  "kapal": "KM. Contoh",
  "no_spb": "SPB-001",
  "tanggal": "2025-12-03"
}
```

- Update PB:
```http
PUT /api/pb/1
Authorization: Bearer <token>
Content-Type: application/json
{
  "status": "submitted",
  "data": {
    "kapal": "KM. Contoh",
    "no_spb": "SPB-001",
    "tanggal": "2025-12-04"
  }
}
```

- List PB forms:
```http
GET /api/pb
Authorization: Bearer <token>
```

## Frontend integration

Currently, frontend uses `localStorage`. You can switch to backend auth:
- On `register.html`, submit to `/api/register`, save `token` in `localStorage`.
- On `login.html`, submit to `/api/login`, save `token` (and `user`) then navigate.
- On `home.html`, call `/api/me` with `Authorization` to display user.
- In PB flow pages, call `/api/pb` endpoints.

This can be implemented progressively; I can wire these pages next if you want.
