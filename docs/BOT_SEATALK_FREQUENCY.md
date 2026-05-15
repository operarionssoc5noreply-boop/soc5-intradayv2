# SeaTalk Bot Send Frequency

This page lists how often each SOC5 bot sends messages to SeaTalk groups.

Apps Script time triggers are approximate. `nearMinute(0)` asks Apps Script to run close to the top of the hour, but execution can happen a few minutes before or after depending on Google's scheduler.

| Bot | Send Frequency | Trigger Function | Sends When | Expected Interval |
| --- | --- | --- | --- | --- |
| SOC5-Intraday | Every 1 hour, near minute `:00` | `installHourlyTrigger()` -> `sendIntradayReport` | Every scheduled hourly run | `60` minutes |
| SOC5-OTP | Every 1 hour, near minute `:00` | `installHourlyTrigger()` -> `sendOtpReport` | Every scheduled hourly run | `60` minutes |
| MDT-SOC5 | Polls every 5 minutes | `installPollingTrigger()` -> `pollMdtWatchRange` | Only when `GOOGLE_WATCH_RANGE` changes | Not fixed; change-based |
| soc5-workstation | Every 3 hours | `installThreeHourlyTrigger()` -> `sendWorkstationReport` | Every scheduled three-hour run | `180` minutes |
| soc5-control-tower | Every 3 hours | `installThreeHourlyTrigger()` -> `sendControlTowerReport` | Every scheduled three-hour run | `180` minutes |

## Details

### SOC5-Intraday

- Source: `bots/intraday/apps-script/Code.gs`
- Schedule installer: `installHourlyTrigger()`
- Trigger target: `sendIntradayReport`
- Apps Script schedule:

```javascript
.everyHours(1)
.nearMinute(0)
```

### SOC5-OTP

- Source: `bots/otp/Code.gs`
- Schedule installer: `installHourlyTrigger()`
- Trigger target: `sendOtpReport`
- Apps Script schedule:

```javascript
.everyHours(1)
.nearMinute(0)
```

Each OTP run sends both configured OTP cards to each configured SeaTalk group.

### MDT-SOC5

- Source: `bots/mdt/apps-script/Code.gs`
- Schedule installer: `installPollingTrigger()`
- Trigger target: `pollMdtWatchRange`
- Apps Script schedule:

```javascript
.everyMinutes(5)
```

MDT does not send every five minutes by default. It checks `GOOGLE_WATCH_RANGE` every five minutes and sends only when the watched range changes after the initial snapshot has been created.

### soc5-workstation

- Source: `bots/workstation/apps-script/Code.gs`
- Schedule installer: `installThreeHourlyTrigger()`
- Trigger target: `sendWorkstationReport`
- Apps Script schedule:

```javascript
.everyHours(3)
```

### soc5-control-tower

- Source: `bots/control-tower/apps-script/Code.gs`
- Schedule installer: `installThreeHourlyTrigger()`
- Trigger target: `sendControlTowerReport`
- Apps Script schedule:

```javascript
.everyHours(3)
```

## Manual Sends

All bots expose `sendReportNow()` for manual testing. Manual sends are not part of the scheduled frequency, but they still write to `bot_logs` and New Relic when logging is configured.
