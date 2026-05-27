# Third-Party PDF Converter Setup Guide

This guide replaces the Docker-based PDF-to-PNG converter with a hosted conversion API.

Use this path when:

- Azure Container Apps is unavailable.
- You do not want to deploy Docker on Cloud Run, Render, or another host.
- You are comfortable sending the exported report PDF to a third-party API.
- You want Apps Script to call the conversion provider directly.

Recommended order:

```text
1. ConvertAPI
2. PDF.co
```

ConvertAPI is the simpler first choice for this project because it accepts a PDF file upload directly in the conversion request. PDF.co is a good fallback, but it normally needs a temporary file upload step before conversion.

## Important Compatibility Note

The current Docker converter accepts:

```text
POST /convert/pdf-to-png
Authorization: Bearer <PDF_TO_PNG_SERVICE_TOKEN>
Body: {"pdf_base64":"..."}
Response: {"image_base64":"..."}
```

ConvertAPI and PDF.co do not return that same shape. You cannot fix this by setting `PDF_TO_PNG_SERVICE_URL` to a ConvertAPI or PDF.co URL.

To use these providers, update each bot's Apps Script `convertPdfToPng_` function with one of the snippets in this guide.

## Image Quality Settings

Use PNG for report screenshots because Google Sheet exports contain text, borders, and colored cells.

Suggested settings:

```text
Format: PNG
DPI / resolution: 220
Maximum SeaTalk base64 size: 5242880
```

If the image is too large for SeaTalk, reduce the DPI:

```text
BOT_PDF_DPI=180
```

If text is blurry, increase the DPI:

```text
BOT_PDF_DPI=260
```

## Multi-Page PDF Warning

The Docker converter renders all PDF pages and stitches them vertically into one PNG.

ConvertAPI and PDF.co return one image per PDF page. The snippets below use only the first page:

```text
ConvertAPI PageRange: 1
PDF.co pages: 0
```

For best results, keep each bot's Google export range to one PDF page. If a bot needs multiple PDF pages stitched into one image, keep using a Docker converter or add custom Apps Script logic to combine images.

## Shared Apps Script Checklist

For each bot you migrate:

1. Open that bot's Apps Script project.
2. Open `Code.gs`.
3. Find the existing function:

```text
convertPdfToPng_(cfg, pdfBlob)
```

4. Replace only that function with the ConvertAPI or PDF.co version below.
5. Add the helper functions below the replacement function.
6. Keep the existing functions that call `convertPdfToPng_`, such as:

```text
tryConvertPdfToPng_
sendReportNow
```

7. Keep image properties enabled:

```text
REPORT_SEND_IMAGE=true
```

For Intraday and OTP, also keep:

```text
REPORT_INLINE_CARD_IMAGE=true
REPORT_REQUIRE_INLINE_CARD_IMAGE=true
```

For most other bots, keep:

```text
REPORT_REQUIRE_IMAGE=true
```

8. Set `PDF_TO_PNG_SERVICE_URL` to any non-empty placeholder so existing setup checks that only verify "configured" still pass:

```text
PDF_TO_PNG_SERVICE_URL=third-party-api
```

The replacement functions below do not call `PDF_TO_PNG_SERVICE_URL`.

Do not commit API keys into this repository. Store them only in Apps Script Script Properties.

# Option 1: ConvertAPI

Use ConvertAPI first unless you have a reason to prefer PDF.co.

## What ConvertAPI Does

Apps Script sends the PDF blob directly to ConvertAPI:

```text
Apps Script PDF blob
  -> ConvertAPI /convert/pdf/to/png
  -> temporary PNG URL
  -> Apps Script downloads PNG
  -> Apps Script base64-encodes PNG for SeaTalk
```

## 1. Create A ConvertAPI Account

1. Open <https://www.convertapi.com>.
2. Sign up or sign in.
3. Open the ConvertAPI dashboard.
4. Open the API token/authentication area.
5. Create or copy an API token.

ConvertAPI authenticates conversion requests with:

```text
Authorization: Bearer <api_token>
```

## 2. Configure Apps Script Properties

In Apps Script, open **Project Settings > Script properties** and set:

