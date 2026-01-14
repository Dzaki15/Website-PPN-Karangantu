# Setup OAuth untuk ARSIP PINTAR

## 📋 Langkah-langkah Setup

### 1. Install Dependencies

Jalankan perintah berikut di folder `server/`:

```bash
cd server
npm install
```

Dependencies yang akan diinstall:
- `passport` - Authentication middleware
- `passport-google-oauth20` - Google OAuth strategy
- `passport-facebook` - Facebook OAuth strategy
- `express-session` - Session management

### 2. Konfigurasi Google OAuth

#### A. Buat Google OAuth Credentials

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru atau pilih project yang ada
3. Aktifkan **Google+ API**
4. Pergi ke **Credentials** → **Create Credentials** → **OAuth Client ID**
5. Pilih **Web application**
6. Tambahkan **Authorized redirect URIs**:
   - `http://localhost:8080/auth/google/callback`
   - `http://127.0.0.1:8080/auth/google/callback`
7. Copy **Client ID** dan **Client Secret**

#### B. Tambahkan ke `.env`

Buat file `.env` di folder `server/` (copy dari `.env.example`):

```env
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
```

### 3. Konfigurasi Facebook OAuth

#### A. Buat Facebook App

1. Buka [Facebook Developers](https://developers.facebook.com/)
2. Klik **My Apps** → **Create App**
3. Pilih **Consumer** sebagai app type
4. Isi nama aplikasi dan email
5. Pergi ke **Settings** → **Basic**
6. Copy **App ID** dan **App Secret**
7. Pergi ke **Facebook Login** → **Settings**
8. Tambahkan **Valid OAuth Redirect URIs**:
   - `http://localhost:8080/auth/facebook/callback`

#### B. Tambahkan ke `.env`

```env
FACEBOOK_APP_ID=your-actual-app-id
FACEBOOK_APP_SECRET=your-actual-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:8080/auth/facebook/callback
```

### 4. Lengkapi File `.env`

File `.env` lengkap Anda:

```env
PORT=8080
JWT_SECRET=ganti-dengan-secret-key-yang-kuat
SESSION_SECRET=ganti-dengan-session-secret-yang-kuat

SQLITE_PATH=./data.db

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback

FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:8080/auth/facebook/callback

STATIC_DIR=../
```

### 5. Jalankan Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:8080`

## 🔄 Cara Kerja OAuth

1. User klik tombol "Login with Google" atau "Login with Facebook"
2. Browser redirect ke halaman login Google/Facebook
3. User login dan memberikan permission
4. Google/Facebook redirect kembali ke `/auth/google/callback` atau `/auth/facebook/callback`
5. Backend membuat atau mencari user di database
6. Backend generate JWT token
7. Redirect ke `home.html` dengan token di URL
8. Frontend menyimpan token ke localStorage
9. User berhasil login

## 📝 Catatan Penting

- **Development**: Gunakan `http://localhost:8080` untuk testing
- **Production**: Ganti callback URL dengan domain production Anda
- **Security**: Jangan commit file `.env` ke git (sudah ada di `.gitignore`)
- **Database**: OAuth users akan disimpan dengan `oauth_provider` dan `oauth_id`

## 🐛 Troubleshooting

**Error: redirect_uri_mismatch**
- Pastikan callback URL di `.env` sama dengan yang di Google/Facebook console

**Error: Invalid OAuth client**
- Periksa Client ID dan Secret sudah benar

**User tidak bisa login**
- Pastikan server berjalan di port yang sama dengan callback URL
- Cek console browser untuk error messages

## 📚 Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Passport.js Documentation](http://www.passportjs.org/)
