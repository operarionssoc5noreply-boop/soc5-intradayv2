# OTP Bot

Status: up next.

This folder contains the OTP workflow.

Current source:

```text
bots/otp/Code.gs
```

Use the same shared `SEATALK_APP_ID` and `SEATALK_APP_SECRET` as Intraday. Replace the spreadsheet ID, report ranges, group ID range, report title, and schedule values in the OTP Apps Script project properties.

The OTP workflow sends two image cards per run:

```text
Card 1 range: GOOGLE_CAPTURE_RANGE
Card 2 range: GOOGLE_CAPTURE_RANGE2=otp2_hourly!A1:J24
Card 2 title: OTP-2 Hourly Update as of <same timestamp as card 1>
Card 2 description: same description text as card 1
```

Schedule:

```text
Hourly, near minute :02
```

Apps Script time triggers are approximate, so `nearMinute(2)` asks Apps Script to run close to `:02`, not exactly on the second.

Put OTP documentation in `docs/BOT_OTP.md`, not inside the bot folder.
