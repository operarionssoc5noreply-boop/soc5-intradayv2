# enroute-alert Bot

Source:

```text
bots/enroute-alert/apps-script/
```

This bot polls `Summary Sheet (In progress)!AE6` approximately every minute. When the displayed value changes, it waits 7 seconds for the sheet values to settle, then sends a SeaTalk text message followed by one image rendered from `Summary Sheet (In progress)!C2:V62`.

If `Summary Sheet (In progress)!AE6` is `0`, the bot does not send to the SeaTalk group.

It does not send a SeaTalk interactive message card.

## Recipients

Recipients come from:

```text
bot_config!A2:A
```

## Text Message

```text
IB Expected Linehauls to Arrive within <Summary Sheet (In progress)!O1> including Late Units as of <time now, e.g. 5:00PM> Update.

**<Summary Sheet (In progress)!V3>
<Summary Sheet (In progress)!V4>
<Summary Sheet (In progress)!V5>**
```

## Image

```text
Summary Sheet (In progress)!C2:V62
```

The rendered image is sent as a normal SeaTalk image message after the text message.

## Script Properties

Required:

```text
SEATALK_APP_ID=<enroute-alert-seatalk-app-id>
SEATALK_APP_SECRET=<enroute-alert-seatalk-app-secret>
GOOGLE_SPREADSHEET_ID=<spreadsheet-id>
PDF_TO_PNG_SERVICE_URL=https://<aws-converter-domain>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=<same-token-configured-in-aws>
```

For AWS setup through the web console, follow `docs/AWS_UI_SETUP.md`. Use the App Runner URL unless you specifically choose the Lambda Function URL option.

Accepted AWS URL examples:

```text
PDF_TO_PNG_SERVICE_URL=https://<app-runner-domain>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_URL=https://<lambda-function-url>/convert/pdf-to-png
```

The bot also accepts the base AWS domain because `Code.gs` normalizes it:

```text
PDF_TO_PNG_SERVICE_URL=https://<app-runner-domain>
PDF_TO_PNG_SERVICE_URL=https://<lambda-function-url>
```

Optional defaults:

```text
BOT_NAME=enroute-alert
GOOGLE_GROUP_IDS_RANGE=bot_config!A2:A
GOOGLE_WATCH_RANGE=Summary Sheet (In progress)!AE6
GOOGLE_CAPTURE_RANGE=Summary Sheet (In progress)!C2:V62
GOOGLE_WINDOW_VALUE_RANGE=Summary Sheet (In progress)!O1
GOOGLE_DETAIL_LINE_1_RANGE=Summary Sheet (In progress)!V3
GOOGLE_DETAIL_LINE_2_RANGE=Summary Sheet (In progress)!V4
GOOGLE_DETAIL_LINE_3_RANGE=Summary Sheet (In progress)!V5
REPORT_SETTLE_DELAY_SECONDS=7
REPORT_TIMESTAMP_FORMAT=h:mma
REPORT_FIT_CAPTURE_RANGE_TO_PAGE=true
```

## Setup

1. Create a new Apps Script project for `enroute-alert`.
2. Paste `bots/enroute-alert/apps-script/Code.gs` and `appsscript.json`.
3. Add `BotLogs.gs` to the project if bot logging is needed.
4. Set the Script Properties.
5. Run `testPdfToPngServiceHealth()` once and confirm it returns `{"ok":true}`.
6. Run `sendReportNow()` once to authorize and test. It will skip sending if the watch range is `0`.
7. Run `installPollingTrigger()` once to start approximately one-minute polling.
8. Run `initializeEnrouteAlertWatchSnapshot()` if you want the current watch value saved without sending a report.
