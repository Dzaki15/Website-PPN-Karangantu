# Website PPN Karangantu — Arsip Pintar

Project ini adalah website + backend API (Node.js/Express + SQLite) untuk PPN Karangantu.

## Jalankan di device lain (Local)

### 1) Prasyarat
- Install **Node.js** (disarankan Node **18+**).

### 2) Install dependency backend
Jalankan dari root project:

```bash
cd server
npm install
```

### 3) Start server
```bash
npm start
```

Alternatif Windows (paling mudah):
- Double click: `server/START_SERVER.bat`

### 4) Buka webnya (PENTING)
Frontend **harus dibuka lewat backend server**, bukan Live Server.

Buka di browser:
- `http://127.0.0.1:8080/welcome.html`
- `http://127.0.0.1:8080/login.html`
- `http://127.0.0.1:8080/register.html`

Health check:
- `http://127.0.0.1:8080/ping`

> Jangan buka dari Live Server (mis. `http://127.0.0.1:5500`) atau file langsung (`file://...`) karena API call akan gagal.

## Konfigurasi Environment (.env)

File contoh ada di `server/.env.example`.

Minimal yang disarankan di production:
- `JWT_SECRET` (random panjang)
- `SESSION_SECRET` (random panjang)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

SQLite:
- Default DB: `server/data.db`
- Bisa override lokasi DB dengan `SQLITE_PATH`.

## Deploy ke Railway

Repo ini sudah disiapkan supaya Railway menjalankan backend dari root:
- Root `package.json` menjalankan `node server/server.js`
- Backend akan serve file frontend (HTML/CSS/JS) + endpoint `/api/*` dari domain yang sama

Langkah ringkas:
1) Railway → **New Project** → **Deploy from GitHub Repo**
2) Pastikan build/start pakai root project.
3) Set Variables (minimal):
   - `JWT_SECRET`
   - `SESSION_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
4) Networking: Generate Domain → target port **8080** (atau set `PORT` sesuai yang kamu pakai)

Catatan SQLite di Railway:
- Jika butuh data tidak hilang saat redeploy, gunakan **Volume**, lalu set `SQLITE_PATH=/data/data.db` (sesuaikan mount path).

---

Backend README yang lebih detail ada di `server/README.md`.
