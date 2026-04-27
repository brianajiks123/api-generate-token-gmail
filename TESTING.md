# Panduan Testing — API Generate Google OAuth2 Refresh Token

## Gambaran Umum Project

Project ini adalah REST API berbasis Express.js yang mengotomatisasi proses login Google menggunakan Puppeteer untuk mendapatkan **OAuth2 Authorization Code**, lalu menukarnya dengan **Refresh Token** melalui Google OAuth2 API.

### Alur Kerja
```
Client → POST /code → Puppeteer login Google → Redirect ke /redirect (simpan code) → Tukar code ke token → Return refresh_token
```

### Endpoint yang Tersedia

| Method | Endpoint    | Deskripsi                                                        |
|--------|-------------|------------------------------------------------------------------|
| POST   | `/code`     | Login Google via Puppeteer & tukar authorization code ke token  |
| GET    | `/redirect` | Callback OAuth2, menerima dan menyimpan authorization code       |

---

## Persiapan Sebelum Testing

### 1. Install Dependencies

```bash
npm install
```

### 2. Konfigurasi File `.env`

Pastikan file `.env` sudah terisi dengan benar:

```env
urlRedirect=http://localhost:4000/redirect
scopeApp=openid%20profile%20email%20https://mail.google.com%20https://www.googleapis.com/auth/drive
tokenUri=https://oauth2.googleapis.com/token
clientID=<your_google_client_id>
clientSecret=<your_google_client_secret>
```

