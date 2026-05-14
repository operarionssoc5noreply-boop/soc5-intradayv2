# SOC5 Intraday Apps Script + Azure Converter

This project now uses only:

- **Google Apps Script** for the hourly SOC5 SeaTalk bot workflow.
- **Azure Container Apps** for one small Docker service that converts exported Google Sheet PDFs into PNG images.

Apps Script reads the spreadsheet, exports `intraday!C1:AD37` to PDF, calls the Azure converter, inlines the returned PNG in a SeaTalk interactive message card, and sends the card to group IDs from `bot_config!A2:A`.

## Architecture

```text
Google Apps Script hourly trigger
  -> reads Google Sheet values
  -> exports intraday!C1:AD37 as PDF
  -> POSTs PDF base64 to Azure Container Apps
  -> receives PNG base64
  -> sends SeaTalk interactive card with inline image
```

The Azure service does not know about SeaTalk or Google Sheets. It only exposes:

```text
GET  /healthz
POST /convert/pdf-to-png
```

## Repository Layout

```text
apps-script/
  Code.gs              Google Apps Script bot
  appsscript.json      Apps Script manifest/scopes
  README.md            Apps Script focused notes

cmd/pdf-to-png-converter/
  main.go              Azure converter HTTP server

internal/converter/
  convert.go           Poppler/ImageMagick PDF-to-PNG conversion

Dockerfile             Azure Container Apps image
.env.example           Local/Azure converter environment example
```

## 1. Prepare The Spreadsheet

The default configuration expects:

```text
Spreadsheet ID: 1pLN46ZKWJIsidswMeoxhZwoacuFMR08sCaTFG6mLytc
Report range:   intraday!C1:AD37
FMS update:     intraday!AE2
Group IDs:      bot_config!A2:A
```

Put each SeaTalk group ID in `bot_config!A2:A`.

## 2. Deploy The Azure Converter

The converter is a Dockerized Go service. It requires Poppler and ImageMagick, both installed by the Dockerfile.

### Option A: Azure Portal

1. Create an Azure Container Registry, or use Docker Hub/GitHub Container Registry.
2. Build and push this repository's Docker image.
3. Create an Azure Container App.
4. Select the pushed image.
5. Set ingress to external HTTP.
6. Set target port to `8080`.
7. Add environment variables:

```text
PORT=8080
WORK_DIR=/tmp/pdf-to-png-converter
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
SEATALK_MAX_BASE64_BYTES=5242880
```

8. Deploy and copy the Container App URL.

### Option B: Azure CLI

Set values:

```powershell
$RESOURCE_GROUP="soc5-intraday-rg"
$LOCATION="southeastasia"
$ACR_NAME="soc5intradayacr"
$APP_NAME="soc5-pdf-to-png"
$IMAGE="$ACR_NAME.azurecr.io/soc5-pdf-to-png:latest"
$TOKEN="choose-a-long-random-secret"
```

Create Azure resources:

```powershell
az login
az extension add --name containerapp --upgrade
az group create --name $RESOURCE_GROUP --location $LOCATION
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic
az acr update --name $ACR_NAME --admin-enabled true
az acr login --name $ACR_NAME
docker build -t $IMAGE .
docker push $IMAGE
$ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
$ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv)
az containerapp env create --name "$APP_NAME-env" --resource-group $RESOURCE_GROUP --location $LOCATION
az containerapp create `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --environment "$APP_NAME-env" `
  --image $IMAGE `
  --target-port 8080 `
  --ingress external `
  --registry-server "$ACR_NAME.azurecr.io" `
  --registry-username $ACR_USERNAME `
  --registry-password $ACR_PASSWORD `
  --env-vars PORT=8080 WORK_DIR=/tmp/pdf-to-png-converter PDF_TO_PNG_SERVICE_TOKEN=$TOKEN SEATALK_MAX_BASE64_BYTES=5242880
```

Get the converter URL:

```powershell
az containerapp show `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --query properties.configuration.ingress.fqdn `
  --output tsv
```

Your Apps Script converter URL will be:

```text
https://<fqdn>/convert/pdf-to-png
```

## 3. Verify Azure Converter

Health check:

