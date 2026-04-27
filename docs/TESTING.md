# Testing Guide — API Generate Google OAuth2 Token

## Project Overview

This project is a REST API built with Express.js that automates the Google login process using Puppeteer to obtain an **OAuth2 Authorization Code**, then exchanges it for a **Refresh Token** via the Google OAuth2 API.

### Workflow

```
Client → POST /code → [Serial Queue] → Puppeteer logs into Google → GET /redirect (saves code) → Exchange code for token → Return token
```

### Available Endpoints

| Method | Endpoint    | Description                                                                    |
|--------|-------------|--------------------------------------------------------------------------------|
| POST   | `/code`     | Logs into Google via Puppeteer and exchanges the authorization code for a token |
| GET    | `/redirect` | OAuth2 callback — receives and saves the authorization code to config.json     |

---

## Setup Before Testing

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure the `.env` File

Make sure the `.env` file is filled in correctly:

```env
urlRedirect=http://localhost:4000/redirect
scopeApp=openid%20profile%20email%20https://mail.google.com%20https://www.googleapis.com/auth/drive
tokenUri=https://oauth2.googleapis.com/token
LOG_LEVEL=debug
```

> **Note:** `clientId` and `clientSecret` are **not** stored in `.env`. They are sent per-request via the `POST /code` request body.

### 3. Configure Google Cloud Console

Before testing, make sure the following are configured in Google Cloud Console:

- Gmail API and Google Drive API are enabled
- OAuth Consent Screen is configured (status: **Testing**)
- Registered scopes: `openid`, `profile`, `email`, `https://mail.google.com/`, `https://www.googleapis.com/auth/drive`
- **Authorized redirect URIs** includes: `http://localhost:4000/redirect`
- The Google account being used is registered as a **Test User**

> See the full setup guide at [`docs/GOOGLE_CLOUD_SETUP.md`](GOOGLE_CLOUD_SETUP.md).

### 4. Start the Server

```bash
node server.js
```

The server will run at `http://localhost:4000`. Logs will appear in the console and be saved to the `logs/` folder.

---

## Testing Endpoints

### Endpoint 1: `POST /code`

The main endpoint for automatically obtaining a refresh token.

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

**Using cURL:**

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

**Using Postman:**

1. Open Postman
2. Create a new request → Method: `POST`
3. URL: `http://localhost:4000/code`
4. **Body** tab → select `raw` → format `JSON`
5. Paste the JSON body above
6. Click **Send**

> ⚠️ **Warning:** This process will automatically open a Chrome browser and perform the login. Do not interact with the browser manually while it is running. Estimated time: **30–60 seconds** (faster if a session is already saved in `UserData/`).

> ℹ️ Requests are processed **serially** — if another request is already running, the new one is queued and processed after the previous one completes.

---

#### Test Scenarios for `POST /code`

**✅ Scenario 1 — Successfully obtains a token (no 2FA, new session)**

- Input: valid email, password, clientId, clientSecret
- Condition: account has never logged in on this browser (`UserData/` is empty or new)
- Flow: Puppeteer inputs email → inputs password → clicks Continue → approves consent → receives code → exchanges for token
- Expected response `200 OK`:

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

**✅ Scenario 2 — Successfully obtains a token (active session in UserData)**

- Input: valid email, password, clientId, clientSecret
- Condition: account has previously logged in, `UserData/` contains a saved session
- Flow: Puppeteer detects account chooser → selects account → handles consent pages → receives code → exchanges for token
- Expected response `200 OK` (same as Scenario 1, but faster ~10–20 seconds)

---

**❌ Scenario 3 — Incomplete request body**

- Input: one of the fields (`email`, `password`, `clientId`, or `clientSecret`) is missing
- Expected response `400 Bad Request`:

```json
{
  "status": "fail",
  "message": "Gagal, masukkan data dengan benar."
}
```

Example cURL (missing `clientSecret`):

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

**❌ Scenario 4 — Wrong email or password**

- Input: invalid email or password
- Puppeteer fails to pass the Google login page (Google rejects with `/signin/rejected`)
- Expected response `400 Bad Request`:

```json
{
  "status": "fail",
  "message": "Gagal saat verifikasi google dan mengambil code."
}
```

---

**❌ Scenario 5 — Google detects bot**

- Input: valid credentials, but Google blocks the login due to automation detection
- Puppeteer receives a redirect to `/signin/rejected` after entering the password
- Expected response `400 Bad Request`:

```json
{
  "status": "fail",
  "message": "Gagal saat verifikasi google dan mengambil code."
}
```

> **Note:** The server automatically attempts to clear cookies & session and retry if `/signin/rejected` is detected at the start of navigation. However, if it occurs after entering the password, the request fails immediately.

---

**❌ Scenario 6 — Wrong clientId or clientSecret**

- Input: valid email/password, but `clientId` or `clientSecret` is invalid
- Puppeteer successfully logs in and obtains the authorization code, but the token exchange with Google fails
- Expected response `500 Internal Server Error`:

```json
{
  "status": "error",
  "message": "invalid_client"
}
```

