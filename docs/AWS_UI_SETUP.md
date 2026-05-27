# AWS UI Setup Guide

This guide deploys the PDF-to-PNG converter using **AWS Console + Amazon ECR + AWS App Runner + GitHub Actions**.

Use this path when:

- You want an AWS alternative to Azure Container Apps.
- You cannot run Docker locally.
- You want GitHub Actions to build and push the Docker image.
- You want a public HTTPS URL that Apps Script can call.

The result is an App Runner URL like:

```text
https://<app-runner-service-id>.<region>.awsapprunner.com/convert/pdf-to-png
```

Use that URL in Apps Script as `PDF_TO_PNG_SERVICE_URL`.

If you already have a working Azure converter for the current bots, you do not need to replace it. This guide is for new AWS deployments or for a migration away from Azure.

## What AWS Runs

AWS runs only the converter service:

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
Amazon ECR        Stores the Docker image
GitHub Actions    Builds and pushes the image to ECR
AWS App Runner    Runs the converter container and exposes HTTPS
AWS IAM           Grants GitHub and App Runner the required permissions
```

App Runner is the simplest AWS console path for this converter because it can run a web container directly from ECR and provide a managed HTTPS URL without an extra load balancer.

## Cost Notes Before You Start

App Runner is usually not as free-tier-friendly as scale-to-zero services. It can keep provisioned capacity available even when the converter is idle.

Before deploying:

1. Open **AWS Billing and Cost Management**.
2. Create a small monthly budget.
3. Add email alerts.
4. Delete or pause unused App Runner services after testing.

Suggested starting settings:

```text
CPU:      0.25 vCPU
Memory:   0.5 GB
Timeout:  60 seconds
```

If conversion fails because of memory, increase memory to the next available size.

## Prerequisites

- An AWS account.
- A GitHub repository containing this project.
- Permission to create ECR repositories, IAM users/policies, IAM roles, and App Runner services.
- The workflow file in this repo:

```text
.github/workflows/build-converter-image-aws.yml
```

- A shared secret/token for Apps Script and App Runner, for example:

```text
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

Recommended region:

```text
ap-southeast-1
```

Use another region if it is closer to your users or required by your organization. Use the same region for ECR, GitHub Actions, and App Runner.

## 1. Create An ECR Repository

1. Open <https://console.aws.amazon.com>.
2. In the region selector, choose:

```text
Asia Pacific (Singapore) / ap-southeast-1
```

3. Search for **Elastic Container Registry**.
4. Open **Repositories**.
5. Click **Create repository**.
6. Fill in:

```text
Visibility settings:  Private
Repository name:      soc5-pdf-to-png
Tag immutability:     Disabled
Scan on push:         Enabled
Encryption:           AES-256
```

7. Click **Create repository**.
8. Open the repository and copy its URI.

It will look like:

```text
<aws-account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/soc5-pdf-to-png
```

## 2. Create An IAM Policy For GitHub Actions

GitHub Actions needs permission to push the Docker image to the ECR repository.

