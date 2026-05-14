# Azure UI Setup Guide

This guide deploys the PDF-to-PNG converter using **Azure Portal + GitHub Actions**.

Use this path when:

- You cannot run Docker locally.
- `az acr build` fails with `TasksOperationsNotAllowed`.
- You want to avoid Azure CLI commands for the main setup.

The result is an Azure Container App URL like:

```text
https://soc5-pdf-to-png.<region>.azurecontainerapps.io/convert/pdf-to-png
```

Use that URL in Apps Script as `PDF_TO_PNG_SERVICE_URL`.

If you already have a working Azure converter for the current Intraday bot, you do not need to rename the live Azure resources. These names are for new `soc5-bots` setups.

## What Azure Runs

Azure runs only the converter service:

```text
GET  /healthz
POST /convert/pdf-to-png
```

Apps Script handles:

- Google Sheet reading
- PDF export
- SeaTalk token handling
- SeaTalk message sending
- Hourly trigger

## Prerequisites

- Azure for Students or another Azure subscription.
- A GitHub repository containing this project.
- The workflow file in this repo:

```text
.github/workflows/build-converter-image.yml
```

- A shared secret/token for Apps Script and Azure, for example:

```text
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

## 1. Create A Resource Group

1. Open <https://portal.azure.com>.
2. Search for **Resource groups**.
3. Click **Create**.
4. Fill in:

```text
Subscription:    your Azure subscription
Resource group:  soc5-bots-rg
Region:          Southeast Asia
```

5. Click **Review + create**.
6. Click **Create**.

## 2. Create Azure Container Registry

1. In Azure Portal, search for **Container registries**.
2. Click **Create**.
3. Fill in:

```text
Subscription:    your Azure subscription
Resource group:  soc5-bots-rg
Registry name:   soc5botsacr
Location:        Southeast Asia
Pricing plan:    Basic
```

4. Click **Review + create**.
5. Click **Create**.
6. After deployment finishes, open the registry.

## 3. Enable ACR Admin User

GitHub Actions needs permission to push the Docker image to Azure Container Registry.

1. Open **Container registries > soc5botsacr**.
2. In the left menu, open **Settings > Access keys**.
3. Set **Admin user** to **Enabled**.
4. Copy these values:

```text
Login server
Username
password or password2
```

Example:

```text
Login server: soc5botsacr.azurecr.io
Username:     soc5botsacr
Password:     <hidden Azure password>
```

## 4. Add GitHub Secrets

1. Open your GitHub repository.
2. Go to **Settings**.
3. Open **Secrets and variables > Actions**.
4. Click **New repository secret**.
5. Add these three secrets:

```text
ACR_LOGIN_SERVER=soc5botsacr.azurecr.io
ACR_USERNAME=<username from Azure Access keys>
ACR_PASSWORD=<password from Azure Access keys>
```

Create each secret one at a time.

## 5. Build And Push The Image With GitHub Actions

1. In GitHub, open the **Actions** tab.
2. Select **Build Converter Image**.
3. Click **Run workflow**.
4. Choose the branch containing your latest code.
5. Click **Run workflow** again.
6. Wait for the workflow to finish successfully.

The workflow builds this Docker image:

```text
soc5botsacr.azurecr.io/soc5-pdf-to-png:latest
```

## 6. Confirm The Image Exists In ACR

1. Return to Azure Portal.
2. Open **Container registries > soc5botsacr**.
3. In the left menu, open **Services > Repositories**.
4. Click:

```text
soc5-pdf-to-png
```

5. Confirm the tag exists:

```text
latest
```

Do not create the Container App until this tag exists.

## 7. Create A Container Apps Environment

1. In Azure Portal, search for **Container Apps Environments**.
2. Click **Create**.
3. Fill in:

```text
Subscription:      your Azure subscription
Resource group:    soc5-bots-rg
Environment name:  soc5-pdf-to-png-env
Region:            Southeast Asia
```

4. Leave Log Analytics settings as default.
5. Click **Review + create**.
6. Click **Create**.

## 8. Create The Container App

1. In Azure Portal, search for **Container Apps**.
2. Click **Create**.
3. On the **Basics** tab, fill in:

```text
Subscription:                 your Azure subscription
Resource group:               soc5-bots-rg
Container app name:           soc5-pdf-to-png
Region:                       Southeast Asia
Container Apps Environment:   soc5-pdf-to-png-env
```

4. Continue to the **Container** tab.

## 9. Configure The Container Image

On the **Container** tab:

1. Choose Azure Container Registry as the image source.
2. Select:

```text
Registry:    soc5botsacr
Image:       soc5-pdf-to-png
Image tag:   latest
```

3. Set resources:

```text
CPU:     0.25
Memory:  0.5 Gi
```

If Azure Portal requires a larger minimum, choose the smallest available option.

## 10. Add Environment Variables

In the same container configuration, add:

```text
PORT=8080
WORK_DIR=/tmp/pdf-to-png-converter
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
SEATALK_MAX_BASE64_BYTES=5242880
```

Important: use the exact same `PDF_TO_PNG_SERVICE_TOKEN` later in Apps Script.

## 11. Enable Ingress

Open the **Ingress** section and configure:

```text
Ingress:              Enabled
Ingress traffic:      Accepting traffic from anywhere
Ingress type:         HTTP
Target port:          8080
Transport:            Auto
```

Then click:

```text
Review + create
Create
```

Wait for deployment to finish.

## 12. Copy The Application URL

1. Open **Container Apps > soc5-pdf-to-png**.
2. Open **Overview**.
3. Copy **Application Url**.

The converter endpoint is:

```text
https://<application-url>/convert/pdf-to-png
```

Example:

```text
https://soc5-pdf-to-png.orange-field-123456.southeastasia.azurecontainerapps.io/convert/pdf-to-png
```

Apps Script also accepts the base Application URL and appends `/convert/pdf-to-png` automatically:

```text
https://soc5-pdf-to-png.orange-field-123456.southeastasia.azurecontainerapps.io
```

## 13. Test The Health Endpoint

Open this in your browser:

```text
https://<application-url>/healthz
```

Expected response:

```json
{"ok":true}
```

If the browser shows that JSON, Azure is running correctly.

## 14. Configure Apps Script

In Apps Script, open **Project Settings > Script properties** and set:

```text
PDF_TO_PNG_SERVICE_URL=https://<application-url>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

