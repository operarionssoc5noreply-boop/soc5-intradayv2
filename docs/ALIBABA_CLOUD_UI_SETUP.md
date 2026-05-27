# Alibaba Cloud UI Setup Guide

This guide deploys the PDF-to-PNG converter using **Alibaba Cloud Console + Container Registry + Function Compute**.

Use this path when:

- You want an Alibaba Cloud alternative to Azure Container Apps.
- You cannot run Docker locally.
- You want Alibaba Cloud to build the image directly from GitHub.
- You want a public HTTP trigger URL that Apps Script can call.

The result is a Function Compute HTTP trigger URL like:

```text
https://<random>.<region>.fcapp.run/convert/pdf-to-png
```

Use that URL in Apps Script as `PDF_TO_PNG_SERVICE_URL`.

If you already have a working Azure converter for the current bots, you do not need to replace it. This guide is for new Alibaba Cloud deployments or for a migration away from Azure.

## What Alibaba Cloud Runs

Alibaba Cloud runs only the converter service:

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
Container Registry (ACR)     Builds and stores the Docker image
Function Compute             Runs the custom container
HTTP trigger / fcapp.run      Exposes the converter URL
```

For small bot traffic, Function Compute is usually simpler than Serverless App Engine because it does not require a separate public load balancer for the first working endpoint.

## Prerequisites

- An Alibaba Cloud account with real-name verification completed.
- A GitHub repository containing this project.
- Alibaba Cloud Container Registry available in your selected region.
- Alibaba Cloud Function Compute available in the same region.
- A shared secret/token for Apps Script and Function Compute, for example:

```text
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

Recommended region:

```text
Singapore
```

Use the same region for Container Registry and Function Compute. Function Compute custom containers must pull the image from an Alibaba Cloud Container Registry repository in the same account and region.

## 1. Create A Container Registry Instance

1. Open <https://www.alibabacloud.com>.
2. Open the Alibaba Cloud Console.
3. Search for **Container Registry**.
4. In the top navigation bar, select your region, for example:

```text
Singapore
```

5. Open **Instances**.
6. Create a **Personal Edition** instance for testing, or an **Enterprise Edition** instance for production.

Personal Edition is useful for a low-cost test setup, but Alibaba Cloud documents it as development/testing only and without an SLA. Use Enterprise Edition if the converter becomes production-critical.

## 2. Create A Namespace

1. Open **Container Registry > Instances**.
2. Click your registry instance.
3. Open **Repository > Namespaces**.
4. Click **Create Namespace**.
5. Fill in:

```text
Namespace: soc5-bots
```

If `soc5-bots` is unavailable, choose another unique namespace and use it consistently in the rest of this guide.

## 3. Bind GitHub As A Code Source

1. Open your Container Registry instance.
2. In the left menu, open **Repository > Code Source**.
3. Find **GitHub**.
4. Click **Bind Account**.
5. Follow the GitHub authorization flow.
6. Return to Alibaba Cloud Console after the account is bound.

If the GitHub repository is private, make sure the Alibaba Cloud authorization can access it.

## 4. Create The Image Repository

1. Open **Repository > Repositories**.
2. Click **Create Repository**.
3. Fill in:

```text
Namespace:    soc5-bots
Repository:   soc5-pdf-to-png
Summary:      SOC5 PDF to PNG converter
Visibility:   Private
```

4. Click **Next**.
5. Under **Code Source**, choose:

```text
Source:      GitHub
Repository:  your GitHub repo containing this project
```

6. Under **Build Settings**, enable:

```text
Automatically Build Images When Code Changes: optional
Build With Servers Deployed Outside Chinese Mainland: enabled if your GitHub repo is outside Chinese mainland
Build Without Cache: disabled
```

7. Create the repository.

## 5. Configure The Build Rule

1. Open **Repository > Repositories**.
2. Find:

```text
soc5-pdf-to-png
```

3. Click **Manage**.
4. Open **Build**.
5. Create a build rule:

```text
Type:                     Branch
Branch/Tag:               main
Build Context Directory:  /
Dockerfile Filename:      Dockerfile
Image Tag:                latest
```

If your deployment branch is not `main`, use the branch that contains the latest `Dockerfile`, `cmd/`, `internal/`, and `go.mod`.

## 6. Build The Image

