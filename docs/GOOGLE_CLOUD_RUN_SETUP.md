# Google Cloud Run Setup Guide

This guide deploys the PDF-to-PNG converter using **Google Cloud Console + Cloud Run + Cloud Build**.

Use this path when:

- Your Azure subscription is disabled.
- You want a free-tier-friendly alternative to Azure Container Apps.
- You cannot run Docker locally.
- You want Google Cloud to build the Docker image from GitHub.

The result is a Cloud Run URL like:

```text
https://soc5-pdf-to-png-<random>.<region>.run.app/convert/pdf-to-png
```

Use that URL in Apps Script as `PDF_TO_PNG_SERVICE_URL`.

Important: Cloud Run has a free tier, but Google Cloud requires billing to be enabled for most deployments. Set a budget alert before deploying.

## What Cloud Run Runs

Cloud Run runs only the converter service:

```text
GET  /healthz
POST /convert/pdf-to-png
```

Apps Script handles:

- Google Sheet reading
- PDF export
- SeaTalk token handling
- SeaTalk message sending
- Triggers and schedules

## Services Used

This setup uses:

```text
Cloud Run          Runs the converter container
Cloud Build        Builds the Docker image from GitHub
Artifact Registry  Stores the built container image
```

Cloud Run is a good fit for this converter because it can scale to zero when idle, then start only when Apps Script sends a report conversion request.

## Free Tier Notes

Cloud Run request-based services include a monthly free tier. At the time this guide was written, Google documents free monthly amounts for request-based Cloud Run services including:

```text
2 million requests
180,000 vCPU-seconds
360,000 GiB-seconds
```

This converter should usually stay small because each bot sends only occasional PDF-to-PNG requests.

Cost controls to use:

```text
Minimum instances: 0
Maximum instances: 1
Memory:            512 MiB to start
CPU:               1
Timeout:           60 seconds
```

Cloud Build and Artifact Registry have their own pricing/free-tier rules. The image is small enough for normal testing, but still set a budget alert.

## Prerequisites

- A Google Cloud account.
- A Google Cloud project with billing enabled.
- A GitHub repository containing this project.
- Permission to deploy Cloud Run services.
- A shared secret/token for Apps Script and Cloud Run, for example:

