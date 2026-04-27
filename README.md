# API Generate Google OAuth2 Token

REST API berbasis **Express.js** yang mengotomatisasi proses login Google menggunakan **Puppeteer** untuk mendapatkan OAuth2 Authorization Code, lalu menukarnya dengan **Refresh Token** melalui Google OAuth2 API.

---

## Daftar Isi

- [Cara Kerja](#cara-kerja)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Menjalankan Server](#menjalankan-server)
- [Penggunaan API](#penggunaan-api)
- [Struktur Project](#struktur-project)
- [Troubleshooting](#troubleshooting)
- [Catatan Penting](#catatan-penting)

---

## Cara Kerja

```
Client → POST /code → Puppeteer login Google → Redirect ke /redirect (simpan code) → Tukar code ke token → Return token
```

1. Client mengirim `POST /code` dengan kredensial Google dan OAuth client credentials
2. Puppeteer membuka browser Chrome dan melakukan login ke akun Google secara otomatis
3. Setelah login, Google meredirect ke `/redirect` dengan authorization code
4. Server menukar authorization code ke token melalui Google OAuth2 API
5. Response berisi `access_token`, `refresh_token`, dan informasi token lainnya

---

## Prasyarat

- **Node.js** v18 atau lebih baru
- **Google Cloud Project** dengan OAuth 2.0 Client ID yang sudah dikonfigurasi
- Akun Google yang akan digunakan **tidak mengaktifkan 2FA**
- Akun Google sudah terdaftar sebagai **Test User** di Google Cloud Console (jika app masih berstatus *Testing*)

> Lihat panduan lengkap setup Google Cloud Console di [`docs/GOOGLE_CLOUD_SETUP.md`](docs/GOOGLE_CLOUD_SETUP.md).

---

## Instalasi

```bash
npm install
```

---

## Konfigurasi

Buat file `.env` di root project:

```env
urlRedirect=http://localhost:4000/redirect
scopeApp=openid%20profile%20email%20https://mail.google.com%20https://www.googleapis.com/auth/drive
tokenUri=https://oauth2.googleapis.com/token
clientID=<your_google_client_id>
clientSecret=<your_google_client_secret>
```

| Variable       | Deskripsi                                              |
|----------------|--------------------------------------------------------|
| `urlRedirect`  | Redirect URI yang terdaftar di Google Cloud Console    |
| `scopeApp`     | Scope OAuth2 yang diminta (URL-encoded)                |
| `tokenUri`     | Endpoint token Google OAuth2                           |
| `clientID`     | Client ID dari Google Cloud Console                    |
| `clientSecret` | Client Secret dari Google Cloud Console                |

> `clientID` dan `clientSecret` bisa diperoleh dari [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.

---

## Menjalankan Server

```bash
node server.js
```

atau

```bash
npm start
```

Server berjalan di `http://localhost:4000`.

---

## Penggunaan API

### `POST /code`

Endpoint utama. Membuka browser, login ke Google, dan mengembalikan OAuth2 token.

**Request**

```
POST http://localhost:4000/code
Content-Type: application/json
```

```json
{
  "email": "your_email@gmail.com",
  "password": "your_password",
  "clientId": "463634754737-xxxx.apps.googleusercontent.com",
  "clientSecret": "GOCSPX-xxxx"
}
```

| Field          | Tipe   | Wajib | Deskripsi                    |
|----------------|--------|-------|------------------------------|
| `email`        | string | ✅    | Email akun Google            |
| `password`     | string | ✅    | Password akun Google         |
| `clientId`     | string | ✅    | OAuth2 Client ID             |
| `clientSecret` | string | ✅    | OAuth2 Client Secret         |

> ⚠️ Proses ini membuka browser Chrome secara otomatis. Jangan lakukan interaksi manual selama proses berlangsung. Estimasi waktu: **30–60 detik**.

**Response Sukses — `200 OK`**

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

**Response Error**

| Status | Body | Penyebab |
|--------|------|----------|
| `400` | `{ "status": "fail", "message": "Gagal, masukkan data dengan benar." }` | Salah satu field request tidak dikirim |
| `400` | `{ "status": "fail", "message": "Gagal saat verifikasi google dan mengambil code." }` | Email/password salah, atau Google mendeteksi bot |
| `500` | `{ "status": "error", "message": "invalid_client" }` | `clientId` atau `clientSecret` tidak valid |

**Contoh cURL**

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

---

### `GET /redirect`

Endpoint callback OAuth2. Dipanggil otomatis oleh Google setelah proses otorisasi — tidak perlu dipanggil manual dalam alur normal.

**Request**

```
GET http://localhost:4000/redirect?code=<authorization_code>
```

**Response — `200 OK`**

```json
{
  "code": "4/0Aci98E8_pX1Afr1UiWwk0VwW1eRG7-xxxx"
}
```

Server menyimpan `code` ke `config.json` sebagai media perantara sementara.

---

## Struktur Project

```
.
├── server.js               # Entry point, definisi route Express
├── puppeteerService.js     # Logic Puppeteer (login Google & token exchange)
├── src/
│   └── utils/
│       └── logger.js       # Logger berbasis Winston (WIB timezone)
├── logs/
│   ├── combined.log        # Semua log
│   └── error.log           # Log level error saja
├── docs/
│   └── GOOGLE_CLOUD_SETUP.md  # Panduan setup Google Cloud Console
├── UserData/               # Profil browser Puppeteer (session tersimpan)
├── config.json             # Penyimpanan sementara authorization code
├── .env                    # Konfigurasi environment (jangan di-commit)
├── TESTING.md              # Panduan testing lengkap
└── package.json
```

---

## Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---|---|---|
| Browser tidak terbuka | Puppeteer belum terinstall | Jalankan `npm install` ulang |
| Login gagal / timeout | Google mendeteksi bot atau CAPTCHA muncul | Coba lagi, atau gunakan akun yang sudah pernah login di browser tersebut |
| `FAILED_GET_CODE` | Email/password salah atau 2FA aktif | Pastikan kredensial benar dan 2FA dinonaktifkan |
| `500 invalid_client` | `clientId` atau `clientSecret` salah | Verifikasi credentials di Google Cloud Console |
| `redirect_uri_mismatch` | Redirect URI belum didaftarkan | Tambahkan `http://localhost:4000/redirect` di Authorized redirect URIs |
| `403 access_denied` | Email belum terdaftar sebagai Test User | Tambahkan email di OAuth Consent Screen → Test Users |
| Server tidak bisa diakses | Port 4000 sudah digunakan | Ganti port di `server.js` atau hentikan proses lain di port 4000 |

---

## Catatan Penting

- **Keamanan:** Jangan commit file `.env` ke repository. Pastikan `.env` sudah ada di `.gitignore`.
- **2FA:** Akun Google yang digunakan harus **menonaktifkan 2FA**, karena Puppeteer tidak dapat menangani verifikasi dua langkah secara otomatis.
- **Headless mode:** Browser berjalan dalam mode `headless: false` (terlihat). Ini diperlukan agar proses login tidak terdeteksi sebagai bot oleh Google.
- **Session tersimpan:** Folder `UserData/` menyimpan sesi browser. Jika akun sudah pernah login sebelumnya, proses berikutnya akan lebih cepat karena memanfaatkan session yang ada.
- **Request queue:** Server memproses satu request `POST /code` dalam satu waktu. Request berikutnya akan dimasukkan ke antrian dan diproses secara berurutan.
- **Logging:** Log tersimpan di folder `logs/`. Level log bisa dikontrol via environment variable `LOG_LEVEL` (default: `debug`).