1. Stay on the repository **Build** page.
2. Find the build rule.
3. Click **Build**.
4. Wait for the build to finish.
5. If the build fails, open the build log.

Common build failures:

```text
Dockerfile not found        Check Dockerfile Filename and Build Context Directory
GitHub access denied        Rebind GitHub or grant repo access
Base image pull failed      Retry, or check whether golang:1.22-bookworm and debian:bookworm-slim are reachable
Build timeout               Retry or use Enterprise Edition build capability
```

## 7. Confirm The Image Tag Exists

1. Open the image repository.
2. Open **Tags**.
3. Confirm this tag exists:

```text
latest
```

4. Copy the full image address shown by Alibaba Cloud.

It will look similar to one of these formats:

```text
<registry-endpoint>/soc5-bots/soc5-pdf-to-png:latest
crpi-xxxx.<region>.personal.cr.aliyuncs.com/soc5-bots/soc5-pdf-to-png:latest
registry.<region>.aliyuncs.com/soc5-bots/soc5-pdf-to-png:latest
```

Use the exact address displayed in your Container Registry console.

## 8. Create A Function Compute Function

1. Search for **Function Compute** in Alibaba Cloud Console.
2. Open **Functions**.
3. Select the same region used by Container Registry.
4. Click **Create Function**.
5. Choose a custom container or custom image function.
6. Fill in:

```text
Function name:       soc5-pdf-to-png
Runtime / Type:      Custom Container / Custom Image
Image:               <full image address from Container Registry>
Listening port:      8080
CPU:                 0.25 or smallest available
Memory:              512 MB
Timeout:             60 seconds
Instance concurrency: 1 or default
```

If Alibaba Cloud requires larger minimum resources, choose the smallest available option.

Important: the listening port must be `8080`. The Docker image exposes `8080`, and the converter reads `PORT=8080`.

## 9. Add Environment Variables

In the Function Compute function configuration, add:

```text
PORT=8080
WORK_DIR=/tmp/pdf-to-png-converter
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
SEATALK_MAX_BASE64_BYTES=5242880
```

Important: use the exact same `PDF_TO_PNG_SERVICE_TOKEN` later in Apps Script.

## 10. Configure The HTTP Trigger

1. In the function details page, open **Triggers**.
2. Create an HTTP trigger if one was not created automatically.
3. Fill in:

```text
Trigger type:          HTTP Trigger
Trigger name:          http-trigger
Request methods:       GET, POST
Authentication method: No Authentication
```

The converter still validates `PDF_TO_PNG_SERVICE_TOKEN` on `POST /convert/pdf-to-png`. The HTTP trigger uses no Alibaba Cloud authentication because Apps Script does not sign Alibaba Cloud Function Compute requests.

Do not share the trigger URL publicly.

## 11. Copy The Trigger URL

After the trigger is created, copy the public trigger URL.

Prefer the `fcapp.run` URL if Alibaba Cloud shows one:

```text
https://<random>.<region>.fcapp.run
```

The converter endpoint is:

```text
https://<random>.<region>.fcapp.run/convert/pdf-to-png
```

The health endpoint is:

```text
https://<random>.<region>.fcapp.run/healthz
```

If Alibaba Cloud only shows an `aliyuncs.com` endpoint, use it for testing. For long-term use, configure an `fcapp.run` endpoint or a custom domain so normal REST paths work without Function Compute path prefixes.

## 12. Test The Health Endpoint

Open this in your browser:

```text
https://<trigger-url>/healthz
```

Expected response:

```json
{"ok":true}
```

If the browser shows that JSON, Function Compute is running the converter correctly.

If the browser downloads a file instead of displaying JSON, the endpoint is probably the default `aliyuncs.com` Function Compute endpoint. Use the `fcapp.run` URL or configure a custom domain.

## 13. Configure Apps Script

In Apps Script, open **Project Settings > Script properties** and set:

