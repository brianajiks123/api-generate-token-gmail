# Setup Google Cloud Console

Panduan lengkap untuk menyiapkan Google Cloud Console dari awal agar project **api-generate-token-gmail** dapat berjalan.

---

## Daftar Isi

1. [Buat Project Baru](#1-buat-project-baru)
2. [Aktifkan Gmail API dan Google Drive API](#2-aktifkan-gmail-api-dan-google-drive-api)
3. [Konfigurasi OAuth Consent Screen](#3-konfigurasi-oauth-consent-screen)
4. [Buat OAuth 2.0 Client ID](#4-buat-oauth-20-client-id)
5. [Tambahkan Redirect URI](#5-tambahkan-redirect-uri)
6. [Tambahkan Test User](#6-tambahkan-test-user)
7. [Salin Credentials ke .env](#7-salin-credentials-ke-env)
8. [Verifikasi Konfigurasi](#8-verifikasi-konfigurasi)

---

## 1. Buat Project Baru

1. Buka [https://console.cloud.google.com](https://console.cloud.google.com)
2. Login menggunakan akun Google Anda
3. Di bagian atas halaman, klik dropdown nama project (sebelah kiri tulisan **Google Cloud**)
4. Klik tombol **New Project**
5. Isi form:
   - **Project name**: `api-generate-token-gmail` (atau nama lain sesuai keinginan)
   - **Location**: biarkan default (*No organization*)
6. Klik **Create**
7. Tunggu beberapa detik hingga project selesai dibuat
8. Pastikan project baru sudah terpilih di dropdown atas

---

## 2. Aktifkan Gmail API dan Google Drive API

API perlu diaktifkan agar OAuth token yang dihasilkan bisa mengakses Gmail dan Google Drive.

### Aktifkan Gmail API

1. Buka [https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)
2. Di kolom pencarian, ketik `Gmail API`
3. Klik hasil **Gmail API**
4. Klik tombol **Enable**

### Aktifkan Google Drive API

1. Kembali ke [https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)
2. Di kolom pencarian, ketik `Google Drive API`
3. Klik hasil **Google Drive API**
4. Klik tombol **Enable**

---

## 3. Konfigurasi OAuth Consent Screen

OAuth Consent Screen adalah halaman izin yang muncul saat user login. Ini wajib dikonfigurasi sebelum membuat Client ID.

1. Buka [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
2. Pilih **External** sebagai User Type
   > Pilih External agar bisa digunakan oleh akun Gmail manapun
3. Klik **Create**
4. Isi form **App information**:
   - **App name**: `api-generate-token-gmail`
   - **User support email**: pilih email Anda dari dropdown
   - **App logo**: kosongkan (opsional)
5. Scroll ke bawah ke bagian **Developer contact information**:
   - **Email addresses**: isi dengan email Anda
6. Klik **Save and Continue**

### Halaman Scopes

1. Klik **Add or Remove Scopes**
2. Cari dan centang scope berikut satu per satu:
   - `openid`
   - `profile`
   - `email`
   - `https://mail.google.com/` *(Gmail — full access)*
   - `https://www.googleapis.com/auth/drive` *(Google Drive — full access)*
3. Klik **Update**
4. Klik **Save and Continue**

### Halaman Test Users

> Karena app masih dalam status **Testing**, hanya email yang didaftarkan di sini yang bisa login.

1. Klik **Add Users**
2. Masukkan email Gmail yang akan digunakan untuk generate token
3. Klik **Add**
4. Klik **Save and Continue**

### Halaman Summary

1. Review konfigurasi
2. Klik **Back to Dashboard**

---

## 4. Buat OAuth 2.0 Client ID

1. Buka [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Klik **+ Create Credentials** di bagian atas
3. Pilih **OAuth client ID**
4. Isi form:
   - **Application type**: pilih **Web application**
   - **Name**: `api-generate-token-gmail`
5. Lanjut ke langkah berikutnya untuk menambahkan Redirect URI

---

## 5. Tambahkan Redirect URI

Masih di halaman pembuatan OAuth Client ID:

1. Scroll ke bagian **Authorized redirect URIs**
2. Klik **+ Add URI**
3. Masukkan URI berikut:
   ```
   http://localhost:4000/redirect
   ```
4. Klik **Create**

Setelah berhasil, Google akan menampilkan popup berisi:
- **Client ID**
- **Client Secret**

> ⚠️ **Simpan kedua nilai ini**, akan digunakan di file `.env`.

Klik **Download JSON** untuk menyimpan credentials sebagai backup, lalu klik **OK**.

---

## 6. Tambahkan Test User

Jika belum dilakukan di langkah 3, tambahkan test user sekarang:

1. Buka [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
2. Klik tab **Test users**
3. Klik **+ Add Users**
4. Masukkan email Gmail yang akan digunakan
5. Klik **Save**

> Selama app masih berstatus **Testing**, maksimal 100 test user yang bisa ditambahkan.

---

## 7. Salin Credentials ke .env

Buka file `.env` di root project dan isi dengan nilai dari Google Cloud Console:

```env
urlRedirect=http://localhost:4000/redirect
scopeApp=openid%20profile%20email%20https://mail.google.com%20https://www.googleapis.com/auth/drive
clientSecret=<CLIENT_SECRET_DARI_GOOGLE_CLOUD>
tokenUri=https://oauth2.googleapis.com/token
clientID=<CLIENT_ID_DARI_GOOGLE_CLOUD>
```

Ganti `<CLIENT_ID_DARI_GOOGLE_CLOUD>` dan `<CLIENT_SECRET_DARI_GOOGLE_CLOUD>` dengan nilai yang didapat dari langkah 5.

**Contoh format Client ID:**
```
463634754737-xxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

**Contoh format Client Secret:**
```
GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 8. Verifikasi Konfigurasi

Sebelum menjalankan program, pastikan semua checklist berikut terpenuhi:

- [ ] Project sudah dibuat di Google Cloud Console
- [ ] Gmail API sudah diaktifkan
- [ ] Google Drive API sudah diaktifkan
- [ ] OAuth Consent Screen sudah dikonfigurasi dengan status **Testing**
- [ ] Semua scope sudah ditambahkan (openid, profile, email, Gmail, Drive)
- [ ] Redirect URI `http://localhost:4000/redirect` sudah terdaftar di OAuth Client
- [ ] Email yang akan digunakan sudah ditambahkan sebagai Test User
- [ ] File `.env` sudah diisi dengan Client ID dan Client Secret yang benar

### Jalankan Server

```bash
node server.js
```

### Test via API

Kirim request POST ke `http://localhost:4000/code`:

```json
{
  "email": "your-email@gmail.com",
  "password": "your-password",
  "clientId": "your-client-id.apps.googleusercontent.com",
  "clientSecret": "GOCSPX-your-client-secret"
}
```

---

## Troubleshooting

### "Couldn't sign you in" / `/signin/rejected`

Redirect URI belum terdaftar. Pastikan `http://localhost:4000/redirect` sudah ada di **Authorized redirect URIs** pada OAuth Client ID.

### "Access blocked: app's request is invalid"

Scope yang diminta tidak sesuai dengan yang didaftarkan di OAuth Consent Screen. Pastikan semua scope di `.env` sudah ditambahkan di langkah 3.

### "This app isn't verified"

Normal untuk app yang masih berstatus **Testing**. Klik **Advanced** → **Go to app (unsafe)** untuk melanjutkan. Ini hanya muncul jika email yang login belum terdaftar sebagai Test User.

### "403: access_denied"

Email yang digunakan belum ditambahkan sebagai Test User. Tambahkan di OAuth Consent Screen → Test Users.

### Perubahan tidak langsung berlaku

Setelah menyimpan perubahan di Google Cloud Console (redirect URI, test user, dll), tunggu **1-2 menit** sebelum mencoba kembali karena Google butuh waktu propagasi.
