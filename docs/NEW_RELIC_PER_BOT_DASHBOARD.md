# New Relic Bot Dashboard

Use this layout to create one New Relic dashboard for all SOC5 bot logs and monitoring. Do not create separate dashboards or pages per bot. All widgets stay on the same dashboard and separate bots with `FACET bot_name`.

## Bots

Use these exact `bot_name` values in dashboard filters:

| Bot | New Relic `bot_name` | Expected successful sends |
| --- | --- | --- |
| Intraday | `SOC5-Intraday` | Every 60 minutes |
| OTP | `SOC5-OTP` | Every 60 minutes |
| MDT | `MDT-SOC5` | Change-based after 5-minute polling |
| Workstation | `soc5-workstation` | Every 180 minutes |
| Control Tower | `soc5-control-tower` | Every 180 minutes |
| Backlogs | `backlogs` | Change-based after 5-minute polling |
| Enroute Alert | `enroute-alert` | Change-based after 5-minute polling |
| KPI | `SOC5-KPI` | Daily at 7AM, 12NN, 7PM, and 12MN |

## Dashboard

Create a dashboard named `SOC5 Bot Monitoring`.

Add the widgets below to this single dashboard.

### Latest Status Per Bot

```sql
FROM Log
SELECT latest(status), latest(group_name), latest(error_message), latest(sent_timestamp)
WHERE service = 'soc5-bots'
FACET bot_name
SINCE 24 hours ago
```

### Latest Group Status Per Bot

```sql
FROM Log
SELECT latest(status), latest(sent_timestamp), latest(error_message)
WHERE service = 'soc5-bots'
FACET bot_name, group_name, target_group_id
SINCE 24 hours ago
```

### Success Count Per Bot

```sql
FROM Log
SELECT sum(success)
WHERE service = 'soc5-bots'
FACET bot_name, group_name
SINCE 24 hours ago
```

### Failure Count Per Bot

```sql
FROM Log
SELECT sum(failed)
WHERE service = 'soc5-bots'
FACET bot_name, group_name
SINCE 24 hours ago
```

### Success And Failure Trend

```sql
FROM Log
SELECT sum(success), sum(failed)
WHERE service = 'soc5-bots'
FACET bot_name
TIMESERIES 1 hour
SINCE 24 hours ago
```

### Current Failures

```sql
FROM Log
SELECT count(*)
WHERE service = 'soc5-bots'
  AND status = 'failure'
FACET bot_name, group_name
SINCE 24 hours ago
```

### Latest Errors

```sql
FROM Log
SELECT latest(error_message), latest(sent_timestamp)
WHERE service = 'soc5-bots'
  AND status = 'failure'
FACET bot_name, group_name, target_group_id
SINCE 7 days ago
```

### Delay Details

```sql
FROM Log
SELECT latest(reason_for_delay), latest(interval_from_previous_sent), latest(sent_timestamp)
WHERE service = 'soc5-bots'
  AND reason_for_delay IS NOT NULL
FACET bot_name, group_name, target_group_id
SINCE 7 days ago
```

## Per-Bot Alert Conditions

Dashboard widgets stay in one place, but alerts should still use bot-specific thresholds when schedules differ.

Failure alert:

```sql
FROM Log
SELECT count(*)
WHERE service = 'soc5-bots'
  AND status = 'failure'
FACET bot_name
```

Missing scheduled success alert for hourly bots:

```sql
FROM Log
SELECT count(*)
WHERE service = 'soc5-bots'
  AND bot_name IN ('SOC5-Intraday', 'SOC5-OTP')
  AND status = 'success'
FACET bot_name
```

Set the hourly alert window to 90 minutes and alert when the count is below 1.

Missing scheduled success alert for three-hour bots:

```sql
FROM Log
SELECT count(*)
WHERE service = 'soc5-bots'
  AND bot_name IN ('soc5-workstation', 'soc5-control-tower')
  AND status = 'success'
FACET bot_name
```

Set the three-hour alert window to 4 hours and alert when the count is below 1.

Missing scheduled success alert for SOC5-KPI:

```sql
FROM Log
SELECT count(*)
WHERE service = 'soc5-bots'
  AND bot_name = 'SOC5-KPI'
  AND status = 'success'
FACET bot_name
```

Use alert windows that match the scheduled gaps: about 6 hours after the 7AM and 7PM sends, and about 8 hours after the 12NN and 12MN sends.

Do not use a missing-success alert for `MDT-SOC5`, `backlogs`, or `enroute-alert` unless you define a business-specific heartbeat. These bots are change-based and may correctly have no sends when the watched range does not change.
