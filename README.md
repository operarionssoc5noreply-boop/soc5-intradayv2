# SOC5 SeaTalk Intraday Bot

Lightweight Go server that reads SeaTalk group IDs from a Google Sheet, exports `intraday!C1:AD37` to PDF, converts the PDF to PNG with Poppler and ImageMagick, then sends an hourly SeaTalk group report.

## What Is Implemented

- SeaTalk app access token caching from `seatalk_docs/Get App Access Token.md`.
- SeaTalk group messages from `seatalk_docs/Send Message to Group Chat.md`: text, image, file, and interactive message card.
- Interactive card elements based on `seatalk_docs/Send an Interactive Message Card.md`.
- SeaTalk callback verification and SHA-256 signature validation from `seatalk_docs/Server API Event Callback.md`.
- `bot_added_to_group_chat` event handling from `seatalk_docs/Bot Added To Group Chat.md`.
- Group typing API from `seatalk_docs/Set Typing Status in Group Chat.md`.
- Hourly scheduler plus manual trigger endpoint.
- Group recipients from `bot_config!A2:A`.
- FMS status text from `intraday!AE2`.
- Rendered report image trimmed to content with a 1-inch white margin.
- Docker runtime with `poppler-utils` and `imagemagick`.

## Setup

1. Create `.env` from `.env.example`.
2. Place your Google service account JSON at `secrets/google-service-account.json`, or set `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Share the Google Sheet with the service account email.
4. Fill in `SEATALK_APP_ID`, `SEATALK_APP_SECRET`, and `SEATALK_SIGNING_SECRET`. The default spreadsheet is `1pLN46ZKWJIsidswMeoxhZwoacuFMR08sCaTFG6mLytc`.
5. Put SeaTalk group IDs in `bot_config!A2:A`.
6. Run with the Docker Compose plugin:

```powershell
docker compose up --build
```

If your Docker install does not include Compose, build and run the image directly:

```powershell
docker build -t soc5-seatalk-bot .
docker run --env-file .env -p 8080:8080 -v ${PWD}\secrets:/secrets:ro soc5-seatalk-bot
```

The callback URL path defaults to `/bot-callback`, and health checks are available at `/healthz`.

For Render deployment through the dashboard, see [RENDER_DEPLOY.md](./RENDER_DEPLOY.md).

## Manual Trigger

```powershell
Invoke-RestMethod -Method Post http://localhost:8080/reports/send-now
```

## Google Sheet Export Notes

The default report layout is:

```env
GOOGLE_SPREADSHEET_ID=1pLN46ZKWJIsidswMeoxhZwoacuFMR08sCaTFG6mLytc
GOOGLE_CAPTURE_RANGE=intraday!C1:AD37
GOOGLE_FMS_UPDATE_RANGE=intraday!AE2
GOOGLE_GROUP_IDS_RANGE=bot_config!A2:A
```

If `GOOGLE_SHEET_GID` is blank, the bot uses the Google Sheets metadata API to map the sheet title from `GOOGLE_CAPTURE_RANGE` to its numeric `gid`. The PDF export uses the configured capture range and renders that PDF into PNG pages with `pdftoppm`, then combines/normalizes them through ImageMagick.

## Runtime Behavior

Each run sends:

1. A SeaTalk interactive card titled like `SOC 5 IntraDay Update as of 12:14 PM May-13`.
2. The card description `FMS Update: <value from intraday!AE2>`.
3. The rendered `intraday!C1:AD37` image inside the interactive card when `REPORT_SEND_IMAGE=true` and `REPORT_INLINE_CARD_IMAGE=true`. With the default `REPORT_REQUIRE_INLINE_CARD_IMAGE=true`, the send fails instead of falling back to a separate image message if SeaTalk rejects the inline image element.
4. A `View Report Link` button pointing to the configured report spreadsheet URL.
5. An optional PDF file when `REPORT_SEND_PDF_FILE=true`.

SeaTalk image/file payloads are checked against `SEATALK_MAX_BASE64_BYTES`, defaulting to the documented 5 MB encoded limit.
