# onqueu-unloading_alert Bot

Source:

```text
bots/onqueu-unloading-alert/apps-script/
```

This bot sends every 10 minutes. Each run sends a SeaTalk text message with `at_all: true`, followed by one image rendered from `bot_server!B2:M30`.

It does not send a SeaTalk interactive message card.

## Recipient

```text
NTg3MzEyNjUxMjE2
```

## Text Message

The text message is sent with `at_all: true`:

```text

**On-Queue: <bot_server!A16>**
** Unloading: <bot_server!A26>**
```

## Image

```text
bot_server!B2:M30
```

## Script Properties

Required:

```text
SEATALK_APP_ID=<onqueu-unloading-alert-seatalk-app-id>
SEATALK_APP_SECRET=<onqueu-unloading-alert-seatalk-app-secret>
PDF_TO_PNG_SERVICE_URL=https://<azure-fqdn>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=<shared-token-if-configured>
```

Optional defaults:

```text
BOT_NAME=onqueu-unloading_alert
SEATALK_GROUP_ID=NTg3MzEyNjUxMjE2
GOOGLE_SPREADSHEET_ID=1APnTQXUQvWpTwmOLIC9U17kwjQcWX0BPYZvlfUPOJrU
GOOGLE_CAPTURE_RANGE=bot_server!B2:M30
GOOGLE_ON_QUEUE_RANGE=bot_server!A16
GOOGLE_UNLOADING_RANGE=bot_server!A26
REPORT_FIT_CAPTURE_RANGE_TO_PAGE=true
BOT_EXPECTED_SEND_INTERVAL_MINUTES=10
```

## Setup

1. Create a new Apps Script project for `onqueu-unloading_alert`.
2. Paste `bots/onqueu-unloading-alert/apps-script/Code.gs` and `appsscript.json`.
3. Add `BotLogs.gs` to the project if bot logging is needed.
4. Set the Script Properties.
5. Run `sendReportNow()` once to authorize and test.
6. Run `installTenMinuteTrigger()` once to start ten-minute scheduled sends.
