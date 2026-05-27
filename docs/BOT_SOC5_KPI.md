# SOC5-KPI Bot

Source:

```text
bots/soc5-kpi/apps-script/
```

This bot sends the KPI report to SeaTalk groups on a fixed daily schedule in `Asia/Manila`:

```text
7:00 AM
12:00 NN
7:00 PM
12:00 MN
```

Apps Script time triggers are approximate, so sends can happen a few minutes before or after the requested time.

## Defaults

```text
BOT_NAME=SOC5-KPI
GOOGLE_GROUP_IDS_RANGE=bot_config!A2:A
GOOGLE_CAPTURE_RANGE=Internal_kpi!G1:Y39
GOOGLE_KPI_LAST_RUN_RANGE=Internal_kpi!E1
REPORT_TITLE_PREFIX=SOC5 KPI Update as of
BOT_EXPECTED_SEND_INTERVAL_MINUTES=0
```

The bot renders `GOOGLE_CAPTURE_RANGE` as an image, sends it inside a SeaTalk interactive message card, and adds a `View Report Link` button when `REPORT_SHEET_URL` is configured.

## Setup

1. Create a new Apps Script project.
2. Paste `bots/soc5-kpi/apps-script/Code.gs` and `appsscript.json`.
3. Add the shared `BotLogs.gs` file if you want send logging.
4. Set `SEATALK_APP_ID`, `SEATALK_APP_SECRET`, `PDF_TO_PNG_SERVICE_URL`, and `PDF_TO_PNG_SERVICE_TOKEN` in Script Properties.
5. Confirm target groups are listed in `bot_config!A2:A`.
6. Run `sendReportNow` for a manual test.
7. Run `installScheduledSendTriggers` to install the four daily scheduled sends.