> **Catatan:** `clientID` dan `clientSecret` bisa diperoleh dari [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.

### 3. Konfigurasi Google Cloud Console

Sebelum testing, pastikan hal berikut sudah dikonfigurasi di Google Cloud Console:

- **Authorized redirect URIs** sudah ditambahkan: `http://localhost:4000/redirect`
- OAuth consent screen sudah dikonfigurasi
- Akun Google yang digunakan untuk testing sudah ditambahkan sebagai **Test User** (jika app masih dalam mode testing)

### 4. Jalankan Server

```bash
node server.js
```

Server akan berjalan di `http://localhost:4000`.

---

## Testing Endpoint

### Endpoint 1: `POST /code`

Endpoint utama untuk mendapatkan refresh token secara otomatis.

**Request:**

```
POST http://localhost:4000/code
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "your_google_email@gmail.com",
  "password": "your_google_password",
  "clientId": "your_google_client_id",
  "clientSecret": "your_google_client_secret"
}
```

**Contoh menggunakan cURL:**

```bash
curl -X POST http://localhost:4000/code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_email@gmail.com",
    "password": "your_password",
    "clientId": "463634754737-xxxx.apps.googleusercontent.com",
    "clientSecret": "GOCSPX-xxxx"
  }'
```

**Contoh menggunakan Postman:**

1. Buka Postman
2. Buat request baru → Method: `POST`
3. URL: `http://localhost:4000/code`
4. Tab **Body** → pilih `raw` → format `JSON`
5. Masukkan body JSON di atas
6. Klik **Send**

> ⚠️ **Perhatian:** Proses ini akan membuka browser Chrome secara otomatis dan melakukan login. Pastikan tidak ada interaksi manual selama proses berlangsung. Proses membutuhkan waktu sekitar **30–60 detik**.

---

#### Skenario Testing `POST /code`

**✅ Skenario 1 — Sukses mendapatkan refresh token**

- Input: email, password, clientId, clientSecret yang valid
- Ekspektasi response `200 OK`:

```json
{
  "status": "success",
  "data": {
    "access_token": "ya29.xxxx",
    "expires_in": 3599,
    "refresh_token": "1//xxxx",
    "scope": "https://mail.google.com/ https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid",
    "token_type": "Bearer",
    "id_token": "eyJxxxx",
    "refresh_token_expires_in": 604799
  }
}
```

---

**❌ Skenario 2 — Request body tidak lengkap**

- Input: salah satu field (`email`, `password`, `clientId`, atau `clientSecret`) tidak dikirim
- Ekspektasi response `400 Bad Request`:

```json
{
  "status": "fail",
  "message": "Gagal, masukkan data dengan benar."
}
```

Contoh cURL (tanpa `clientSecret`):

```bash
curl -X POST http://localhost:4000/code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_email@gmail.com",
    "password": "your_password",
    "clientId": "your_client_id"
  }'
```

---

**❌ Skenario 3 — Email atau password salah**

- Input: email/password tidak valid
- Puppeteer gagal melewati halaman login Google
- Ekspektasi response `400 Bad Request`:

```json
{
  "status": "fail",
  "message": "Gagal saat verifikasi google dan mengambil code."
}
```

---

**❌ Skenario 4 — clientId atau clientSecret salah**

- Input: email/password benar, tapi `clientId` atau `clientSecret` tidak valid
- Puppeteer berhasil login, tapi penukaran token ke Google gagal
- Ekspektasi response `500 Internal Server Error`:

```json
{
  "status": "error",
  "message": "invalid_client"
}
```

> **Catatan:** Nilai `message` berasal dari `error_description` yang dikembalikan Google. Contoh nilai umum: `"invalid_client"`, `"invalid_grant"`, `"unauthorized_client"`.

---

### Endpoint 2: `GET /redirect`

Endpoint ini adalah **OAuth2 callback** yang dipanggil otomatis oleh Google setelah proses otorisasi. Tidak perlu dipanggil manual dalam alur normal, namun bisa diuji secara terpisah.

**Request:**

```
GET http://localhost:4000/redirect?code=<authorization_code>
```

**Contoh cURL:**

```bash
curl "http://localhost:4000/redirect?code=4%2F0Aci98E8_pX1Afr1UiWwk0VwW1eRG7-xxxx"
```

**Ekspektasi:**

- Server menyimpan `code` ke file `config.json`
- Response mengembalikan query params yang diterima:

```json
{
  "code": "4/0Aci98E8_pX1Afr1UiWwk0VwW1eRG7-xxxx"
}
```

---

## Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---|---|---|
| Browser tidak terbuka | Puppeteer belum terinstall dengan benar | Jalankan `npm install` ulang |
| Login gagal / timeout | Google mendeteksi bot atau CAPTCHA muncul | Coba lagi, atau gunakan akun yang sudah pernah login di browser tersebut |
| `FAILED_GET_CODE` error | Email/password salah atau 2FA aktif | Pastikan kredensial benar dan 2FA dinonaktifkan |
| Token exchange gagal | `clientId` atau `clientSecret` salah | Verifikasi credentials di Google Cloud Console |
| Server error 500 saat tukar token | Google menolak request token exchange | Cek pesan `message` di response untuk detail error dari Google |
| `redirect_uri_mismatch` | Redirect URI belum didaftarkan di Google Cloud | Tambahkan `http://localhost:4000/redirect` di Authorized redirect URIs |
| Server tidak bisa diakses | Port 4000 sudah digunakan | Ganti port di `server.js` atau hentikan proses lain di port 4000 |

---

## Catatan Penting

- **Keamanan:** Jangan commit file `.env` ke repository. Pastikan `.env` sudah ada di `.gitignore`.
- **2FA (Two-Factor Authentication):** Akun Google yang digunakan sebaiknya **tidak mengaktifkan 2FA**, karena Puppeteer tidak dapat menangani verifikasi 2FA secara otomatis.
- **Headless mode:** Saat ini browser berjalan dalam mode `headless: false` (browser terlihat). Ini diperlukan agar proses login Google berjalan normal dan tidak terdeteksi sebagai bot.
- **config.json:** File ini digunakan sebagai media perantara untuk menyimpan authorization code sementara. Isinya akan ditimpa setiap kali ada request baru.
