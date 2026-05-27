# backlogs Bot

Source:

```text
bots/backlogs/apps-script/
```

This bot polls `backlogs!E8` every five minutes. When the displayed value changes, it waits 15 seconds for the sheet values to settle, then sends SeaTalk text and image messages by group route.

Default `bot_config!A2:A` groups receive text, image 1 rendered from `backlogs!B2:Q62`, and image 2 rendered from `backlogs-iis!B2:J43`.

It does not send a SeaTalk interactive message card.

## Recipient Routes

Text plus image 1 plus image 2:

```text
bot_config!A2:A
Njk3MDE2ODY2Mzc2
NDk4ODM1MTY4OTY3
```

Text plus image 1:

```text
NTQ1OTU4MzEzMzM0
```

SOL IIS text plus image 2:

```text
OTY2NjY4OTMzNzY4
```

## Text Message

```text
**OB Pending for Dispatch as of <time/date now>**
---------------------------------------
**Backlogs:** <backlogs!E8>
**Contributor:**
1. <backlogs!S6> - <backlogs!U6>
2. <backlogs!S7> - <backlogs!U7>
3. <backlogs!S8> - <backlogs!U8>
---------------------------------------
```

SOL IIS route text:

```text
**SOL IIS Pending for Dispatch as of <time/date now>**
------------------------------------
**Top Hubs:**
1. <backlogs-iis!L5> - <backlogs-iis!P5>
2. <backlogs-iis!L6> - <backlogs-iis!P6>
3. <backlogs-iis!L7> - <backlogs-iis!P7>
```

## Script Properties

Required:

```text
SEATALK_APP_ID=<backlogs-seatalk-app-id>
SEATALK_APP_SECRET=<backlogs-seatalk-app-secret>
GOOGLE_SPREADSHEET_ID=<spreadsheet-id>
PDF_TO_PNG_SERVICE_URL=https://<azure-fqdn>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=<shared-token-if-configured>
```

Optional defaults:

```text
BOT_NAME=backlogs
GOOGLE_GROUP_IDS_RANGE=bot_config!A2:A
GOOGLE_WATCH_RANGE=backlogs!E8
GOOGLE_CAPTURE_RANGE_1=backlogs!B2:Q62
GOOGLE_CAPTURE_RANGE_2=backlogs-iis!B2:J43
SEATALK_BOTH_IMAGES_GROUP_IDS=Njk3MDE2ODY2Mzc2,NDk4ODM1MTY4OTY3
SEATALK_IMAGE1_ONLY_GROUP_IDS=NTQ1OTU4MzEzMzM0
SEATALK_IIS_ONLY_GROUP_IDS=OTY2NjY4OTMzNzY4
REPORT_FIT_CAPTURE_RANGE_1_TO_PAGE=true
REPORT_FIT_CAPTURE_RANGE_2_TO_PAGE=true
REPORT_CLEAN_CAPTURE_RANGE_1=false
REPORT_EXCLUDE_BLANK_CAPTURE_ROWS_1=true
REPORT_SETTLE_DELAY_SECONDS=15
SEATALK_TEST_GROUP_ID=NjkwNjYwNzkyMjI3
```

## Setup

1. Create a new Apps Script project for `backlogs`.
2. Paste `bots/backlogs/apps-script/Code.gs` and `appsscript.json`.
3. Add `BotLogs.gs` to the project if bot logging is needed.
4. Set the Script Properties.
5. Run `sendReportNow()` once to authorize and test.
6. Run `installPollingTrigger()` once to start five-minute polling.
7. Run `initializeBacklogsWatchSnapshot()` if you want the current `backlogs!E8` value saved without sending a report.

## Test Send

Run this helper to send the default text plus both images to `SEATALK_TEST_GROUP_ID`:

```javascript
sendTestReportToBacklogsGroupNow()
```

Both images export from the original sheets with fit-to-page enabled by default. This avoids PDF page breaks becoming large white gaps in the converted PNG while preserving merged title and table formatting.