```text
PDF_TO_PNG_SERVICE_URL=https://<trigger-url>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

You can also set `PDF_TO_PNG_SERVICE_URL` to the base trigger URL if that bot's code normalizes the converter URL automatically:

```text
https://<trigger-url>
```

The token must match Function Compute exactly.

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

## 14. Run A Manual Apps Script Test

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

## Optional Custom Domain

For a more stable production URL:

1. Open Function Compute.
2. Open **Custom Domains**.
3. Bind a domain that you control.
4. Configure HTTPS.
5. Route the domain to the `soc5-pdf-to-png` function.
6. Use the custom domain in Apps Script:

```text
PDF_TO_PNG_SERVICE_URL=https://converter.example.com/convert/pdf-to-png
```

This avoids depending on a generated trigger URL and gives you a cleaner HTTPS endpoint.

## Optional SAE Deployment

Serverless App Engine can also run this image, but it normally requires public access configuration through CLB or gateway routing.

Use SAE instead of Function Compute when:

- You need long-running web app hosting semantics.
- You want CLB, ALB, VPC, or gateway routing controls.
- You already use SAE for other services.

For this converter, Function Compute is usually enough because Apps Script sends short request-response conversion jobs.

## Troubleshooting

### Image Build Does Not Appear

Check that GitHub is bound to Container Registry:

```text
Container Registry > Instance > Repository > Code Source
```

If GitHub is not bound, bind it again and recreate or edit the repository build settings.

### Image Build Fails

Open the build log and check:

```text
Build Context Directory: /
Dockerfile Filename: Dockerfile
Branch: main or your deployment branch
```

If the repo is private, confirm Alibaba Cloud has GitHub access.

### Function Cannot Pull The Image

Check:

```text
Container Registry and Function Compute are in the same region
Container Registry and Function Compute are in the same Alibaba Cloud account
The image repository and tag exist
The function has permission to pull from Container Registry
```

For Function Compute custom containers, Alibaba Cloud expects images from Container Registry in the same account and region.

### Health Endpoint Does Not Load

Check the Function Compute logs.

Expected startup log:

```text
pdf-to-png converter listening on :8080
```

Also confirm:

```text
Listening port: 8080
PORT=8080
```

If the listening port is `9000`, change it to `8080` or the function will not reach the converter process.

### Browser Downloads The Health Response

Use the `fcapp.run` URL or configure a custom domain.

Function Compute's default `aliyuncs.com` endpoint can add a download-oriented response header for browser access. Apps Script may still call it, but `fcapp.run` or a custom domain is cleaner for this REST-style converter.

### Apps Script Gets Unauthorized

The token does not match.

Check both places:

```text
Function Compute environment variable:
PDF_TO_PNG_SERVICE_TOKEN=...

Apps Script property:
PDF_TO_PNG_SERVICE_TOKEN=...
```

They must be identical.

### Apps Script Gets Not Found

The URL path is probably wrong.

Use:

```text
https://<trigger-url>/convert/pdf-to-png
```

Health should be:

```text
https://<trigger-url>/healthz
```

If you are using an `aliyuncs.com` endpoint with Function Compute path prefixes, switch to the `fcapp.run` URL or a custom domain.

### Conversion Times Out

Increase the Function Compute timeout:

```text
Timeout: 120 seconds
```

If reports are large, increase memory to the next available size.

### SeaTalk Message Sends Without Image

Check Apps Script properties:

```text
REPORT_SEND_IMAGE=true
PDF_TO_PNG_SERVICE_URL=https://<trigger-url>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=<same token as Function Compute>
```

Then check Function Compute logs for converter errors.

## Cost Notes

For this project, Function Compute should run very little work: roughly one short conversion per report send.

Suggested starting settings:

```text
CPU:      0.25 or smallest available
Memory:   512 MB
Timeout:  60 seconds
```

If conversion fails because of memory, increase memory to the next available size.

Container Registry Personal Edition is useful for testing, but use Enterprise Edition if you need production SLA or stronger image build guarantees.

## References

- Alibaba Cloud Container Registry image builds: <https://www.alibabacloud.com/help/en/acr/user-guide/create-a-repository-and-build-images>
- Alibaba Cloud Container Registry push/pull image format: <https://www.alibabacloud.com/help/en/acr/user-guide/use-a-container-registry-personal-edition-instance-to-push-and-pull-images>
- Alibaba Cloud Function Compute custom containers: <https://www.alibabacloud.com/help/en/functioncompute/fc-2-0/user-guide/create-a-custom-container-function>
- Alibaba Cloud Function Compute HTTP triggers: <https://www.alibabacloud.com/help/en/functioncompute/fc/user-guide/configure-an-http-trigger-for-a-function-and-invoke-the-function-by-using-http-requests>
- Alibaba Cloud `fcapp.run` RESTful application access: <https://www.alibabacloud.com/help/doc-detail/423978.html>
