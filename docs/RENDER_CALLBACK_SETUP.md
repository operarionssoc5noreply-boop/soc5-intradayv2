# Render SeaTalk Callback Proxy

Use this only if you want Render to be the SeaTalk callback URL.

In this multi-bot repo, the callback proxy is shared infrastructure. Because all workflows use the same SeaTalk app, use the same SeaTalk signing secret for callback validation.

SeaTalk normally has one callback URL per app. If multiple Apps Script workflows need callback events, either forward to one canonical Apps Script callback handler or add routing logic to the proxy.

The normal report flow stays the same:

- Apps Script sends SeaTalk reports.
- Azure Container Apps converts PDF to PNG.
- Render only receives SeaTalk events, validates the SeaTalk signature, and forwards events to Apps Script.

## Why Use Render For Callback

Apps Script web apps can receive SeaTalk callbacks, but Apps Script does not expose inbound request headers to `doPost`. That means Apps Script cannot validate SeaTalk's `Signature` header.

This Render proxy fixes that:

```text
SeaTalk -> Render callback proxy -> Apps Script web app
```

Render validates the signature, then forwards the same JSON body to Apps Script. Apps Script stores new group IDs in `bot_config!A2:A`.

## Render Service Settings

Create a Render **Web Service** from this repository.

Use Docker and set the Dockerfile path to:

```text
Dockerfile.callback
```

Set the health check path:

```text
/healthz
```

Environment variables:

```text
PORT=10000
SEATALK_CALLBACK_PATH=/bot-callback
SEATALK_SIGNING_SECRET=your-seatalk-signing-secret
APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/your-deployment-id/exec
```

Use the shared SeaTalk signing secret for `SEATALK_SIGNING_SECRET`.

## SeaTalk Callback URL

After Render deploys, use this URL in the SeaTalk developer portal:

```text
https://your-render-service.onrender.com/bot-callback
```

## Apps Script Web App

You still need Apps Script deployed as a web app, because Render forwards valid events to it.

Apps Script deployment settings:

```text
Execute as: Me
Who has access: Anyone
```

Use the Apps Script web app URL as `APPS_SCRIPT_WEB_APP_URL` in Render.

For the Intraday bot, the Apps Script source is:

```text
bots/intraday/apps-script/
```

## Behavior

`event_verification`

Render validates the `Signature` header, then responds directly to SeaTalk with JSON:

```json
{"seatalk_challenge":"..."}
```

`bot_added_to_group_chat`

Render validates the signature, forwards the event to Apps Script, and Apps Script stores the group ID in:

```text
bot_config!A2:A
```

Other events

Render validates and forwards them to Apps Script. Apps Script currently returns `{}` unless it has specific handling for the event.

## Verify

Health check:

```text
https://your-render-service.onrender.com/healthz
```

Expected:

```json
{"ok":true}
```

After changing callback code, redeploy the Render service before retrying verification in the SeaTalk developer portal.

If SeaTalk says verification failed because the response is invalid, check Render logs. The proxy should log startup like:

```text
seatalk callback proxy listening on :10000/bot-callback
```

Make sure the SeaTalk callback URL points to the callback path, not just the Render base URL:

```text
https://your-render-service.onrender.com/bot-callback
```

## Notes

- Do not use Render for report sending in this setup.
- Do not use Render for PDF-to-PNG conversion in this setup.
- Keep `SEATALK_SIGNING_SECRET` only in Render environment variables.
- If Render free tier sleeps, SeaTalk verification/events may wait during cold start.
