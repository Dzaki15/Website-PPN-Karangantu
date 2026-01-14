# Website PPN Karangantu — Arsip Pintar

Project ini adalah website + backend API (Node.js/Express + SQLite) untuk PPN Karangantu.

## Jalankan di device lain (Local)

### 1) Prasyarat
- Install **Node.js** (disarankan Node **18+**).

Cek apakah Node & npm sudah terpasang (PowerShell / CMD):

```bash
node -v
npm -v
```

Kalau command di atas error, berarti Node.js belum terpasang atau PATH belum benar.

### 2) Ambil project (GitHub atau ZIP)

**Opsi A — dari GitHub (disarankan)**

```bash
git clone <URL_REPO_GITHUB_KAMU>
cd "<nama-folder-project>"
```

**Opsi B — dari ZIP**
- Extract ZIP
- Buka folder project sampai terlihat struktur seperti `server/`, `css/`, `js/`, dan file HTML di root.

### 3) Install dependency backend
Jalankan dari root project (folder yang ada file README ini):

```bash
cd server
npm install
```

### 4) Konfigurasi Environment (.env) (disarankan)

File contoh ada di `server/.env.example`.

**Windows PowerShell (dari root project):**

```powershell
Copy-Item server\.env.example server\.env
```

Lalu edit `server/.env` dan isi minimal ini (disarankan untuk production juga):
- `JWT_SECRET` (random panjang)
- `SESSION_SECRET` (random panjang)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

SQLite:
- Default DB: `server/data.db`
- Bisa override lokasi DB dengan `SQLITE_PATH`.

### 5) Start server
```bash
npm start
```

Alternatif Windows (paling mudah):
- Double click: `server/START_SERVER.bat`

Kalau server berhasil jalan, biasanya akan listen di:
- `http://127.0.0.1:8080`

### 6) Buka webnya (PENTING)
Frontend **harus dibuka lewat backend server**, bukan Live Server.

Buka di browser:
- `http://127.0.0.1:8080/welcome.html`
- `http://127.0.0.1:8080/login.html`
- `http://127.0.0.1:8080/register.html`

Health check:
- `http://127.0.0.1:8080/ping`

Atau cek via PowerShell:

```powershell
irm http://127.0.0.1:8080/ping
```

> Jangan buka dari Live Server (mis. `http://127.0.0.1:5500`) atau file langsung (`file://...`) karena API call akan gagal.

## Akses dari device lain (1 WiFi / LAN)

Kalau kamu mau buka website ini dari HP/PC lain (mis. HP akses ke laptop yang menjalankan server):

1) Jalankan server di komputer utama seperti langkah di atas.
2) Cari IP komputer utama:

```powershell
ipconfig
```

Cari bagian **IPv4 Address** (contoh: `192.168.1.10`).

3) Dari device lain, buka:
- `http://192.168.1.10:8080/welcome.html`

Kalau tidak bisa diakses, kemungkinan Windows Firewall memblokir. Solusi cepat:
- Izinkan inbound untuk port `8080` (atau port yang dipakai).

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

Setelah deploy, tes endpoint ini (harus balikin response dari backend):
- `https://<domain-railway-kamu>/ping`

Catatan SQLite di Railway:
- Jika butuh data tidak hilang saat redeploy, gunakan **Volume**, lalu set `SQLITE_PATH=/data/data.db` (sesuaikan mount path).

---

Backend README yang lebih detail ada di `server/README.md`.