```powershell
Invoke-RestMethod https://<fqdn>/healthz
```

Expected response:

```json
{"ok":true}
```

The conversion endpoint expects:

```json
{
  "pdf_base64": "JVBERi0x...",
  "dpi": 220,
  "resize_width": 2200,
  "border_px": 20
}
```

If `PDF_TO_PNG_SERVICE_TOKEN` is set, requests must include:

```text
Authorization: Bearer <same-token>
```

Response:

```json
{
  "image_base64": "iVBORw0KGgo..."
}
```

## 4. Create The Apps Script Project

1. Open <https://script.google.com>.
2. Create a new project.
3. Copy [apps-script/Code.gs](./apps-script/Code.gs) into `Code.gs`.
4. Copy [apps-script/appsscript.json](./apps-script/appsscript.json) into the manifest file.
5. Open **Project Settings > Script properties**.

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

Recommended script properties:

```text
TIME_ZONE=Asia/Manila
SEATALK_API_BASE=https://openapi.seatalk.io
REPORT_TITLE_PREFIX=SOC 5 IntraDay Update as of
REPORT_SEND_IMAGE=true
REPORT_INLINE_CARD_IMAGE=true
REPORT_REQUIRE_INLINE_CARD_IMAGE=true
REPORT_SEND_PDF_FILE=false
GOOGLE_EXPORT_LANDSCAPE=true
BOT_PDF_DPI=220
BOT_IMAGE_BORDER_PX=20
BOT_IMAGE_RESIZE_WIDTH=2200
SEATALK_MAX_BASE64_BYTES=5242880
```

Optional:

```text
SEATALK_GROUP_ID=optional-fallback-group-id
GOOGLE_SHEET_GID=
SEATALK_WELCOME_ON_ADD=false
```

## 5. Authorize And Test Apps Script

1. In Apps Script, select `sendReportNow`.
2. Click **Run**.
3. Approve the requested permissions.
4. Check SeaTalk for the message card.

The message should include:

- Title like `SOC 5 IntraDay Update as of 7:30 AM May-14`
- `FMS Update: <value from intraday!AE2>`
- Inline PNG image from `intraday!C1:AD37`
- `View Report Link` button

## 6. Schedule Hourly Sending

After a successful manual run, run:

```text
installHourlyTrigger
```

That removes existing triggers for `sendIntradayReport` and creates one hourly trigger.

## 7. Optional SeaTalk Callback

Apps Script includes `doPost(e)` for SeaTalk event verification and optional bot-added handling.

Deploy it as a web app:

1. Click **Deploy > New deployment > Web app**.
2. Execute as: **Me**.
3. Access: choose a setting SeaTalk can reach.
4. Use the web app URL as the SeaTalk callback URL.

Limitation: Apps Script web apps do not expose inbound request headers to `doPost`, so this implementation cannot validate SeaTalk's signature header. The hourly sending flow does not require this callback.

## 8. Local Converter Test

Build and run locally:

```powershell
docker build -t soc5-pdf-to-png .
docker run --env-file .env.example -p 8080:8080 soc5-pdf-to-png
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8080/healthz
```

## Troubleshooting

`REPORT_SEND_IMAGE is enabled but PDF_TO_PNG_SERVICE_URL is not configured`

Set `PDF_TO_PNG_SERVICE_URL` in Apps Script script properties.

`unauthorized`

The Apps Script `PDF_TO_PNG_SERVICE_TOKEN` does not match the Azure `PDF_TO_PNG_SERVICE_TOKEN`.

`encoded image is over limit`

Lower `BOT_PDF_DPI`, lower `BOT_IMAGE_RESIZE_WIDTH`, or reduce the capture range.

Apps Script succeeds but SeaTalk has no image

Check `REPORT_SEND_IMAGE=true`, `REPORT_INLINE_CARD_IMAGE=true`, and Azure Container Apps logs.

## Security Notes

- Do not commit SeaTalk credentials.
- Do not commit the shared converter token.
- Use a long random `PDF_TO_PNG_SERVICE_TOKEN`.
- Keep the Azure converter endpoint narrow: it only accepts PDF base64 and returns PNG base64.
