# Intraday Bot

Status: done.

Apps Script source:

```text
bots/intraday/apps-script/
```

This bot sends the SOC5 intraday SeaTalk report. It reads the configured Google Sheet, exports the report range to PDF, calls the shared Azure converter, and sends the PNG inside a SeaTalk interactive card.

Use [README.md](./README.md) for the shared architecture and Azure notes.