```text
CONVERTAPI_TOKEN=<your ConvertAPI API token>
PDF_TO_PNG_SERVICE_URL=third-party-api
BOT_PDF_DPI=220
SEATALK_MAX_BASE64_BYTES=5242880
```

You no longer need `PDF_TO_PNG_SERVICE_TOKEN` for ConvertAPI, but leaving it in Script Properties does not hurt.

## 3. Replace `convertPdfToPng_`

In the bot's `Code.gs`, replace the existing `convertPdfToPng_(cfg, pdfBlob)` function with this:

```javascript
function convertPdfToPng_(cfg, pdfBlob) {
  const token = PropertiesService.getScriptProperties().getProperty('CONVERTAPI_TOKEN');
  if (!token) {
    throw new Error('CONVERTAPI_TOKEN is not configured in Script Properties.');
  }

  const response = UrlFetchApp.fetch('https://v2.convertapi.com/convert/pdf/to/png', {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + token,
    },
    payload: {
      File: pdfBlob.setName('report.pdf'),
      StoreFile: 'true',
      PageRange: '1',
      ImageResolution: String(cfg.BOT_PDF_DPI || 220),
      BackgroundColor: 'white',
    },
  });

  const decoded = parseJsonResponse_(response, 'ConvertAPI PDF to PNG');
  const files = decoded.Files || decoded.files || [];
  const firstFile = files[0] || {};
  const pngUrl = firstFile.Url || firstFile.url;

  if (!pngUrl) {
    throw new Error('ConvertAPI response missing Files[0].Url: ' + JSON.stringify(decoded));
  }

  const imageResponse = UrlFetchApp.fetch(pngUrl, {
    method: 'get',
    muteHttpExceptions: true,
  });

  if (imageResponse.getResponseCode() < 200 || imageResponse.getResponseCode() >= 300) {
    throw new Error('ConvertAPI PNG download failed: HTTP ' + imageResponse.getResponseCode() + ' ' + imageResponse.getContentText());
  }

  const imageBase64 = Utilities.base64Encode(imageResponse.getBlob().getBytes());
  if (imageBase64.length > cfg.SEATALK_MAX_BASE64_BYTES) {
    throw new Error('Image is ' + imageBase64.length + ' bytes, over limit ' + cfg.SEATALK_MAX_BASE64_BYTES);
  }

  return imageBase64;
}
```

## 4. Add Shared Helper Function

Add this helper anywhere below `convertPdfToPng_`:

```javascript
  function parseJsonResponse_(response, label) {
    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error(label + ' failed: HTTP ' + code + ' ' + body);
    }

    try {
      return JSON.parse(body);
    } catch (err) {
      throw new Error(label + ' returned invalid JSON: ' + body);
    }
  }
```

If your `Code.gs` already has a helper with the same name, reuse the existing helper or rename this one.

## 5. Add A ConvertAPI Test Function

Add this temporary test function:

```javascript
  function testThirdPartyPdfToPng() {
    const cfg = loadConfig_();
    const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
    const pdfBlob = exportReportPdf_(spreadsheet, cfg);
    const imageBase64 = convertPdfToPng_(cfg, pdfBlob);

    console.log(JSON.stringify({
      ok: true,
      provider: 'convertapi',
      imageBase64Bytes: imageBase64.length,
    }, null, 2));
  }
```

Run:

```text
testThirdPartyPdfToPng
```

Expected log:

```json
{
  "ok": true,
  "provider": "convertapi",
  "imageBase64Bytes": 123456
}
```

Then run:

```text
sendReportNow
```

Check SeaTalk for the report image.

## ConvertAPI Troubleshooting

### HTTP 401

`CONVERTAPI_TOKEN` is missing or wrong.

Check Apps Script Script Properties:

```text
CONVERTAPI_TOKEN=<your token>
```

### HTTP 403

The token is valid, but the account may have no remaining conversions or the token does not have access.

Check the ConvertAPI dashboard.

### Response Missing `Files[0].Url`

Confirm this parameter is sent:

```text
StoreFile=true
```

The snippet uses `StoreFile=true` so Apps Script can download the converted PNG from ConvertAPI's temporary URL.

