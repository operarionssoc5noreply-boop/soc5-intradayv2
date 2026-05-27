# New Relic Bot Monitoring

Use New Relic Logs to monitor SOC5 bot success and failure events. This works with a regular New Relic account or a New Relic account from a student pack, as long as the account has log ingest enabled and a license key.

## Flow

```text
Apps Script bot
  -> BotLogs.gs
  -> Google Sheet bot_logs
  -> New Relic Log API
  -> New Relic dashboards and alerts
```

The Google Sheet remains the local audit log. New Relic is used for dashboard queries, charts, and alerts.

## What The Bots Send

`BotLogs.gs` sends one JSON log event per group send attempt.

Fields:

```text
timestamp
message
logtype
service
bot_name
target_group_id
group_name
status
success
failed
sent_timestamp
interval_from_previous_sent
reason_for_delay
error_message
```

`success` and `failed` are numeric flags:

```text
success = 1, failed = 0  # successful send
success = 0, failed = 1  # failed send
```

## New Relic Setup

1. Open New Relic.
2. Go to **API keys**.
3. Copy or create an **ingest license key** for the account.
4. Confirm your account region:
   - US endpoint: `https://log-api.newrelic.com/log/v1`
   - EU endpoint: `https://log-api.eu.newrelic.com/log/v1`

## Apps Script Properties

Add these Script Properties to each bot Apps Script project:

```text
NEW_RELIC_LICENSE_KEY=<new-relic-license-key>
NEW_RELIC_LOG_API_URL=https://log-api.newrelic.com/log/v1
```

`NEW_RELIC_LOG_API_URL` is optional for US accounts. If omitted, the code uses `https://log-api.newrelic.com/log/v1`.

After saving the properties, run `sendReportNow()` once from each Apps Script project. A successful push writes `yes` in the `new_relic_sent` column in `bot_logs`.

## Verify In New Relic

Open **Logs** or **Query your data**, then run:

```sql
FROM Log
SELECT *
WHERE service = 'soc5-bots'
SINCE 1 hour ago
```

Failures only:

```sql
FROM Log
SELECT *
WHERE service = 'soc5-bots'
  AND status = 'failure'
SINCE 24 hours ago
```

## Dashboard Queries

For a single dashboard containing all bot logs and monitoring widgets, use [NEW_RELIC_PER_BOT_DASHBOARD.md](./NEW_RELIC_PER_BOT_DASHBOARD.md).

Latest bot events:

```sql
FROM Log
SELECT latest(message), latest(status), latest(group_name), latest(error_message)
WHERE service = 'soc5-bots'
FACET bot_name, target_group_id
SINCE 24 hours ago
```

Success count by bot:

```sql
FROM Log
SELECT sum(success)
WHERE service = 'soc5-bots'
FACET bot_name
SINCE 24 hours ago
```

Failure count by bot:

```sql
FROM Log
SELECT sum(failed)
WHERE service = 'soc5-bots'
FACET bot_name
SINCE 24 hours ago
```

Success and failure trend:

```sql
FROM Log
SELECT sum(success), sum(failed)
WHERE service = 'soc5-bots'
FACET bot_name
TIMESERIES 1 hour
SINCE 24 hours ago
```

Delayed sends:

```sql
FROM Log
SELECT latest(reason_for_delay), latest(interval_from_previous_sent)
WHERE service = 'soc5-bots'
  AND reason_for_delay IS NOT NULL
FACET bot_name, group_name
SINCE 24 hours ago
```

## Alert Ideas

Any bot failure in the last 15 minutes:

```sql
FROM Log
SELECT count(*)
WHERE service = 'soc5-bots'
  AND status = 'failure'
FACET bot_name
```

No successful hourly bot run in 90 minutes:

```sql
FROM Log
SELECT count(*)
WHERE service = 'soc5-bots'
  AND status = 'success'
FACET bot_name
```

For the second alert, set the alert window to 90 minutes for hourly bots or 4 hours for three-hour bots, then alert when the count is below 1.
