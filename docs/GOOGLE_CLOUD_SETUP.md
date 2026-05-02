# Google Cloud Console Setup

A complete guide to setting up Google Cloud Console from scratch so the **api-generate-token-gmail** project can run correctly.

---

## Table of Contents

1. [Create a New Project](#1-create-a-new-project)
2. [Enable Gmail API and Google Drive API](#2-enable-gmail-api-and-google-drive-api)
3. [Configure the OAuth Consent Screen](#3-configure-the-oauth-consent-screen)
4. [Create an OAuth 2.0 Client ID](#4-create-an-oauth-20-client-id)
5. [Add a Redirect URI](#5-add-a-redirect-uri)
6. [Add Test Users](#6-add-test-users)
7. [Configure the .env File](#7-configure-the-env-file)
8. [Verify the Configuration](#8-verify-the-configuration)

---

## 1. Create a New Project

1. Open [https://console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your Google account
3. At the top of the page, click the project dropdown (next to the **Google Cloud** logo)
4. Click **New Project**
5. Fill in the form:
   - **Project name**: `api-generate-token-gmail` (or any name you prefer)
   - **Location**: leave as default (*No organization*)
6. Click **Create**
7. Wait a few seconds for the project to be created
8. Make sure the new project is selected in the top dropdown

---

## 2. Enable Gmail API and Google Drive API

These APIs must be enabled so the OAuth token can access Gmail and Google Drive as defined by the scopes in `.env`.

### Enable Gmail API

1. Open [https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)
2. Search for `Gmail API`
3. Click the **Gmail API** result
4. Click **Enable**

### Enable Google Drive API

1. Go back to [https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)
2. Search for `Google Drive API`
3. Click the **Google Drive API** result
4. Click **Enable**

> **Note:** If the scopes in `.env` are changed (e.g., adding or removing scopes), make sure the corresponding APIs are also enabled here.

---

## 3. Configure the OAuth Consent Screen

The OAuth Consent Screen is the permission page shown to users during login. It must be configured before creating a Client ID.

1. Open [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
2. Select **External** as the User Type
   > Choose External so any Gmail account can be used (not just accounts within an organization)
3. Click **Create**
4. Fill in the **App information** form:
   - **App name**: `api-generate-token-gmail`
   - **User support email**: select your email from the dropdown
   - **App logo**: leave blank (optional)
5. Scroll down to **Developer contact information**:
   - **Email addresses**: enter your email
6. Click **Save and Continue**

### Scopes Page

Add the scopes that match the `scopeApp` value in your `.env` file:

1. Click **Add or Remove Scopes**
2. Find and check each of the following scopes:
   - `openid`
   - `profile`
   - `email`
   - `https://mail.google.com/` *(Gmail — full access)*
   - `https://www.googleapis.com/auth/drive` *(Google Drive — full access)*
3. Click **Update**
4. Click **Save and Continue**

> **Important:** The scopes registered here must match the `scopeApp` value in `.env`. A mismatch will cause Google to return `access_denied` or `invalid_scope`.

### Test Users Page

> Because the app is still in **Testing** status, only emails registered here can log in.

1. Click **Add Users**
2. Enter the Gmail address that will be used to generate tokens
3. Click **Add**
4. Click **Save and Continue**

### Summary Page

1. Review the configuration
2. Click **Back to Dashboard**

---

## 4. Create an OAuth 2.0 Client ID

1. Open [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ Create Credentials** at the top
3. Select **OAuth client ID**
4. Fill in the form:
   - **Application type**: select **Web application**
   - **Name**: `api-generate-token-gmail`
5. Continue to the next step to add a Redirect URI

---

## 5. Add a Redirect URI

Still on the OAuth Client ID creation page:

1. Scroll to **Authorized redirect URIs**
2. Click **+ Add URI**
3. Enter the following URI (must exactly match the `urlRedirect` value in `.env`):
   ```
   http://localhost:4069/redirect
   ```
4. Click **Create**

After success, Google will display a popup containing:
- **Client ID**
- **Client Secret**

> ⚠️ **Save both values** — they will be used as the `clientId` and `clientSecret` parameters when calling `POST /code`.

Click **Download JSON** to save the credentials as a backup, then click **OK**.

> **Note:** Unlike some other projects, `clientId` and `clientSecret` are **not** stored in `.env` in this project. They are sent per-request via the `POST /code` request body, allowing a single server to serve multiple different OAuth clients.

---

## 6. Add Test Users

If not done in step 3, add test users now:

1. Open [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
2. Click the **Test users** tab
3. Click **+ Add Users**
4. Enter the Gmail address that will be used to generate tokens
5. Click **Save**

> While the app is in **Testing** status, a maximum of **100 test users** can be added. Only registered emails can complete the OAuth flow.

---

## 7. Configure the .env File

Open the `.env` file in the project root. The values to configure:

```env
urlRedirect=http://localhost:4069/redirect
scopeApp=openid%20profile%20email%20https://mail.google.com%20https://www.googleapis.com/auth/drive
tokenUri=https://oauth2.googleapis.com/token
LOG_LEVEL=debug
```

| Variable      | Example / Default Value                                                                                   | Notes |
|---------------|-----------------------------------------------------------------------------------------------------------|-------|
| `urlRedirect` | `http://localhost:4069/redirect`                                                                          | Must exactly match the Authorized redirect URI registered in step 5 |
| `scopeApp`    | `openid%20profile%20email%20https://mail.google.com%20https://www.googleapis.com/auth/drive`              | Scopes in URL-encoded format. Must match the scopes registered in the OAuth Consent Screen |
| `tokenUri`    | `https://oauth2.googleapis.com/token`                                                                     | Google OAuth2 token endpoint — no need to change |
| `LOG_LEVEL`   | `debug`                                                                                                   | Log level: `error`, `warn`, `info`, `debug` |

> **Note:** `clientId` and `clientSecret` are not stored in `.env`. They are sent as body parameters when calling `POST /code`.

**Client ID format example:**
```
463634754737-xxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

**Client Secret format example:**
```
GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 8. Verify the Configuration

Before running the project, make sure all of the following are in place:

- [ ] Project created in Google Cloud Console
- [ ] Gmail API enabled
- [ ] Google Drive API enabled
- [ ] OAuth Consent Screen configured with status **Testing**
- [ ] All scopes added: `openid`, `profile`, `email`, `https://mail.google.com/`, `https://www.googleapis.com/auth/drive`
- [ ] Redirect URI `http://localhost:4069/redirect` registered in Authorized redirect URIs
- [ ] The email to be used is registered as a Test User
- [ ] `.env` file is correctly filled in (`urlRedirect`, `scopeApp`, `tokenUri`)
- [ ] `clientId` and `clientSecret` are noted for use as request parameters

### Start the Server

```bash
node server.js
```

### Test via API

Send a POST request to `http://localhost:4069/code`:

```bash
curl -X POST http://localhost:4069/code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "password": "your-password",
    "clientId": "your-client-id.apps.googleusercontent.com",
    "clientSecret": "GOCSPX-your-client-secret"
  }'
```

---

## Troubleshooting

### "Couldn't sign you in" / `/signin/rejected`

Google rejected the login because it detected automation. The server will automatically attempt to clear the session and retry. If it still fails, try again after a moment or use an account that has previously logged in on this browser (session saved in `UserData/`).

### "Access blocked: app's request is invalid" / `redirect_uri_mismatch`

The redirect URI does not match. Make sure the `urlRedirect` value in `.env` exactly matches the URI registered in **Authorized redirect URIs** on the OAuth Client ID (including the `http://` protocol, port `4069`, and `/redirect` path).

### "Access blocked: app's request is invalid" / `invalid_scope`

The requested scopes do not match what was registered in the OAuth Consent Screen. Make sure all scopes in `scopeApp` (`.env`) have been added in step 3.

### "This app isn't verified"

This is normal for apps still in **Testing** status. Click **Advanced** → **Go to app (unsafe)** to continue. This only appears if the logged-in email is not registered as a Test User — add the email in OAuth Consent Screen → Test Users.

### "403: access_denied"

The email being used is not registered as a Test User. Add it in OAuth Consent Screen → Test Users, then wait 1–2 minutes before trying again.

### "invalid_client"

The `clientId` or `clientSecret` sent in the request body is invalid. Re-verify both values in Google Cloud Console → APIs & Services → Credentials.

### Changes not taking effect immediately

After saving changes in Google Cloud Console (redirect URIs, test users, scopes, etc.), wait **1–2 minutes** before retrying as Google requires time to propagate changes.