You can also set `PDF_TO_PNG_SERVICE_URL` to the base Azure Application URL.

The token must match Azure exactly.

Also confirm these are set:

```text
REPORT_SEND_IMAGE=true
REPORT_INLINE_CARD_IMAGE=true
REPORT_REQUIRE_INLINE_CARD_IMAGE=true
```

## 15. Run A Manual Apps Script Test

1. Open Apps Script.
2. First select and run:

```text
testPdfToPngServiceHealth
```

Expected log output:

```json
{"ok":true}
```

3. Then select:

```text
sendReportNow
```

4. Click **Run**.
5. Check SeaTalk.

The SeaTalk card should include:

- Title
- FMS update
- Inline report image
- View Report Link button

## Optional SeaTalk Callback For Auto-Saving Group IDs

Apps Script can save a group ID automatically when the bot is added to a SeaTalk group.

1. In Apps Script, click **Deploy > New deployment**.
2. Select **Web app**.
3. Set:

```text
Execute as: Me
Who has access: Anyone
```

4. Deploy and copy the web app URL.
5. In the SeaTalk developer portal, set that URL as the bot callback URL.

When SeaTalk sends `bot_added_to_group_chat`, Apps Script writes the new group ID into:

```text
bot_config!A2:A
```

Duplicate group IDs are ignored.

Limitation: Apps Script does not expose inbound request headers to `doPost`, so this callback cannot validate SeaTalk's signature header.

## Troubleshooting

### Image Not Found In Container App

If Azure cannot find the image:

1. Open **Container registries > soc5botsacr > Services > Repositories**.
2. Confirm:

```text
soc5-pdf-to-png:latest
```

3. If missing, rerun GitHub Actions **Build Converter Image**.

### Application URL Is Blank

1. Open **Container Apps > soc5-pdf-to-png**.
2. Open **Ingress**.
3. Confirm ingress is enabled.
4. Confirm target port is `8080`.
5. Save changes.
6. Return to **Overview** and check **Application Url** again.

### Health Endpoint Does Not Load

1. Open **Container Apps > soc5-pdf-to-png**.
2. Open **Revisions and replicas**.
3. Confirm the latest revision is active.
4. Open **Monitoring > Log stream**.
5. Look for startup errors.

Expected startup log:

```text
pdf-to-png converter listening on :8080
```

### Apps Script Gets Unauthorized

The token does not match.

Check both places:

```text
Azure Container App:
PDF_TO_PNG_SERVICE_TOKEN=...

Apps Script:
PDF_TO_PNG_SERVICE_TOKEN=...
```

They must be identical.

### SeaTalk API Code 7001

SeaTalk returned:

```text
Bot is not a member of the group chat
```

Fix the recipient list:

1. Open the Google Sheet.
2. Check `bot_config!A2:A`.
3. Find the group ID shown in Apps Script logs.
4. Either add the bot to that SeaTalk group or remove that group ID from the sheet.

Also check Apps Script property `SEATALK_GROUP_ID` if you set it as a fallback group.

### SeaTalk Message Sends Without Image

Check Apps Script properties:

```text
REPORT_SEND_IMAGE=true
REPORT_INLINE_CARD_IMAGE=true
REPORT_REQUIRE_INLINE_CARD_IMAGE=true
PDF_TO_PNG_SERVICE_URL=https://<application-url>/convert/pdf-to-png
```

Then check Azure **Log stream** for converter errors.

## Cost Notes

For this project, Azure Container Apps should run very little work: roughly one short conversion per report send. Keep the container small and set a budget alert in Azure Cost Management.

Suggested settings:

```text
CPU:     0.25
Memory:  0.5 Gi
```

If conversion fails because of memory, increase memory to the next available size.