> **Note:** The `message` value comes from the `error_description` returned by Google. Common values: `"invalid_client"`, `"invalid_grant"`, `"unauthorized_client"`, `"redirect_uri_mismatch"`.

---

**⏳ Scenario 7 — Account with 2FA enabled**

- Input: valid email/password, account has 2-Step Verification enabled
- Puppeteer detects the `/signin/challenge/` page and waits for manual confirmation
- Timeout: **120 seconds**
- If confirmed on phone within 120 seconds → process continues, success response
- If not confirmed within 120 seconds → Expected response `400 Bad Request`:

```json
{
  "status": "fail",
  "message": "Gagal saat verifikasi google dan mengambil code."
}
```

---

**⏳ Scenario 8 — Concurrent requests (queue)**

- Send 2 `POST /code` requests simultaneously
- The first request is processed immediately
- The second request is queued and waits
- After the first request completes, the second begins processing
- Both requests receive a success response sequentially

---

### Endpoint 2: `GET /redirect`

This endpoint is the **OAuth2 callback** called automatically by Google after the authorization flow. It does not need to be called manually in normal usage, but can be tested independently.

**Request:**

```
GET http://localhost:4000/redirect?code=<authorization_code>
```

**cURL Example:**

```bash
curl "http://localhost:4000/redirect?code=4%2F0Aci98E8_pX1Afr1UiWwk0VwW1eRG7-xxxx"
```

**Expected behavior:**

- Server saves the `code` to `config.json`
- Response returns all received query params:

```json
{
  "code": "4/0Aci98E8_pX1Afr1UiWwk0VwW1eRG7-xxxx"
}
```

**Scenario — empty code:**

```bash
curl "http://localhost:4000/redirect"
```

Response:

```json
{}
```

`config.json` will contain `{"code":""}`.

---

## Log Verification

During testing, monitor the console or `logs/combined.log` to follow the flow in real time.

Example log output for a successful flow:

```
2026-04-27 10:00:00 [info]: POST /code — email: user@gmail.com, clientId: 463634...
2026-04-27 10:00:00 [info]: REQUEST MASUK ANTRIAN — email: user@gmail.com | antrian: 0
2026-04-27 10:00:01 [info]: LAUNCH BROWSER BARU
2026-04-27 10:00:03 [info]: NAVIGASI KE LOGIN URL
2026-04-27 10:00:05 [info]: CEK USER DATA: TIDAK ADA — alur input email/password
2026-04-27 10:00:06 [info]: AKSI INPUT EMAIL + ENTER
2026-04-27 10:00:14 [info]: AKSI INPUT PASSWORD + ENTER
2026-04-27 10:00:22 [info]: AKSI KLIK CONTINUE
2026-04-27 10:00:35 [info]: AKSI SELESAI — code berhasil didapat
2026-04-27 10:00:35 [info]: AKSI MENGAMBIL TOKEN
2026-04-27 10:00:36 [info]: TOKEN BERHASIL DIDAPAT
2026-04-27 10:00:36 [info]: POST /code — berhasil mendapatkan token untuk email: user@gmail.com
2026-04-27 10:00:36 [info]: POST /code 200 - 36000ms
```

---

## Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| Browser does not open | Puppeteer not installed correctly | Run `npm install` again |
| Login fails / timeout | Google detects bot or CAPTCHA appears | Retry; use an account that has previously logged in so a session is saved in `UserData/` |
| `FAILED_GET_CODE` | Wrong email/password, or 2FA timeout (120s) | Verify credentials; if 2FA is active, confirm on phone within 120 seconds |
| Token exchange fails | Wrong `clientId` or `clientSecret` | Verify credentials in Google Cloud Console |
| `redirect_uri_mismatch` | Redirect URI not registered in Google Cloud | Add `http://localhost:4000/redirect` to Authorized redirect URIs |
| `403 access_denied` | Email not registered as a Test User | Add the email in OAuth Consent Screen → Test Users |
| `This app isn't verified` | App is still in Testing status | Click **Advanced** → **Go to app (unsafe)**, or register the email as a Test User |
| Server not accessible | Port 4000 already in use | Stop the other process on port 4000, or change the port in `server.js` |
| Request takes too long | Previous request still processing (queue) | Wait for the previous request to finish |
| Logs not showing in console | `NODE_ENV=production` is set | Remove or change `NODE_ENV`, or check `logs/combined.log` directly |

---

## Important Notes

- **Security:** Do not commit the `.env` file to the repository. Make sure `.env` is listed in `.gitignore`.
- **2FA:** If the account has 2FA enabled, Puppeteer will wait for manual phone confirmation for up to **120 seconds**. If not confirmed in time, the request fails with `FAILED_GET_CODE`.
- **Headless mode:** The browser runs in `headless: false` mode (visible). This is required to avoid being detected as a bot by Google.
- **Saved session:** The `UserData/` folder stores the Puppeteer browser session. If the account has logged in before, subsequent requests will be faster as they skip the email/password input step.
- **config.json:** This file is used as a temporary intermediary to pass the authorization code between processes. Its contents are overwritten on every new `POST /code` request.
- **Browser singleton:** The Puppeteer browser instance is reused across requests. A new browser is only launched if the previous instance disconnects.
