/**
 * Google Apps Script implementation for the onqueu-unloading_alert SeaTalk bot.
 *
 * Configure values in Project Settings > Script properties, then run
 * installTenMinuteTrigger() once from the Apps Script editor.
 */

const DEFAULTS = {
  BOT_NAME: 'onqueu-unloading_alert',
  TIME_ZONE: 'Asia/Manila',
  SEATALK_API_BASE: 'https://openapi.seatalk.io',
  SEATALK_GROUP_ID: 'NTg3MzEyNjUxMjE2',
  SEATALK_WELCOME_ON_ADD: 'false',
  GOOGLE_SPREADSHEET_ID: '1APnTQXUQvWpTwmOLIC9U17kwjQcWX0BPYZvlfUPOJrU',
  GOOGLE_CAPTURE_RANGE: 'bot_server!B2:M30',
  GOOGLE_ON_QUEUE_RANGE: 'bot_server!A16',
  GOOGLE_UNLOADING_RANGE: 'bot_server!A26',
  GOOGLE_SHEET_GID: '',
  GOOGLE_EXPORT_LANDSCAPE: 'true',
  REPORT_SEND_IMAGE: 'true',
  REPORT_REQUIRE_IMAGE: 'true',
  REPORT_FIT_CAPTURE_RANGE_TO_PAGE: 'true',
  PDF_TO_PNG_SERVICE_URL: '',
  PDF_TO_PNG_SERVICE_TOKEN: '',
  BOT_PDF_DPI: '220',
  BOT_IMAGE_RESIZE_WIDTH: '2200',
  BOT_IMAGE_BORDER_PX: '20',
  SEATALK_MAX_BASE64_BYTES: String(5 * 1024 * 1024),
  BOT_EXPECTED_SEND_INTERVAL_MINUTES: '10',
  BOT_LOGS_SHEET_NAME: 'bot_logs',
  BOT_DELAY_GRACE_MINUTES: '5',
};

function sendOnqueueUnloadingAlert() {
  const cfg = loadConfig_();
  const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  return sendOnqueueUnloadingAlertWithConfig_(cfg, spreadsheet);
}

function sendReportNow() {
  return sendOnqueueUnloadingAlert();
}

function installTenMinuteTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'sendOnqueueUnloadingAlert';
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger('sendOnqueueUnloadingAlert')
    .timeBased()
    .inTimezone(DEFAULTS.TIME_ZONE)
    .everyMinutes(10)
    .create();

  console.log('Installed ten-minute trigger for sendOnqueueUnloadingAlert.');
}

function installPollingTrigger() {
  return installTenMinuteTrigger();
}

function checkOnqueueUnloadingSetup() {
  const cfg = loadConfig_();
  const sendTriggers = ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'sendOnqueueUnloadingAlert';
    });
  const summary = {
    botName: cfg.BOT_NAME,
    tenMinuteTriggerInstalled: sendTriggers.length > 0,
    sendOnqueueUnloadingAlertTriggers: sendTriggers.length,
    targetGroupId: cfg.SEATALK_GROUP_ID,
    pdfToPngConfigured: Boolean(cfg.PDF_TO_PNG_SERVICE_URL),
    imageRequired: cfg.REPORT_SEND_IMAGE && cfg.REPORT_REQUIRE_IMAGE,
    spreadsheetId: cfg.GOOGLE_SPREADSHEET_ID,
    captureRange: cfg.GOOGLE_CAPTURE_RANGE,
    onQueueRange: cfg.GOOGLE_ON_QUEUE_RANGE,
    unloadingRange: cfg.GOOGLE_UNLOADING_RANGE,
    fitCaptureRangeToPage: cfg.REPORT_FIT_CAPTURE_RANGE_TO_PAGE,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (sendTriggers.length === 0) {
    throw new Error('No ten-minute trigger found. Run installTenMinuteTrigger once from the Apps Script editor.');
  }
  if (!cfg.SEATALK_GROUP_ID) {
    throw new Error('SEATALK_GROUP_ID is required.');
  }
  if (summary.imageRequired && !cfg.PDF_TO_PNG_SERVICE_URL) {
    throw new Error('Report image is required, but PDF_TO_PNG_SERVICE_URL is not configured.');
  }

  return summary;
}

