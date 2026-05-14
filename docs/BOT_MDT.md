# MDT-SOC5 Bot

Status: done.

Apps Script source:

```text
bots/mdt/apps-script/
```

This bot watches `soc5-mdt!P2:Q50` by polling on a five-minute Apps Script time trigger. When the displayed values in that range change, it sends one SeaTalk interactive message card. It does not use an hourly report schedule.

Card title:

```text
SOC5 MDT Compliance <h:mmAM/PM MMM-dd>
```

Card description:

```text
MDT-1: <soc5-mdt!P17>
MDT-2: <soc5-mdt!P18>
```

Card image capture range:

```text
soc5-mdt!F1:W49
```

Report link:

```text
https://docs.google.com/spreadsheets/d/1JNknAg_U_ja-5L4VIXWumytiozq-uomZTYJcFOeccFE/edit?gid=357651034#gid=357651034
```

Required script properties:

```text
SEATALK_APP_ID=<mdt-seatalk-app-id>
SEATALK_APP_SECRET=<mdt-seatalk-app-secret>
GOOGLE_SPREADSHEET_ID=1JNknAg_U_ja-5L4VIXWumytiozq-uomZTYJcFOeccFE
GOOGLE_GROUP_IDS_RANGE=bot_config!A2:A
SEATALK_EXTRA_GROUP_IDS=Njk3MDE2ODY2Mzc2,NDk4ODM1MTY4OTY3
GOOGLE_WATCH_RANGE=soc5-mdt!P2:Q50
GOOGLE_CAPTURE_RANGE=soc5-mdt!F1:W49
GOOGLE_MDT_1_RANGE=soc5-mdt!P17
GOOGLE_MDT_2_RANGE=soc5-mdt!P18
REPORT_SHEET_URL=https://docs.google.com/spreadsheets/d/1JNknAg_U_ja-5L4VIXWumytiozq-uomZTYJcFOeccFE/edit?gid=357651034#gid=357651034
PDF_TO_PNG_SERVICE_URL=https://<azure-fqdn>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

The app ID and app secret should stay in Apps Script properties, not in this repository.

The MDT bot also includes these two default extra SeaTalk groups:

```text
Njk3MDE2ODY2Mzc2
NDk4ODM1MTY4OTY3
```

Setup flow:

1. Create a new Apps Script project for `MDT-SOC5`.
2. Paste `bots/mdt/apps-script/Code.gs` and `appsscript.json`.
3. Set the required Script Properties.
4. Run `testPdfToPngServiceHealth`.
5. Run `initializeMdtWatchSnapshot` so the first poll does not send a report.
6. Run `checkMdtSetup`.
7. Run `sendReportNow` for a manual test.
8. Run `installPollingTrigger` to start five-minute polling.

To test only the two fixed MDT extra groups, run:

```text
sendReportToExtraGroupsNow
```
