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
| backlogs | Polls every 5 minutes | `installPollingTrigger()` -> `pollBacklogsWatchRange` | Only when `backlogs!E8` changes, after a 15-second settle delay | Not fixed; change-based |
| onqueu-unloading_alert | Every 10 minutes | `installTenMinuteTrigger()` -> `sendOnqueueUnloadingAlert` | Every scheduled ten-minute run | `10` minutes |
| enroute-alert | Polls every 5 minutes | `installPollingTrigger()` -> `pollEnrouteAlertWatchRange` | Only when `Summary Sheet (In progress)!AE6` changes to a non-zero value, after a 7-second settle delay | Not fixed; change-based |
| SOC5-KPI | Daily at 7:00 AM, 12:00 NN, 7:00 PM, and 12:00 MN | `installScheduledSendTriggers()` -> `sendKpiReport` | Every scheduled daily run | Not fixed; alternates 5-hour and 7-hour gaps |

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

### backlogs

- Source: `bots/backlogs/apps-script/Code.gs`
- Schedule installer: `installPollingTrigger()`
- Trigger target: `pollBacklogsWatchRange`
- Apps Script schedule:

```javascript
.everyMinutes(5)
```

The backlogs bot checks `backlogs!E8` every five minutes and sends only when the watched value changes after the initial snapshot has been created. A changed value waits 15 seconds before the text and image messages are built.

### onqueu-unloading_alert

- Source: `bots/onqueu-unloading-alert/apps-script/Code.gs`
- Schedule installer: `installTenMinuteTrigger()`
- Trigger target: `sendOnqueueUnloadingAlert`
- Apps Script schedule:

```javascript
.everyMinutes(10)
```

Each run sends one text message with `at_all: true`, followed by one image message rendered from `bot_server!B2:M30`, to `NTg3MzEyNjUxMjE2` only.

### enroute-alert

- Source: `bots/enroute-alert/apps-script/Code.gs`
- Schedule installer: `installPollingTrigger()`
- Trigger target: `pollEnrouteAlertWatchRange`
- Apps Script schedule:

```javascript
.everyMinutes(5)
```

The enroute-alert bot checks `Summary Sheet (In progress)!AE6` every five minutes and sends only when the watched value changes after the initial snapshot has been created. A changed value waits 7 seconds before the text and image messages are built. If the watched value is `0`, no message is sent.

### SOC5-KPI

- Source: `bots/soc5-kpi/apps-script/Code.gs`
- Schedule installer: `installScheduledSendTriggers()`
- Trigger target: `sendKpiReport`
- Apps Script schedule:

```javascript
.atHour(7).nearMinute(0).everyDays(1)
.atHour(12).nearMinute(0).everyDays(1)
.atHour(19).nearMinute(0).everyDays(1)
.atHour(0).nearMinute(0).everyDays(1)
```

The KPI bot sends at 7:00 AM, 12:00 NN, 7:00 PM, and 12:00 MN in `Asia/Manila`. Apps Script time triggers are approximate, so each run can happen a few minutes before or after the requested time.

## Manual Sends

All bots expose `sendReportNow()` for manual testing. Manual sends are not part of the scheduled frequency, but they still write to `bot_logs` and New Relic when logging is configured.