### Image Is Too Large For SeaTalk

Lower the render DPI:

```text
BOT_PDF_DPI=180
```

Then rerun:

```text
testThirdPartyPdfToPng
```

### Only First Page Appears

The snippet uses:

```text
PageRange=1
```

This is intentional. Keep the Google export range to one page, or keep using the Docker converter if you need multi-page stitching.

# Option 2: PDF.co

Use PDF.co if ConvertAPI is unavailable, blocked, too costly, or not approved.

## What PDF.co Does

PDF.co's PDF-to-PNG endpoint expects a URL to the source PDF. Apps Script first uploads the generated PDF as a temporary file, then asks PDF.co to convert that temporary file:

```text
Apps Script PDF blob
  -> PDF.co /file/upload/base64
  -> temporary PDF URL
  -> PDF.co /pdf/convert/to/png
  -> temporary PNG URL
  -> Apps Script downloads PNG
  -> Apps Script base64-encodes PNG for SeaTalk
```

## 1. Create A PDF.co Account

1. Open <https://pdf.co>.
2. Sign up or sign in.
3. Open the PDF.co dashboard.
4. Copy your API key.

PDF.co authenticates requests with:

```text
x-api-key: <api-key>
```

## 2. Configure Apps Script Properties

In Apps Script, open **Project Settings > Script properties** and set:

```text
PDFCO_API_KEY=<your PDF.co API key>
PDF_TO_PNG_SERVICE_URL=third-party-api
BOT_PDF_DPI=220
SEATALK_MAX_BASE64_BYTES=5242880
```

You no longer need `PDF_TO_PNG_SERVICE_TOKEN` for PDF.co, but leaving it in Script Properties does not hurt.

## 3. Replace `convertPdfToPng_`

In the bot's `Code.gs`, replace the existing `convertPdfToPng_(cfg, pdfBlob)` function with this:

```javascript
function convertPdfToPng_(cfg, pdfBlob) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('PDFCO_API_KEY');
  if (!apiKey) {
    throw new Error('PDFCO_API_KEY is not configured in Script Properties.');
  }

  const uploadResponse = UrlFetchApp.fetch('https://api.pdf.co/v1/file/upload/base64', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-api-key': apiKey,
    },
    payload: JSON.stringify({
      name: 'report.pdf',
      file: Utilities.base64Encode(pdfBlob.getBytes()),
      expiration: 60,
    }),
  });

  const upload = parseJsonResponse_(uploadResponse, 'PDF.co file upload');
  if (upload.error) {
    throw new Error('PDF.co file upload failed: ' + JSON.stringify(upload));
  }
  if (!upload.url) {
    throw new Error('PDF.co file upload response missing url: ' + JSON.stringify(upload));
  }

  const convertResponse = UrlFetchApp.fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-api-key': apiKey,
    },
    payload: JSON.stringify({
      url: upload.url,
      pages: '0',
      async: false,
      inline: false,
      expiration: 60,
      profiles: JSON.stringify({
        RenderingResolution: Number(cfg.BOT_PDF_DPI || 220),
        RenderTextObjects: true,
        RenderVectorObjects: true,
        RenderImageObjects: true,
        TextSmoothingMode: 'HighQuality',
        VectorSmoothingMode: 'HighQuality',
        ImageInterpolationMode: 'HighQuality',
      }),
    }),
  });

  const converted = parseJsonResponse_(convertResponse, 'PDF.co PDF to PNG');
  if (converted.error) {
    throw new Error('PDF.co PDF to PNG failed: ' + JSON.stringify(converted));
  }

  const urls = converted.urls || converted.Urls || [];
  const pngUrl = urls[0];
  if (!pngUrl) {
    throw new Error('PDF.co response missing urls[0]: ' + JSON.stringify(converted));
  }

  const imageResponse = UrlFetchApp.fetch(pngUrl, {
    method: 'get',
    muteHttpExceptions: true,
  });

  if (imageResponse.getResponseCode() < 200 || imageResponse.getResponseCode() >= 300) {
    throw new Error('PDF.co PNG download failed: HTTP ' + imageResponse.getResponseCode() + ' ' + imageResponse.getContentText());
  }

  const imageBase64 = Utilities.base64Encode(imageResponse.getBlob().getBytes());
  if (imageBase64.length > cfg.SEATALK_MAX_BASE64_BYTES) {
    throw new Error('Image is ' + imageBase64.length + ' bytes, over limit ' + cfg.SEATALK_MAX_BASE64_BYTES);
  }

  return imageBase64;
}
```

