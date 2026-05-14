# soc5-bots

This repository is organized as a multi-bot workspace.

Bot-specific Apps Script code lives under `bots/`. Shared infrastructure stays at the repository root so every bot can reuse the same Azure PDF-to-PNG converter and optional callback proxy.

## Structure

```text
bots/
  intraday/
    apps-script/
      Code.gs
      appsscript.json

  otp/
    apps-script/              Created when OTP is implemented

cmd/
  pdf-to-png-converter/      Shared Azure Container Apps service
  seatalk-callback-proxy/    Optional callback proxy for SeaTalk events

internal/
  converter/                 Shared PDF-to-PNG conversion code

Dockerfile                   Azure converter image
Dockerfile.callback          Callback proxy image

docs/
  README.md                   Main project guide
  AZURE_UI_SETUP.md           Azure setup guide
  RENDER_CALLBACK_SETUP.md    Optional Render callback guide
  BOT_INTRADAY.md             Intraday bot notes
  BOT_INTRADAY_APPS_SCRIPT.md Intraday Apps Script notes
  BOT_OTP.md                  OTP bot notes
```

## Root Files To Keep

These files are still needed:

```text
Dockerfile             Builds the shared Azure PDF-to-PNG converter.
Dockerfile.callback    Builds the optional SeaTalk callback proxy.
.dockerignore          Keeps Docker build context clean.
.env.example           Local template for converter environment variables.
go.mod                 Go module file required by the shared services.
cmd/                   Go entrypoints for converter and callback proxy.
internal/              Shared Go converter package.
.github/               GitHub Actions build workflow for the converter image.
```

The local `.env` file and real secrets should not be committed. They are intentionally ignored.

## Bots

### Intraday

Status: done.

Source:

```text
bots/intraday/apps-script/
```

This bot reads the Google Sheet, exports the report range to PDF, calls the shared Azure converter, and sends the SeaTalk interactive card.

### OTP

Status: up next.

Folder:

```text
bots/otp/
```

When the OTP bot is ready, copy the Apps Script structure from `bots/intraday/apps-script/` into `bots/otp/apps-script/`, then change the script properties for the OTP SeaTalk app, spreadsheet, ranges, and group IDs.

## Shared Azure Converter

Use one Azure Container App for all bots unless you need separate billing, isolation, logs, or scaling.

Every Apps Script bot can point to the same converter:

```text
PDF_TO_PNG_SERVICE_URL=https://<azure-fqdn>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=<same-shared-token>
```

The converter only exposes:

```text
GET  /healthz
POST /convert/pdf-to-png
```

For setup, use [AZURE_UI_SETUP.md](./AZURE_UI_SETUP.md).

## Optional Callback Proxy

Use the callback proxy only if you need SeaTalk callback signature validation.

For multiple bots, the clean setup is one callback service per bot because each SeaTalk bot has its own signing secret and Apps Script web app URL.

For setup, use [RENDER_CALLBACK_SETUP.md](./RENDER_CALLBACK_SETUP.md).

## Adding A New Bot

1. Create the new SeaTalk bot/app.
2. Create the new Google Sheet or config range.
3. Create a new folder under `bots/<bot-name>/`.
4. Copy `bots/intraday/apps-script/` into the new bot folder.
5. Create a new Apps Script project and paste that bot's `Code.gs` and `appsscript.json`.
6. Set that bot's Script Properties.
7. Reuse the shared Azure converter URL and token.
8. Run `sendReportNow`, authorize, then run `installHourlyTrigger`.

Keep real credentials in Apps Script properties, Azure/Render environment variables, or local ignored files. Do not commit secrets.
