# Apps Script

`Code.gs` is the active SeaTalk bot implementation. It reads the Google Sheet, exports the report PDF, calls the Azure converter, and sends the SeaTalk interactive card.

Use the complete setup guide in the repository root [README.md](../README.md).

Required script properties:

```text
SEATALK_APP_ID=your-seatalk-app-id
SEATALK_APP_SECRET=your-seatalk-app-secret
GOOGLE_SPREADSHEET_ID=1pLN46ZKWJIsidswMeoxhZwoacuFMR08sCaTFG6mLytc
GOOGLE_CAPTURE_RANGE=intraday!C1:AD37
GOOGLE_FMS_UPDATE_RANGE=intraday!AE2
GOOGLE_GROUP_IDS_RANGE=bot_config!A2:A
REPORT_SHEET_URL=https://docs.google.com/spreadsheets/d/1NY4LFE-TmuIVjgW8vb0-j7piQemxxQm7pkN67DJFNhI/edit?gid=1394317266#gid=1394317266
PDF_TO_PNG_SERVICE_URL=https://<azure-fqdn>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

Run `sendReportNow` for a manual test, then run `installHourlyTrigger` once to schedule hourly sending.