function sendOnqueueUnloadingAlertWithConfig_(cfg, spreadsheet) {
  const report = buildOnqueueUnloadingReport_(cfg, spreadsheet);
  const result = sendToTargetGroup_(cfg, spreadsheet, report);
  if (result.sent === 0) {
    throw new Error('On-queue unloading alert was not sent. ' + result.errors.join(' | '));
  }
  if (result.errors.length > 0) {
    console.warn('On-queue unloading alert sent, with failed group result: ' + result.errors.join(' | '));
  }

  return result;
}

function buildOnqueueUnloadingReport_(cfg, spreadsheet) {
  return {
    text: buildOnqueueUnloadingText_(cfg, spreadsheet),
    image: buildOnqueueUnloadingImage_(cfg, spreadsheet),
  };
}

function buildOnqueueUnloadingText_(cfg, spreadsheet) {
  const onQueue = readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_ON_QUEUE_RANGE);
  const unloading = readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_UNLOADING_RANGE);

  return [
    ' ',
    '**On-Queue: ' + onQueue + '**',
    '** Unloading: ' + unloading + '**',
  ].join('\n');
}

function buildOnqueueUnloadingImage_(cfg, spreadsheet) {
  if (!cfg.REPORT_SEND_IMAGE) {
    return '';
  }
  const pdfBlob = exportReportPdfForRange_(spreadsheet, cfg, cfg.GOOGLE_CAPTURE_RANGE);
  return tryConvertPdfToPng_(cfg, pdfBlob);
}

function exportReportPdfForRange_(spreadsheet, cfg, captureRange) {
  const parsed = splitSheetRange_(captureRange);
  const sheet = parsed.sheetName ? spreadsheet.getSheetByName(parsed.sheetName) : spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error('Sheet not found for range ' + captureRange);
  }

  const params = {
    format: 'pdf',
    gid: cfg.GOOGLE_SHEET_GID || String(sheet.getSheetId()),
    range: parsed.cellRange,
    size: '7',
    portrait: String(!cfg.GOOGLE_EXPORT_LANDSCAPE),
    sheetnames: 'false',
    printtitle: 'false',
    pagenumbers: 'false',
    gridlines: 'false',
    fzr: 'false',
  };
  if (cfg.REPORT_FIT_CAPTURE_RANGE_TO_PAGE) {
    params.scale = '4';
  } else {
    params.fitw = 'true';
  }

  const query = Object.keys(params)
    .map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');
  const url = 'https://docs.google.com/spreadsheets/d/' +
    encodeURIComponent(cfg.GOOGLE_SPREADSHEET_ID) + '/export?' + query;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    },
    muteHttpExceptions: true,
  });

  assertOk_(response, 'Export Google Sheet PDF for ' + captureRange);
  return response.getBlob().setName('onqueu-unloading-alert.pdf');
}

function tryConvertPdfToPng_(cfg, pdfBlob) {
  try {
    return convertPdfToPng_(cfg, pdfBlob);
  } catch (err) {
    if (cfg.REPORT_REQUIRE_IMAGE) {
      throw err;
    }
    console.warn('Report image skipped: ' + err.message);
    return '';
  }
}

function convertPdfToPng_(cfg, pdfBlob) {
  if (!cfg.PDF_TO_PNG_SERVICE_URL) {
    if (cfg.REPORT_REQUIRE_IMAGE) {
      throw new Error('REPORT_SEND_IMAGE is enabled but PDF_TO_PNG_SERVICE_URL is not configured');
    }
    return '';
  }

  const headers = {};
  if (cfg.PDF_TO_PNG_SERVICE_TOKEN) {
    headers.Authorization = 'Bearer ' + cfg.PDF_TO_PNG_SERVICE_TOKEN;
  }

  const response = UrlFetchApp.fetch(cfg.PDF_TO_PNG_SERVICE_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({
      filename: pdfBlob.getName(),
      pdf_base64: Utilities.base64Encode(pdfBlob.getBytes()),
      dpi: cfg.BOT_PDF_DPI,
      resize_width: cfg.BOT_IMAGE_RESIZE_WIDTH,
      border_px: cfg.BOT_IMAGE_BORDER_PX,
    }),
    muteHttpExceptions: true,
  });

  assertOk_(response, 'PDF to PNG service');
  const decoded = JSON.parse(response.getContentText() || '{}');
  const imageBase64 = normalizeBase64_(decoded.image_base64 || decoded.png_base64 || decoded.content || '');

  if (!imageBase64) {
    throw new Error('PDF to PNG service response missing image_base64');
  }
  if (imageBase64.length > cfg.SEATALK_MAX_BASE64_BYTES) {
    if (cfg.REPORT_REQUIRE_IMAGE) {
      throw new Error('Image is ' + imageBase64.length + ' bytes, over limit ' + cfg.SEATALK_MAX_BASE64_BYTES);
    }
    return '';
  }

  return imageBase64;
}

