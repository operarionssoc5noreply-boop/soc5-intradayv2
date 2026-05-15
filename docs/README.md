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

  workstation/
    apps-script/
      Code.gs
      appsscript.json

  control-tower/
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
BotLogs.gs                   Shared Apps Script logger for the bot_logs tab

docs/
  README.md                   Main project guide
  AZURE_UI_SETUP.md           Azure setup guide
  RENDER_CALLBACK_SETUP.md    Optional Render callback guide
  NEW_RELIC_SETUP.md          New Relic monitoring setup
  BOT_SEATALK_FREQUENCY.md    SeaTalk bot send frequency reference
  BOT_INTRADAY.md             Intraday bot notes
  BOT_INTRADAY_APPS_SCRIPT.md Intraday Apps Script notes
  BOT_OTP.md                  OTP bot notes
  BOT_MDT.md                  MDT-SOC5 bot notes
  BOT_WORKSTATION.md          soc5-workstation bot notes
  BOT_CONTROL_TOWER.md        soc5-control-tower bot notes
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

## Shared Bot Logs

`BotLogs.gs` is a shared Apps Script helper. Add it to each bot's Apps Script project alongside that bot's `Code.gs` to write a row to the `bot_logs` sheet after every successful or failed group send.

The log sheet uses these columns:

```text
bot_name | target_group_id | group_name | sent_timestamp | interval_from_previous_sent | reason_for_delay | success | failed | status | error_message | new_relic_sent
```

`group_name` is resolved from the column immediately to the right of `GOOGLE_GROUP_IDS_RANGE` when available. Hourly bots set `BOT_EXPECTED_SEND_INTERVAL_MINUTES=60`, so delayed sends get a `reason_for_delay`; change that Script Property per bot if the schedule changes.

For dashboard monitoring, set `NEW_RELIC_LICENSE_KEY` and optional `NEW_RELIC_LOG_API_URL` in each Apps Script project's Script Properties. See [NEW_RELIC_SETUP.md](./NEW_RELIC_SETUP.md).

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

### soc5-workstation

Status: ready.

Source:

```text
bots/workstation/apps-script/
```

This bot sends every three hours daily. Each run sends one SeaTalk interactive message card with a title, a description from `ws-server!A1` and `ws-server!T1`, one image rendered from `soc5-workstation!A1:J80`, and a `View Report Link` button. Hidden, collapsed, and blank rows inside the capture range are excluded from the rendered image.

### soc5-control-tower

Status: ready.

Source:

```text
bots/control-tower/apps-script/
```

This bot sends every three hours daily. Each run sends one SeaTalk interactive message card with the title `SOC 5 OTP Update as of <time/date now>`, the description value from `Internal_kpi!E1`, one image rendered from `Internal_kpi!G1:Y39`, and a `View Report Link` button. The configured watch range is `Internal_kpi!S15:U30`.

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