```text
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

Recommended region:

```text
asia-southeast1
```

Use another region if it is closer to your Apps Script users or your organization requires it.

## 1. Create Or Select A Google Cloud Project

1. Open <https://console.cloud.google.com>.
2. Open the project selector at the top of the page.
3. Create a new project or select an existing one.
4. Use a clear project name, for example:

```text
soc5-bots
```

## 2. Enable Billing

1. In Google Cloud Console, search for **Billing**.
2. Link a billing account to the project.
3. Confirm the selected project is the project you will deploy to.

Cloud Run free tier still requires billing to be enabled. To avoid surprises, create a budget before deploying.

## 3. Create A Budget Alert

1. Search for **Budgets & alerts**.
2. Click **Create budget**.
3. Select the project.
4. Set a small monthly budget, for example:

```text
Budget amount: USD 1
Alert thresholds: 50%, 90%, 100%
```

5. Save the budget.

This does not automatically stop services, but it gives early warning if something is misconfigured.

## 4. Enable Required APIs

In Google Cloud Console, search for **APIs & Services** and enable:

```text
Cloud Run API
Cloud Build API
Artifact Registry API
```

If the Cloud Run deployment screen asks to enable missing APIs, allow it.

## 5. Open Cloud Run

1. Search for **Cloud Run**.
2. Open **Cloud Run**.
3. Click **Deploy container** or **Create service**.

## 6. Connect The GitHub Repository

On the service creation page:

1. Choose:

```text
Continuously deploy from a repository
```

2. Click **Set up with Cloud Build**.
3. Select **GitHub** as the repository provider.
4. Authenticate with GitHub if prompted.
5. Select the repository containing this project.
6. Accept the repository connection prompt.
7. Choose the branch containing the latest converter code, usually:

```text
main
```

## 7. Configure The Build

In the Cloud Build setup panel:

1. Choose the build type that uses the repository Dockerfile.
2. Configure:

```text
Build type:       Dockerfile
Dockerfile path:  /Dockerfile
Source location:  /
Branch:           main
```

If the UI only asks for the repository and branch, Cloud Build should detect the root `Dockerfile`.

The Dockerfile already installs the required converter dependencies:

```text
poppler-utils
imagemagick
```

## 8. Configure The Cloud Run Service

Back on the Cloud Run service form, set:

```text
Service name:  soc5-pdf-to-png
Region:        asia-southeast1
```

For authentication, select:

```text
Allow public access
```

Apps Script cannot call a private Cloud Run service unless you add a separate authentication layer. The converter still protects `POST /convert/pdf-to-png` with `PDF_TO_PNG_SERVICE_TOKEN`.

## 9. Configure Container Settings

Open **Container(s), volumes, networking, security**.

On the **Container** tab, set:

```text
Container port: 8080
Memory:         512 MiB
CPU:            1
Request timeout: 60 seconds
```

If conversion fails for larger reports, increase:

```text
Memory:         1 GiB
Request timeout: 120 seconds
```

Cloud Run injects `PORT`, but set the container port to `8080` so it matches the Dockerfile and local converter defaults.

## 10. Add Environment Variables

In the same container configuration, add:

```text
PORT=8080
WORK_DIR=/tmp/pdf-to-png-converter
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
SEATALK_MAX_BASE64_BYTES=5242880
```

Important: use the exact same `PDF_TO_PNG_SERVICE_TOKEN` later in Apps Script.

## 11. Configure Scaling

Open the scaling section and set:

```text
Minimum instances: 0
Maximum instances: 1
```

Use `Minimum instances: 0` to stay free-tier-friendly. The tradeoff is cold starts after the converter has been idle.

Use `Maximum instances: 1` because this converter does not need parallel scale for normal bot traffic.

## 12. Configure Ingress

Set ingress to:

```text
Ingress: Allow all traffic
```

Apps Script calls Cloud Run over the public internet, so internal-only ingress will not work.

## 13. Create The Service

1. Review the service settings.
2. Click **Create**.
3. Wait for Cloud Build to build the Docker image.
4. Wait for Cloud Run to deploy the first revision.

The first deployment can take several minutes because Google Cloud builds the image and stores it in Artifact Registry.

## 14. Copy The Service URL

After deployment finishes:

1. Open **Cloud Run > soc5-pdf-to-png**.
2. Open the **Service details** page.
3. Copy the service URL.

It looks like:

```text
https://soc5-pdf-to-png-abc123-uc.a.run.app
```

The converter endpoint is:

```text
https://soc5-pdf-to-png-abc123-uc.a.run.app/convert/pdf-to-png
```

Apps Script also accepts the base Cloud Run URL if that bot normalizes the converter URL automatically:

```text
https://soc5-pdf-to-png-abc123-uc.a.run.app
```

## 15. Test The Health Endpoint

Open this in your browser:

```text
https://<cloud-run-url>/healthz
```

Expected response:

```json
{"ok":true}
```

If the browser shows that JSON, Cloud Run is running correctly.

## 16. Configure Apps Script

In Apps Script, open **Project Settings > Script properties** and set:

```text
PDF_TO_PNG_SERVICE_URL=https://<cloud-run-url>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

The token must match Cloud Run exactly.

Also confirm image sending is enabled for the bot:

```text
REPORT_SEND_IMAGE=true
REPORT_INLINE_CARD_IMAGE=true
REPORT_REQUIRE_INLINE_CARD_IMAGE=true
```

Some bot folders use this property instead:

```text
REPORT_REQUIRE_IMAGE=true
```