## 4. Add Shared Helper Function

Add this helper anywhere below `convertPdfToPng_`:

```javascript
function parseJsonResponse_(response, label) {
  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error(label + ' failed: HTTP ' + code + ' ' + body);
  }

  try {
    return JSON.parse(body);
  } catch (err) {
    throw new Error(label + ' returned invalid JSON: ' + body);
  }
}
```

If your `Code.gs` already has a helper with the same name, reuse the existing helper or rename this one.

## 5. Add A PDF.co Test Function

Add this temporary test function:

```javascript
function testThirdPartyPdfToPng() {
  const cfg = loadConfig_();
  const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  const pdfBlob = exportReportPdf_(spreadsheet, cfg);
  const imageBase64 = convertPdfToPng_(cfg, pdfBlob);

  console.log(JSON.stringify({
    ok: true,
    provider: 'pdf.co',
    imageBase64Bytes: imageBase64.length,
  }, null, 2));
}
```

Run:

```text
testThirdPartyPdfToPng
```

Expected log:

```json
{
  "ok": true,
  "provider": "pdf.co",
  "imageBase64Bytes": 123456
}
```

Then run:

```text
sendReportNow
```

Check SeaTalk for the report image.

## PDF.co Troubleshooting

### HTTP 401

`PDFCO_API_KEY` is missing or wrong.

Check Apps Script Script Properties:

```text
PDFCO_API_KEY=<your API key>
```

### Upload Works But Conversion Fails

Confirm the upload response contains:

```text
url
```

The PDF-to-PNG conversion endpoint needs this temporary file URL.

### Response Missing `urls[0]`

Check the PDF.co conversion response in the Apps Script logs.

Common causes:

```text
The source PDF temporary URL expired
The PDF was too large
The PDF.co account has no remaining credits
The selected pages value is invalid
```

### Image Is Too Large For SeaTalk

Lower the render DPI:

```text
BOT_PDF_DPI=180
```

Then rerun:

```text
testThirdPartyPdfToPng
```

### Only First Page Appears

The snippet uses:

```text
pages=0
```

PDF.co uses zero-based page indexes, so `0` means the first page. Keep the Google export range to one page, or keep using the Docker converter if you need multi-page stitching.

## Choosing Between ConvertAPI And PDF.co

Use ConvertAPI when:

- You want the simplest Apps Script integration.
- You want one conversion request plus one PNG download.
- You want direct `PDF -> PNG` conversion with resolution controls.

Use PDF.co when:

- ConvertAPI is not approved or unavailable.
- You prefer PDF.co's document API ecosystem.
- You need PDF.co-specific options, temporary file storage, or other PDF tools.

Use the Docker converter instead when:

- Reports contain sensitive data that should not be sent to a third party.
- You need multi-page PDF stitching into one PNG.
- You need full control of ImageMagick trimming, borders, and resizing.

## Security Notes

Third-party APIs receive a copy of the exported report PDF. Before using either provider, confirm your company allows SOC report data to be processed by that service.

Keep API keys in Apps Script Script Properties only:

```text
CONVERTAPI_TOKEN=...
PDFCO_API_KEY=...
```

Do not put API keys in:

```text
Code.gs
GitHub
Google Sheets cells
Shared screenshots
SeaTalk messages
```

## References

- ConvertAPI PDF to PNG API: <https://www.convertapi.com/pdf-to-png>
- ConvertAPI authentication: <https://docs.convertapi.com/docs/authentication>
- PDF.co PDF to PNG API: <https://docs.pdf.co/api-reference/pdf-to-image/png>
- PDF.co file upload overview: <https://docs.pdf.co/api-reference/file-upload/overview>
- PDF.co base64 upload endpoint: <https://docs.pdf.co/api-reference/file-upload/upload-base64>