function sendToTargetGroup_(cfg, spreadsheet, report) {
  const result = {
    sent: 0,
    errors: [],
  };
  const groupId = cfg.SEATALK_GROUP_ID;

  try {
    sendText_(cfg, groupId, report.text, true);
    if (report.image) {
      sendImage_(cfg, groupId, report.image);
    }
    if (typeof logBotSend_ === 'function') {
      try {
        logBotSend_(spreadsheet, cfg, groupId);
      } catch (logErr) {
        console.warn('Failed writing bot log for ' + groupId + ': ' + logErr.message);
      }
    }
    result.sent++;
  } catch (err) {
    if (typeof logBotFailure_ === 'function') {
      try {
        logBotFailure_(spreadsheet, cfg, groupId, err);
      } catch (logErr) {
        console.warn('Failed writing bot failure log for ' + groupId + ': ' + logErr.message);
      }
    }
    if (err.seatalkCode === 7001) {
      result.errors.push(groupId + ': bot is not a member of this group chat');
      console.warn('Skipping SeaTalk group ' + groupId + ': bot is not a member of this group chat. Add the bot to this group.');
      return result;
    }
    result.errors.push(groupId + ': ' + err.message);
    console.error('Failed sending to SeaTalk group ' + groupId + ': ' + err.message);
  }

  return result;
}

function sendText_(cfg, groupId, content, atAll) {
  const textPayload = {
    format: 1,
    content: content,
  };
  if (atAll) {
    textPayload.at_all = true;
  }

  return postSeatalkJson_(cfg, '/messaging/v2/group_chat', {
    group_id: groupId,
    message: {
      tag: 'text',
      text: textPayload,
    },
  });
}

function sendImage_(cfg, groupId, contentBase64) {
  return postSeatalkJson_(cfg, '/messaging/v2/group_chat', {
    group_id: groupId,
    message: {
      tag: 'image',
      image: {
        content: contentBase64,
      },
    },
  });
}

function doPost(e) {
  const body = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  const event = JSON.parse(body);

  if (event.event_type === 'event_verification') {
    return textResponse_(extractChallenge_(event));
  }

  if (event.event_type === 'bot_added_to_group_chat') {
    handleBotAdded_(event);
  }

  return jsonResponse_({});
}

function handleBotAdded_(event) {
  const cfg = loadConfig_();
  if (!cfg.SEATALK_WELCOME_ON_ADD) {
    return;
  }

  const group = event.event && event.event.group ? event.event.group : {};
  const groupId = group.group_id || event.event.group_id || '';
  if (!groupId || groupId !== cfg.SEATALK_GROUP_ID) {
    return;
  }

  postSeatalkJson_(cfg, '/messaging/v2/group_chat_typing', { group_id: groupId });
  sendText_(cfg, groupId, cfg.BOT_NAME + ' report bot is connected.', false);
}

function loadConfig_() {
  const props = PropertiesService.getScriptProperties();
  const cfg = {};

  Object.keys(DEFAULTS).forEach(function(key) {
    cfg[key] = props.getProperty(key) || DEFAULTS[key];
  });

  cfg.SEATALK_APP_ID = props.getProperty('SEATALK_APP_ID') || '';
  cfg.SEATALK_APP_SECRET = props.getProperty('SEATALK_APP_SECRET') || '';
  cfg.SEATALK_API_BASE = cfg.SEATALK_API_BASE.replace(/\/+$/, '');
  cfg.SEATALK_GROUP_ID = String(cfg.SEATALK_GROUP_ID || '').trim();
  cfg.SEATALK_WELCOME_ON_ADD = parseBool_(cfg.SEATALK_WELCOME_ON_ADD);
  cfg.GOOGLE_EXPORT_LANDSCAPE = parseBool_(cfg.GOOGLE_EXPORT_LANDSCAPE);
  cfg.REPORT_SEND_IMAGE = parseBool_(cfg.REPORT_SEND_IMAGE);
  cfg.REPORT_REQUIRE_IMAGE = parseBool_(cfg.REPORT_REQUIRE_IMAGE);
  cfg.REPORT_FIT_CAPTURE_RANGE_TO_PAGE = parseBool_(cfg.REPORT_FIT_CAPTURE_RANGE_TO_PAGE);
  cfg.PDF_TO_PNG_SERVICE_URL = normalizeConverterUrl_(cfg.PDF_TO_PNG_SERVICE_URL);
  cfg.BOT_PDF_DPI = Number(cfg.BOT_PDF_DPI);
  cfg.BOT_IMAGE_RESIZE_WIDTH = Number(cfg.BOT_IMAGE_RESIZE_WIDTH);
  cfg.BOT_IMAGE_BORDER_PX = Number(cfg.BOT_IMAGE_BORDER_PX);
  cfg.SEATALK_MAX_BASE64_BYTES = Number(cfg.SEATALK_MAX_BASE64_BYTES);

  const missing = [];
  ['SEATALK_APP_ID', 'SEATALK_APP_SECRET', 'GOOGLE_SPREADSHEET_ID'].forEach(function(key) {
    if (!cfg[key]) {
      missing.push(key);
    }
  });
  if (missing.length > 0) {
    throw new Error('Missing script properties: ' + missing.join(', '));
  }

  return cfg;
}

