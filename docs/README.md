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
    Code.gs

  mdt/
    apps-script/
      Code.gs
      appsscript.json

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
  BOT_MDT.md                  MDT-SOC5 bot notes
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

## SeaTalk Apps

Each Apps Script project reads its SeaTalk identity from Script Properties:

```text
SEATALK_APP_ID=<seatalk-app-id>
SEATALK_APP_SECRET=<seatalk-app-secret>
```

Intraday and OTP can share the same SeaTalk app identity when they should send as the same bot. MDT-SOC5 can use its own SeaTalk app identity so it appears as `MDT-SOC5`. Keep separate spreadsheet IDs, report ranges, group ID ranges, report titles, and schedules so each workflow stays independent.

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

The OTP workflow uses the same SeaTalk app credentials as Intraday, but should have its own spreadsheet, ranges, group IDs, report title, and trigger schedule.

### MDT-SOC5

Status: done.

Source:

```text
bots/mdt/apps-script/
```

This bot watches `soc5-mdt!P2:Q50` by five-minute polling. When the watch range changes, it sends one SeaTalk interactive card with the `SOC5 MDT Compliance` title, `MDT-1`/`MDT-2` description values, one image rendered from `soc5-mdt!F1:W49`, and the report link. It does not use an hourly schedule.

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

SeaTalk normally has one callback URL per app. Use one callback proxy per shared app identity, or add routing logic if multiple bot workflows need callbacks behind the same proxy.

For setup, use [RENDER_CALLBACK_SETUP.md](./RENDER_CALLBACK_SETUP.md).

## Adding A New Bot

1. Create the new Google Sheet or config range.
2. Create a new folder under `bots/<bot-name>/`.
3. Copy or adapt an existing Apps Script workflow.
4. Create a new Apps Script project and paste that bot's `Code.gs` and `appsscript.json` if it has one.
5. Set that bot's Script Properties.
6. Set that bot's `SEATALK_APP_ID` and `SEATALK_APP_SECRET`.
7. Reuse the shared Azure converter URL and token.
8. Run `sendReportNow`, authorize, then install that bot's trigger.

Keep real credentials in Apps Script properties, Azure/Render environment variables, or local ignored files. Do not commit secrets.
