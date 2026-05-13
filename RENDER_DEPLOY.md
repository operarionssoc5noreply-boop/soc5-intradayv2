# Render Deployment Guide

This project deploys to Render as a Docker-backed **Web Service** using the Render Dashboard. Do not add `render.yaml`; all service settings below are configured in the UI.

## Prerequisites

- A Render account.
- This project pushed to a GitHub, GitLab, or Bitbucket repository.
- SeaTalk app credentials.
- A Google service account JSON file with access to spreadsheet `1pLN46ZKWJIsidswMeoxhZwoacuFMR08sCaTFG6mLytc`.
- SeaTalk group IDs listed in `bot_config!A2:A`.

## 1. Create The Web Service

1. Open the Render Dashboard.
2. Click **New +**.
3. Select **Web Service**.
4. Connect the repository that contains this project.
5. Set **Language** to **Docker**.
6. Set **Name** to something like `soc5-intraday-seatalk-bot`.
7. Select the nearest available **Region**.
8. Choose an instance type. Avoid a free/sleeping instance for production because the bot has an in-process hourly scheduler.
9. Set **Health Check Path** to:

```text
/healthz
```

Do not set a build command or start command. Render will build and run the existing [Dockerfile](./Dockerfile).

## 2. Environment Variables

In the service creation screen, open **Advanced** and add these environment variables.

Required secrets:

```env
SEATALK_APP_ID=your-seatalk-app-id
SEATALK_APP_SECRET=your-seatalk-app-secret
SEATALK_SIGNING_SECRET=your-seatalk-signing-secret
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Required runtime settings:

```env
PORT=10000
TIME_ZONE=Asia/Manila
WORK_DIR=/tmp/seatalk-bot
HTTP_TIMEOUT=30s
SEATALK_API_BASE=https://openapi.seatalk.io
SEATALK_CALLBACK_PATH=/bot-callback
SEATALK_WELCOME_ON_ADD=false
SEATALK_MAX_BASE64_BYTES=5242880
GOOGLE_SPREADSHEET_ID=1pLN46ZKWJIsidswMeoxhZwoacuFMR08sCaTFG6mLytc
GOOGLE_CAPTURE_RANGE=intraday!C1:AD37
GOOGLE_FMS_UPDATE_RANGE=intraday!AE2
GOOGLE_GROUP_IDS_RANGE=bot_config!A2:A
GOOGLE_EXPORT_LANDSCAPE=true
REPORT_TITLE_PREFIX=SOC 5 IntraDay Update as of
REPORT_INTERVAL=1h
REPORT_START_IMMEDIATELY=true
REPORT_SEND_IMAGE=true
REPORT_INLINE_CARD_IMAGE=true
REPORT_REQUIRE_INLINE_CARD_IMAGE=true
REPORT_SEND_PDF_FILE=false
REPORT_IMAGE_DPI=160
REPORT_IMAGE_MAX_WIDTH=1800
REPORT_IMAGE_BORDER_PIXELS=5
```

Optional fallback:

```env
SEATALK_GROUP_ID=optional-fallback-group-id
```

The app primarily reads target group IDs from `bot_config!A2:A`. `SEATALK_GROUP_ID` is only appended as a fallback if provided.

## 3. Add Google Credentials

Use `GOOGLE_SERVICE_ACCOUNT_JSON` instead of a file path on Render.

1. Open your service account JSON locally.
2. Copy the full JSON as one value.
3. Paste it into the Render environment variable named `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Do not add `GOOGLE_SERVICE_ACCOUNT_FILE` on Render.
5. Share the spreadsheet with the service account email from the JSON file.

## 4. Deploy

1. Click **Create Web Service**.
2. Wait for the Docker build to finish.
3. Open the service **Logs** tab and confirm the app prints:

```text
seatalk bot server listening
```

The Docker image installs `poppler-utils` and `imagemagick`, so PDF-to-PNG conversion is available inside the Render service.

## 5. Configure SeaTalk Callback URL

After the service is live, Render shows a public URL similar to:

```text
https://soc5-intraday-seatalk-bot.onrender.com
```

In the SeaTalk developer portal, set the callback URL to:

```text
https://soc5-intraday-seatalk-bot.onrender.com/bot-callback
```

Replace the hostname with your actual Render URL.

## 6. Verify

Health check:

```powershell
Invoke-RestMethod https://soc5-intraday-seatalk-bot.onrender.com/healthz
```

Manual report trigger:

```powershell
Invoke-RestMethod -Method Post https://soc5-intraday-seatalk-bot.onrender.com/reports/send-now
```

Watch logs in the Render Dashboard under **Logs**.

## Notes

- Do not commit `.env`, Google service account JSON, or SeaTalk secrets.
- Do not create `render.yaml`; this project is configured through the Render UI.
- The generated PDF/PNG files are written under `/tmp/seatalk-bot`; no persistent disk is required.
- Keep at least one service instance running. If the service sleeps or scales to zero, the hourly scheduler will not run while it is asleep.
- Render’s default web service port is `10000`; keep `PORT=10000` in the Render environment variables.

## References

- Render Web Services: https://render.com/docs/web-services/
- Docker on Render: https://render.com/docs/docker
- Render Deploys: https://render.com/docs/deploys
- Render Environment Variables: https://render.com/docs/environment-variables