1. Search for **IAM**.
2. Open **Policies**.
3. Click **Create policy**.
4. Open the **JSON** editor.
5. Paste this policy, replacing `<aws-account-id>` and `<region>`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeImages",
        "ecr:DescribeRepositories",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:<region>:<aws-account-id>:repository/soc5-pdf-to-png"
    }
  ]
}
```

Example resource for Singapore:

```text
arn:aws:ecr:ap-southeast-1:123456789012:repository/soc5-pdf-to-png
```

6. Click **Next**.
7. Name the policy:

```text
soc5-pdf-to-png-ecr-push
```

8. Click **Create policy**.

## 3. Create An IAM User For GitHub Actions

This is the simplest UI setup. For a stricter production setup, use GitHub OIDC with an IAM role instead of long-lived access keys.

1. In IAM, open **Users**.
2. Click **Create user**.
3. Fill in:

```text
User name: soc5-github-ecr-pusher
```

4. Do not enable console access.
5. Click **Next**.
6. Choose **Attach policies directly**.
7. Attach:

```text
soc5-pdf-to-png-ecr-push
```

8. Create the user.
9. Open the new user.
10. Open **Security credentials**.
11. Create an **Access key**.
12. Choose **Third-party service** or the closest available use case.
13. Copy:

```text
Access key ID: 
Secret access key
```

Keep the secret access key private. AWS shows it only once.

## 4. Add GitHub Secrets

1. Open your GitHub repository.
2. Go to **Settings**.
3. Open **Secrets and variables > Actions**.
4. Click **New repository secret**.
5. Add these three secrets:

```text
AWS_ACCESS_KEY_ID=<access key ID from IAM>
AWS_SECRET_ACCESS_KEY=<secret access key from IAM>
AWS_REGION=ap-southeast-1
```

Create each secret one at a time.

## 5. Build And Push The Image With GitHub Actions

1. In GitHub, open the **Actions** tab.
2. Select **Build Converter Image AWS**.
3. Click **Run workflow**.
4. Choose the branch containing your latest code.
5. Click **Run workflow** again.
6. Wait for the workflow to finish successfully.

The workflow builds this Docker image:

```text
<aws-account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/soc5-pdf-to-png:latest
```

## 6. Confirm The Image Exists In ECR

1. Return to AWS Console.
2. Open **Elastic Container Registry > Repositories**.
3. Open:

```text
soc5-pdf-to-png
```

4. Confirm the tag exists:

```text
latest
```

Do not create the App Runner service until this tag exists.

## 7. Create The App Runner Service

1. Search for **App Runner**.
2. Click **Create service**.
3. Under **Source**, choose:

```text
Source type:  Container registry
Provider:     Amazon ECR
```

4. Click **Browse** and select:

```text
Repository:  soc5-pdf-to-png
Image tag:   latest
```

5. For deployment trigger, choose:

```text
Manual
```

Use manual deployments first so each new image push does not unexpectedly restart the converter. You can switch to automatic deployment later.

6. For ECR access role, choose **Create new service role** if prompted.
7. Continue to service settings.

## 8. Configure The App Runner Service

Fill in:

```text
Service name:  soc5-pdf-to-png
Virtual CPU:   0.25 vCPU
Memory:        0.5 GB
```

If AWS Console requires a larger minimum, choose the smallest available option.

Under **Port**, set:

```text
Port: 8080
```

The Docker image exposes `8080`, and the converter reads `PORT=8080`.

## 9. Add Environment Variables

In the same service configuration, add:

```text
PORT=8080
WORK_DIR=/tmp/pdf-to-png-converter
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
SEATALK_MAX_BASE64_BYTES=5242880
```

Important: use the exact same `PDF_TO_PNG_SERVICE_TOKEN` later in Apps Script.

## 10. Configure The Health Check

Set the health check to:

```text
Protocol:  HTTP
Path:      /healthz
```

Leave the other health check values at their defaults unless App Runner reports repeated startup failures.

## 11. Create The Service

1. Review the service settings.
2. Click **Create & deploy**.
3. Wait for App Runner to pull the image and deploy the service.

The first deployment can take several minutes.

## 12. Copy The Default Domain

After deployment finishes:

1. Open **App Runner > Services > soc5-pdf-to-png**.
2. Open the service **Overview**.
3. Copy **Default domain**.

It looks like:

```text
https://abc123xyz.ap-southeast-1.awsapprunner.com
```

The converter endpoint is:

```text
https://abc123xyz.ap-southeast-1.awsapprunner.com/convert/pdf-to-png
```

Apps Script also accepts the base App Runner URL if that bot normalizes the converter URL automatically:

```text
https://abc123xyz.ap-southeast-1.awsapprunner.com
```

## 13. Test The Health Endpoint

Open this in your browser:

```text
https://<app-runner-domain>/healthz
```

Expected response:

```json
{"ok":true}
```

If the browser shows that JSON, App Runner is running correctly.

## 14. Configure Apps Script

In Apps Script, open **Project Settings > Script properties** and set:

```text
PDF_TO_PNG_SERVICE_URL=https://<app-runner-domain>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=choose-a-long-random-secret
```

You can also set `PDF_TO_PNG_SERVICE_URL` to the base App Runner URL if that bot normalizes the converter URL automatically.

The token must match App Runner exactly.

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

3. Then select the bot's manual send function, usually:

```text
sendReportNow
```

4. Click **Run**.
5. Check SeaTalk.

The SeaTalk message should include the rendered report image.

## Updating The Converter

When converter code changes:

1. Push changes to the selected branch.
2. GitHub Actions builds and pushes a new `latest` image to ECR.
3. Open **App Runner > Services > soc5-pdf-to-png**.
4. Click **Deploy** or **Start deployment**.
5. Wait for the new deployment to complete.

Changes that trigger a rebuild usually include:

```text
Dockerfile
go.mod
cmd/pdf-to-png-converter/**
internal/converter/**
```

If you later switch App Runner to automatic deployment, App Runner deploys when the ECR image changes.

## Optional Custom Domain

For a cleaner production URL:

1. Open **App Runner > Services > soc5-pdf-to-png**.
2. Open **Custom domains**.
3. Add a domain that you control.
4. Follow the DNS validation instructions.
5. Use the custom domain in Apps Script:

```text
PDF_TO_PNG_SERVICE_URL=https://converter.example.com/convert/pdf-to-png
```

## Troubleshooting

### GitHub Actions Cannot Log In To ECR

Check GitHub secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

Then check the IAM policy allows:

```text
ecr:GetAuthorizationToken
```

The `AWS_REGION` secret must match the region where the ECR repository exists.

### GitHub Actions Cannot Push The Image

Check the IAM policy resource:

```text
arn:aws:ecr:<region>:<aws-account-id>:repository/soc5-pdf-to-png
```

Common mistakes:

```text
Wrong AWS account ID
Wrong region
Wrong repository name
Policy not attached to the IAM user
```

### Image Not Found In App Runner

If App Runner cannot find the image:

1. Open **Elastic Container Registry > Repositories > soc5-pdf-to-png**.
2. Confirm:

```text
soc5-pdf-to-png:latest
```

3. If missing, rerun GitHub Actions **Build Converter Image AWS**.

### App Runner Cannot Pull From ECR

Check the App Runner ECR access role:

1. Open **App Runner > Services > soc5-pdf-to-png**.
2. Open the source configuration.
3. Confirm the selected image is in the same AWS account and region.
4. Confirm an ECR access role is configured.

If the role is missing, edit the service source settings or recreate the service and let App Runner create the service role.

### Health Endpoint Does Not Load

Open:

```text
App Runner > Services > soc5-pdf-to-png > Logs
```

Expected startup log:

```text
pdf-to-png converter listening on :8080
```

Also confirm:

```text
Port: 8080
PORT=8080
Health check path: /healthz
```

### Apps Script Gets Unauthorized

The token does not match.

Check both places:

```text
App Runner environment variable:
PDF_TO_PNG_SERVICE_TOKEN=...

Apps Script property:
PDF_TO_PNG_SERVICE_TOKEN=...
```

They must be identical.

### Apps Script Gets Not Found

The URL path is probably wrong.

Use:

```text
https://<app-runner-domain>/convert/pdf-to-png
```

Health should be:

```text
https://<app-runner-domain>/healthz
```

### Conversion Times Out

Increase:

```text
Memory:  1 GB
```

Then test again with `testPdfToPngServiceHealth` and `sendReportNow`.

### SeaTalk Message Sends Without Image

Check Apps Script properties:

```text
REPORT_SEND_IMAGE=true
PDF_TO_PNG_SERVICE_URL=https://<app-runner-domain>/convert/pdf-to-png
PDF_TO_PNG_SERVICE_TOKEN=<same token as App Runner>
```

Then check App Runner logs for converter errors.

## Cost Controls

Use these controls while testing:

```text
CPU:       0.25 vCPU
Memory:    0.5 GB
Deploy:    Manual
Services:  Keep only one active converter service
```

When you are not using the AWS converter, pause or delete the App Runner service to avoid ongoing cost.

Delete unused ECR images if you rebuild often.

## References

- AWS App Runner services from Amazon ECR: <https://docs.aws.amazon.com/apprunner/latest/dg/service-source-image.html>
- AWS App Runner environment variables: <https://docs.aws.amazon.com/apprunner/latest/dg/env-variable.html>
- AWS App Runner health checks: <https://docs.aws.amazon.com/apprunner/latest/dg/manage-configure-healthcheck.html>
- Amazon ECR private repositories: <https://docs.aws.amazon.com/AmazonECR/latest/userguide/Repositories.html>
- Amazon ECR IAM examples: <https://docs.aws.amazon.com/AmazonECR/latest/userguide/security_iam_id-based-policy-examples.html>