function readRangeDisplayValue_(spreadsheet, rangeName) {
  return String(spreadsheet.getRange(rangeName).getDisplayValue() || '').trim();
}

function splitSheetRange_(input) {
  const parts = String(input || '').split('!');
  if (parts.length === 1) {
    return { sheetName: '', cellRange: stripQuotes_(parts[0]) };
  }
  return { sheetName: stripQuotes_(parts[0]), cellRange: stripQuotes_(parts.slice(1).join('!')) };
}

function stripQuotes_(value) {
  return String(value || '').replace(/^'/, '').replace(/'$/, '');
}

function postSeatalkJson_(cfg, path, payload) {
  const response = UrlFetchApp.fetch(cfg.SEATALK_API_BASE + path, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + seatalkToken_(cfg),
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  assertOk_(response, 'SeaTalk API ' + path);
  const decoded = JSON.parse(response.getContentText() || '{}');
  if (decoded.code !== 0) {
    const err = new Error('SeaTalk API code ' + decoded.code + ': ' + response.getContentText());
    err.seatalkCode = decoded.code;
    err.seatalkMessage = decoded.message || '';
    throw err;
  }
  return decoded;
}

function seatalkToken_(cfg) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('seatalk_app_access_token');
  if (cached) {
    return cached;
  }

  const response = UrlFetchApp.fetch(cfg.SEATALK_API_BASE + '/auth/app_access_token', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      app_id: cfg.SEATALK_APP_ID,
      app_secret: cfg.SEATALK_APP_SECRET,
    }),
    muteHttpExceptions: true,
  });

  assertOk_(response, 'SeaTalk app access token');
  const decoded = JSON.parse(response.getContentText() || '{}');
  if (decoded.code !== 0 || !decoded.app_access_token) {
    throw new Error('SeaTalk token failed: ' + response.getContentText());
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = decoded.expire ? Math.max(60, Math.min(21600, Number(decoded.expire) - nowSeconds - 120)) : 5400;
  cache.put('seatalk_app_access_token', decoded.app_access_token, ttl);
  return decoded.app_access_token;
}

function testPdfToPngServiceHealth() {
  const cfg = loadConfig_();
  if (!cfg.PDF_TO_PNG_SERVICE_URL) {
    throw new Error('PDF_TO_PNG_SERVICE_URL is not configured');
  }

  const healthUrl = cfg.PDF_TO_PNG_SERVICE_URL.replace(/\/convert\/pdf-to-png$/, '/healthz');
  const response = UrlFetchApp.fetch(healthUrl, {
    method: 'get',
    muteHttpExceptions: true,
  });

  assertOk_(response, 'PDF to PNG health check');
  console.log(response.getContentText());
  return response.getContentText();
}

function assertOk_(response, label) {
  const status = response.getResponseCode();
  if (status >= 300) {
    throw new Error(label + ' HTTP ' + status + ': ' + response.getContentText());
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function textResponse_(text) {
  return ContentService
    .createTextOutput(String(text || ''))
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseBool_(value) {
  return String(value).toLowerCase() === 'true';
}

function normalizeBase64_(value) {
  return String(value || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
}

function normalizeConverterUrl_(value) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url) {
    return '';
  }
  if (/\/convert\/pdf-to-png$/.test(url)) {
    return url;
  }
  return url + '/convert/pdf-to-png';
}

function extractChallenge_(event) {
  return event.challenge ||
    (event.event && event.event.challenge) ||
    (event.event && event.event.seatalk_challenge) ||
    (event.data && event.data.challenge) ||
    '';
}