Use the property names already present in that bot's `Code.gs`.

## 17. Run A Manual Apps Script Test

1. Open Apps Script.
2. First select and run:

```text
testPdfToPngServiceHealth
```

Expected log output:

```json
{"ok":true}
```

3. Then select the bot's manual send function, usually:

```text
sendReportNow
```

4. Click **Run**.
5. Check SeaTalk.

The SeaTalk message should include the rendered report image.

## Updating The Converter

If you configured continuous deployment from GitHub:

1. Push converter changes to the selected branch.
2. Cloud Build runs automatically.
3. Cloud Run deploys a new revision after the build succeeds.

Changes that trigger a rebuild usually include:

```text
Dockerfile
go.mod
cmd/pdf-to-png-converter/**
internal/converter/**
```

If the build does not run, open:

```text
Cloud Build > Triggers
```

Then run the trigger manually or check the branch filter.

## Troubleshooting

### Deployment Fails During Build

Open:

```text
Cloud Build > History
```

Check the failed build log.

Common causes:

```text
GitHub repository not connected
Wrong branch selected
Dockerfile path is not /Dockerfile
Cloud Build API is disabled
Artifact Registry API is disabled
```

### Service URL Returns Forbidden

The service is private.

Fix:

1. Open **Cloud Run > soc5-pdf-to-png**.
2. Open **Security**.
3. Set public access to allowed.
4. Save or deploy a new revision.

Apps Script must be able to call the URL without Google IAM authentication.

### Health Endpoint Does Not Load

Open:

```text
Cloud Run > soc5-pdf-to-png > Logs
```

Expected startup log:

```text
pdf-to-png converter listening on :8080
```

Also confirm:

```text
Container port: 8080
PORT=8080
```

### Apps Script Gets Unauthorized

The token does not match.

Check both places:

```text
Cloud Run environment variable:
PDF_TO_PNG_SERVICE_TOKEN=...

Apps Script property:
PDF_TO_PNG_SERVICE_TOKEN=...
```

They must be identical.

### Apps Script Gets Not Found

The URL path is probably wrong.

Use:

```text
https://<cloud-run-url>/convert/pdf-to-png
```

Health should be:

```text
https://<cloud-run-url>/healthz
```

### Conversion Times Out

Increase:

```text
Request timeout: 120 seconds
Memory:          1 GiB
```

Then test again with `testPdfToPngServiceHealth` and `sendReportNow`.

### First Request Is Slow

This is a cold start.

With free-tier-friendly settings, Cloud Run scales to zero when idle. The next request starts a new container. This is normal.

If you need faster first requests, set:

```text
Minimum instances: 1
```

Do this only if you accept possible cost, because keeping an instance warm can use billable CPU and memory time.

### SeaTalk Message Sends Without Image

Check Apps Script properties:

```text
REPORT_SEND_IMAGE=true
PDF_TO_PNG_SERVICE_URL=https://<cloud-run-url>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=<same token as Cloud Run>
```

Then check Cloud Run logs for converter errors.

## Cost Notes

Suggested starting settings:

```text
Minimum instances: 0
Maximum instances: 1
Memory:            512 MiB
CPU:               1
Timeout:           60 seconds
```

Keep only one active converter service unless you need separate billing, isolation, or logs.

Set a budget alert before testing, and delete old Cloud Run services or Artifact Registry images that you no longer use.

## References

- Cloud Run free tier and pricing: <https://cloud.google.com/run/pricing>
- Cloud Run continuous deployment from GitHub: <https://cloud.google.com/run/docs/quickstarts/deploy-continuously>
- Cloud Run public access: <https://cloud.google.com/run/docs/authenticating/public>
- Cloud Run container port configuration: <https://cloud.google.com/run/docs/configuring/services/containers>
- Cloud Run environment variables: <https://cloud.google.com/run/docs/configuring/services/environment-variables>
