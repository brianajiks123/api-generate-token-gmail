# API Generate Google OAuth2 Token

A REST API built with **Express.js** that automates the Google login process using **Puppeteer** to obtain an OAuth2 Authorization Code, then exchanges it for a **Refresh Token** via the Google OAuth2 API.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Usage](#api-usage)
- [Project Structure](#project-structure)
- [Logging](#logging)
- [Troubleshooting](#troubleshooting)
- [Important Notes](#important-notes)

---

## How It Works

```
Client → POST /code → [Serial Queue] → Puppeteer logs into Google → GET /redirect (saves code) → Exchange code for token → Return token
```

1. The client sends `POST /code` with Google credentials and OAuth client credentials
2. The server queues the request — only one process runs at a time
3. Puppeteer opens a Chrome browser (singleton, reused across requests) and automatically logs into Google with stealth mode enabled
4. After login, Google redirects to `/redirect` with an authorization code
5. The server exchanges the authorization code for a token via the Google OAuth2 API (`https://oauth2.googleapis.com/token`)
6. The response contains `access_token`, `refresh_token`, and other token information

### Google Page Handling

Puppeteer automatically handles various Google page states:

| Condition | Handling |
|---|---|
| Account Chooser | Selects the matching account, or clicks "Use another account" |
| Unverified App Warning | Automatically clicks Continue |
| Signing Back In | Automatically clicks Continue |
| Consent Summary | Automatically clicks Continue |
| Signin Rejected | Clears cookies & session, then retries |
| 2-Step Verification (QR Code) | Waits for user to scan QR code on their phone (no timeout) |
| 2-Step Verification (Tap Yes) | Automatically clicks the "Tap Yes" option (recovery email device), then waits for confirmation (120-second timeout) |
| Active session (UserData exists) | Skips email/password input, fetches code directly |

---

## Prerequisites

- **Node.js** v18 or later
- A **Google Cloud Project** with a configured OAuth 2.0 Client ID
- The Google account used should ideally **not have 2FA enabled** (if 2FA is active, Puppeteer will automatically handle it based on the method: QR code will wait for user to scan, or "Tap Yes" will auto-select and wait for confirmation on phone/recovery device within 120 seconds)
- The Google account must be registered as a **Test User** in Google Cloud Console (if the app is still in *Testing* status)

> See the full Google Cloud Console setup guide at [`docs/GOOGLE_CLOUD_SETUP.md`](docs/GOOGLE_CLOUD_SETUP.md).

---

## Installation

```bash
npm install
```

---

## Configuration

Create a `.env` file in the project root:

```env
urlRedirect=http://localhost:4069/redirect
scopeApp=openid%20profile%20email%20https://mail.google.com%20https://www.googleapis.com/auth/drive
tokenUri=https://oauth2.googleapis.com/token
LOG_LEVEL=debug
```

| Variable      | Required | Description                                                                    |
|---------------|----------|--------------------------------------------------------------------------------|
| `urlRedirect` | ✅       | Redirect URI registered in Google Cloud Console                                |
| `scopeApp`    | ✅       | Requested OAuth2 scopes (URL-encoded)                                          |
| `tokenUri`    | ✅       | Google OAuth2 token endpoint                                                   |
| `LOG_LEVEL`   | ❌       | Winston log level: `error`, `warn`, `info`, `debug` (default: `debug`)         |

> **Note:** `clientId` and `clientSecret` are **not** stored in `.env` — they are sent per-request via the `POST /code` request body. This allows a single server to serve multiple different OAuth clients.

---

## Running the Server

```bash
node server.js
```

or

```bash
npm start
```

The server runs at `http://localhost:4069`.

---

## API Usage

### `POST /code`

The main endpoint. Opens a browser, logs into Google, and returns an OAuth2 token.

**Request**

```
POST http://localhost:4069/code
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

| Field          | Type   | Required | Description                  |
|----------------|--------|----------|------------------------------|
| `email`        | string | ✅       | Google account email         |
| `password`     | string | ✅       | Google account password      |
| `clientId`     | string | ✅       | OAuth2 Client ID             |
| `clientSecret` | string | ✅       | OAuth2 Client Secret         |

> ⚠️ This process opens Chrome automatically. Do not interact with the browser manually while it is running. Estimated time: **30–60 seconds** (faster if a session is already saved in `UserData/`).

> ℹ️ Requests are processed **serially** — if another request is already running, the new one is queued and processed after the previous one completes.

**Success Response — `200 OK`**

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

**Error Responses**

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "status": "fail", "message": "Gagal, masukkan data dengan benar." }` | One or more required fields are missing |
| `400` | `{ "status": "fail", "message": "Gagal saat verifikasi google dan mengambil code." }` | Wrong email/password, bot detected by Google, or 2FA timeout |
| `500` | `{ "status": "error", "message": "Terjadi kegagalan pada server." }` | Unexpected server error |
| `500` | `{ "status": "error", "message": "invalid_client" }` | Invalid `clientId` or `clientSecret` (message from Google) |

**cURL Example**

```bash
curl -X POST http://localhost:4069/code \
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

The OAuth2 callback endpoint. Called automatically by Google after the authorization flow — **no need to call this manually** in normal usage.

**Request**

```
GET http://localhost:4069/redirect?code=<authorization_code>
```

**Response — `200 OK`**

```json
{
  "code": "4/0Aci98E8_pX1Afr1UiWwk0VwW1eRG7-xxxx"
}
```

The server saves the `code` to `config.json` as a temporary intermediary, which is then read by the Puppeteer service to exchange for a token.

---

## Project Structure

```
.
├── server.js                   # Entry point — Express app, route definitions, request logger middleware
├── puppeteerService.js         # Core logic — Puppeteer browser singleton, request queue, Google login, token exchange
├── src/
│   └── utils/
│       └── logger.js           # Winston-based logger (WIB timezone, file & console output)
├── logs/
│   ├── combined.log            # All logs (all levels)
│   └── error.log               # Error-level logs only
├── docs/
│   ├── GOOGLE_CLOUD_SETUP.md   # Google Cloud Console setup guide
│   └── TESTING.md              # Full testing guide for all endpoints and scenarios
├── UserData/                   # Puppeteer browser profile (sessions & cookies stored here)
├── config.json                 # Temporary storage for the authorization code between processes
├── .env                        # Environment configuration (do not commit)
└── package.json
```

---

## Logging

Logs use **Winston** with timestamps in **WIB (UTC+7)** timezone.

| File | Contents |
|---|---|
| `logs/combined.log` | All logs (all levels) |
| `logs/error.log` | Error-level logs only |
| Console | All logs with color (non-production only) |

Log format:
```
YYYY-MM-DD HH:MM:SS [level]: message
```

The log level can be controlled via the `LOG_LEVEL` environment variable in `.env` (default: `debug`).

In production, set `NODE_ENV=production` to disable console output.

---

## Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| Browser does not open | Puppeteer not installed correctly | Run `npm install` again |
| Login fails / timeout | Google detects bot or CAPTCHA appears | Retry; use an account that has previously logged in so a session is saved in `UserData/` |
| `FAILED_GET_CODE` | Wrong email/password, or 2FA timeout (120s for Tap Yes) | Verify credentials; if 2FA is active, Puppeteer will handle it automatically (QR code waits indefinitely, Tap Yes waits 120 seconds) |
| `500 invalid_client` | Wrong `clientId` or `clientSecret` | Verify credentials in Google Cloud Console |
| `redirect_uri_mismatch` | Redirect URI not registered | Add `http://localhost:4069/redirect` to Authorized redirect URIs |
| `403 access_denied` | Email not registered as a Test User | Add the email in OAuth Consent Screen → Test Users |
| `This app isn't verified` | App is still in Testing status | Click **Advanced** → **Go to app (unsafe)**, or register the email as a Test User |
| Server not accessible | Port 4069 already in use | Stop the other process on port 4069, or change the port in `server.js` |
| Request takes too long | Previous request still processing (queue) | Wait for the previous request to finish; requests are processed serially |

---

## Important Notes

- **Security:** Do not commit the `.env` file to the repository. Make sure `.env` is listed in `.gitignore`.
- **2FA:** If the account has 2FA enabled, Puppeteer will automatically handle it:
  - **QR Code method:** Waits indefinitely for the user to scan the QR code on their phone. Once scanned and verified, the page redirects automatically.
  - **Tap Yes method:** Automatically clicks the "Tap Yes on the device your recovery email is signed into" option, then waits for the user to confirm on their phone/recovery device for up to **120 seconds**. If not confirmed in time, the request fails with `FAILED_GET_CODE`.
- **Headless mode:** The browser runs in `headless: false` mode (visible). This is required to avoid being detected as a bot by Google.
- **Saved session:** The `UserData/` folder stores the Puppeteer browser session. If the account has logged in before, subsequent requests will be faster as they skip the email/password input step.
- **Request queue:** The server processes one `POST /code` request at a time using a serial queue. Subsequent requests wait until the current one finishes.
- **Browser singleton:** The Puppeteer browser instance is reused across requests for efficiency. A new browser is only launched if the previous instance disconnects.
- **config.json:** This file is used as a temporary intermediary to pass the authorization code between the Puppeteer process and the server. Its contents are overwritten on every new `POST /code` request.
