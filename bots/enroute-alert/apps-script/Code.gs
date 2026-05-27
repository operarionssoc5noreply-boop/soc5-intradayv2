/**
 * Google Apps Script implementation for the enroute-alert SeaTalk bot.
 *
 * Configure values in Project Settings > Script properties, then run
 * installPollingTrigger() once from the Apps Script editor.
 */

const DEFAULTS = {
  BOT_NAME: 'enroute-alert',
  TIME_ZONE: 'Asia/Manila',
  SEATALK_API_BASE: 'https://openapi.seatalk.io',
  SEATALK_WELCOME_ON_ADD: 'false',
  GOOGLE_SPREADSHEET_ID: '',
  GOOGLE_GROUP_IDS_RANGE: 'bot_config!A2:A',
  GOOGLE_WATCH_RANGE: 'Summary Sheet (In progress)!AE6',
  GOOGLE_CAPTURE_RANGE: 'Summary Sheet (In progress)!C2:V62',
  GOOGLE_WINDOW_VALUE_RANGE: 'Summary Sheet (In progress)!O1',
  GOOGLE_DETAIL_LINE_1_RANGE: 'Summary Sheet (In progress)!V3',
  GOOGLE_DETAIL_LINE_2_RANGE: 'Summary Sheet (In progress)!V4',
  GOOGLE_DETAIL_LINE_3_RANGE: 'Summary Sheet (In progress)!V5',
  GOOGLE_EXPORT_LANDSCAPE: 'true',
  REPORT_SEND_IMAGE: 'true',
  REPORT_REQUIRE_IMAGE: 'true',
  REPORT_SETTLE_DELAY_SECONDS: '7',
  REPORT_TIMESTAMP_FORMAT: 'h:mma',
  REPORT_FIT_CAPTURE_RANGE_TO_PAGE: 'true',
  PDF_TO_PNG_SERVICE_URL: '',
  PDF_TO_PNG_SERVICE_TOKEN: '',
  BOT_PDF_DPI: '220',
  BOT_IMAGE_RESIZE_WIDTH: '2200',
  BOT_IMAGE_BORDER_PX: '20',
  SEATALK_MAX_BASE64_BYTES: String(5 * 1024 * 1024),
  WATCH_SNAPSHOT_PROPERTY: 'enroute_alert_watch_range_snapshot',
  BOT_LOGS_SHEET_NAME: 'bot_logs',
  BOT_DELAY_GRACE_MINUTES: '5',
};

function pollEnrouteAlertWatchRange() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.warn('Skipping enroute-alert poll because another poll is still running.');
    return { sent: false, changed: false, reason: 'lock_unavailable' };
  }

  try {
    const cfg = loadConfig_();
    const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
    const snapshot = snapshotRange_(spreadsheet, cfg.GOOGLE_WATCH_RANGE);
    const props = PropertiesService.getScriptProperties();
    const previousSnapshot = props.getProperty(cfg.WATCH_SNAPSHOT_PROPERTY);

    if (!previousSnapshot) {
      props.setProperty(cfg.WATCH_SNAPSHOT_PROPERTY, snapshot);
      console.log('Initialized enroute-alert watch snapshot for ' + cfg.GOOGLE_WATCH_RANGE + '. No report sent.');
      return { sent: false, changed: false, reason: 'initialized' };
    }

    if (previousSnapshot === snapshot) {
      console.log('No enroute-alert watch range change detected in ' + cfg.GOOGLE_WATCH_RANGE + '.');
      return { sent: false, changed: false, reason: 'unchanged' };
    }

    if (cfg.REPORT_SETTLE_DELAY_SECONDS > 0) {
      Utilities.sleep(cfg.REPORT_SETTLE_DELAY_SECONDS * 1000);
      SpreadsheetApp.flush();
    }

    const settledSnapshot = snapshotRange_(spreadsheet, cfg.GOOGLE_WATCH_RANGE);
    props.setProperty(cfg.WATCH_SNAPSHOT_PROPERTY, settledSnapshot);

    if (isWatchRangeZero_(spreadsheet, cfg)) {
      console.log('Enroute-alert watch range is 0 after change. No report sent.');
      return { sent: false, changed: true, reason: 'watch_range_zero' };
    }

    const result = sendEnrouteAlertWithConfig_(cfg, spreadsheet);
    return { sent: true, changed: true, result: result };
  } finally {
    lock.releaseLock();
  }
}

function sendEnrouteAlert() {
  const cfg = loadConfig_();
  const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  return sendEnrouteAlertWithConfig_(cfg, spreadsheet);
}

function sendReportNow() {
  return sendEnrouteAlert();
}

function initializeEnrouteAlertWatchSnapshot() {
  const cfg = loadConfig_();
  const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  const snapshot = snapshotRange_(spreadsheet, cfg.GOOGLE_WATCH_RANGE);
  PropertiesService.getScriptProperties().setProperty(cfg.WATCH_SNAPSHOT_PROPERTY, snapshot);
  console.log('Initialized enroute-alert watch snapshot for ' + cfg.GOOGLE_WATCH_RANGE + '.');
  return { watchRange: cfg.GOOGLE_WATCH_RANGE, initialized: true };
}

function clearEnrouteAlertWatchSnapshot() {
  const cfg = loadConfig_();
  PropertiesService.getScriptProperties().deleteProperty(cfg.WATCH_SNAPSHOT_PROPERTY);
  console.log('Cleared enroute-alert watch snapshot. The next poll will initialize without sending.');
  return { cleared: true };
}

function installPollingTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'pollEnrouteAlertWatchRange';
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger('pollEnrouteAlertWatchRange')
    .timeBased()
    .inTimezone(DEFAULTS.TIME_ZONE)
    .everyMinutes(5)
    .create();

  console.log('Installed five-minute polling trigger for pollEnrouteAlertWatchRange.');
}

function checkEnrouteAlertSetup() {
  const cfg = loadConfig_();
  const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  const groupIds = readConfigGroupIds_(spreadsheet, cfg);
  const pollTriggers = ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'pollEnrouteAlertWatchRange';
    });
  const props = PropertiesService.getScriptProperties();
  const summary = {
    botName: cfg.BOT_NAME,
    pollingTriggerInstalled: pollTriggers.length > 0,
    pollEnrouteAlertWatchRangeTriggers: pollTriggers.length,
    watchSnapshotInitialized: Boolean(props.getProperty(cfg.WATCH_SNAPSHOT_PROPERTY)),
    groupIdCount: groupIds.length,
    pdfToPngConfigured: Boolean(cfg.PDF_TO_PNG_SERVICE_URL),
    imageRequired: cfg.REPORT_SEND_IMAGE && cfg.REPORT_REQUIRE_IMAGE,
    spreadsheetId: cfg.GOOGLE_SPREADSHEET_ID,
    groupIdsRange: cfg.GOOGLE_GROUP_IDS_RANGE,
    watchRange: cfg.GOOGLE_WATCH_RANGE,
    captureRange: cfg.GOOGLE_CAPTURE_RANGE,
    watchRangeValue: readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_WATCH_RANGE),
    settleDelaySeconds: cfg.REPORT_SETTLE_DELAY_SECONDS,
    fitCaptureRangeToPage: cfg.REPORT_FIT_CAPTURE_RANGE_TO_PAGE,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (pollTriggers.length === 0) {
    throw new Error('No polling trigger found. Run installPollingTrigger once from the Apps Script editor.');
  }
  if (groupIds.length === 0) {
    throw new Error('No SeaTalk group IDs found in ' + cfg.GOOGLE_GROUP_IDS_RANGE + '.');
  }
  if (summary.imageRequired && !cfg.PDF_TO_PNG_SERVICE_URL) {
    throw new Error('Report image is required, but PDF_TO_PNG_SERVICE_URL is not configured.');
  }

  return summary;
}

function sendEnrouteAlertWithConfig_(cfg, spreadsheet) {
  if (isWatchRangeZero_(spreadsheet, cfg)) {
    console.log('Enroute-alert watch range is 0. No report sent.');
    return { sent: 0, errors: [], skipped: true, reason: 'watch_range_zero' };
  }

  const groupIds = readConfigGroupIds_(spreadsheet, cfg);
  if (groupIds.length === 0) {
    throw new Error('No SeaTalk group IDs found in ' + cfg.GOOGLE_GROUP_IDS_RANGE + '.');
  }

  const report = buildEnrouteAlertReport_(cfg, spreadsheet);
  const result = sendToGroups_(cfg, spreadsheet, groupIds, report);
  if (result.sent === 0) {
    throw new Error('Enroute alert was not sent to any SeaTalk group. ' + result.errors.join(' | '));
  }
  if (result.errors.length > 0) {
    console.warn('Enroute alert sent to ' + result.sent + ' group(s), with skipped/failed groups: ' + result.errors.join(' | '));
  }

  return result;
}

function buildEnrouteAlertReport_(cfg, spreadsheet) {
  return {
    text: buildEnrouteAlertText_(cfg, spreadsheet),
    image: buildEnrouteAlertImage_(cfg, spreadsheet),
  };
}

function buildEnrouteAlertText_(cfg, spreadsheet) {
  const windowValue = readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_WINDOW_VALUE_RANGE);
  const timestamp = Utilities.formatDate(new Date(), cfg.TIME_ZONE, cfg.REPORT_TIMESTAMP_FORMAT);
  const details = [
    readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_DETAIL_LINE_1_RANGE),
    readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_DETAIL_LINE_2_RANGE),
    readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_DETAIL_LINE_3_RANGE),
  ];

  return [
    'IB Expected Linehauls to Arrive within ' + windowValue + ' including Late Units as of ' + timestamp + ' Update.',
    '',
    '**' + details.join('\n') + '**',
  ].join('\n');
}

function buildEnrouteAlertImage_(cfg, spreadsheet) {
  if (!cfg.REPORT_SEND_IMAGE) {
    return '';
  }
  const pdfBlob = exportReportPdfForRange_(spreadsheet, cfg, cfg.GOOGLE_CAPTURE_RANGE, 'enroute-alert.pdf', cfg.REPORT_FIT_CAPTURE_RANGE_TO_PAGE);
  return tryConvertPdfToPng_(cfg, pdfBlob);
}

function snapshotRange_(spreadsheet, rangeName) {
  const values = getRange_(spreadsheet, rangeName).getDisplayValues();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(values),
    Utilities.Charset.UTF_8
  );
  return digest.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function isWatchRangeZero_(spreadsheet, cfg) {
  const watchValue = readRangeDisplayValue_(spreadsheet, cfg.GOOGLE_WATCH_RANGE);
  return isZeroDisplayValue_(watchValue);
}

function isZeroDisplayValue_(value) {
  const normalized = String(value || '').replace(/,/g, '').trim();
  return normalized !== '' && Number(normalized) === 0;
}

function exportReportPdfForRange_(spreadsheet, cfg, captureRange, pdfName, fitToPage) {
  const parsed = splitSheetRange_(captureRange);
  const sheet = parsed.sheetName ? spreadsheet.getSheetByName(parsed.sheetName) : spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error('Sheet not found for range ' + captureRange);
  }

  const params = {
    format: 'pdf',
    gid: String(sheet.getSheetId()),
    range: parsed.cellRange,
    size: '7',
    portrait: String(!cfg.GOOGLE_EXPORT_LANDSCAPE),
    sheetnames: 'false',
    printtitle: 'false',
    pagenumbers: 'false',
    gridlines: 'false',
    fzr: 'false',
  };
  if (fitToPage) {
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
  return response.getBlob().setName(pdfName);
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

function sendToGroups_(cfg, spreadsheet, groupIds, report) {
  const result = {
    sent: 0,
    errors: [],
  };

  groupIds.forEach(function(groupId) {
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
        console.warn('Skipping SeaTalk group ' + groupId + ': bot is not a member of this group chat. Add the bot to the group or remove this group ID from ' + cfg.GOOGLE_GROUP_IDS_RANGE + '.');
        return;
      }
      result.errors.push(groupId + ': ' + err.message);
      console.error('Failed sending to SeaTalk group ' + groupId + ': ' + err.message);
    }
  });

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
  const group = event.event && event.event.group ? event.event.group : {};
  const groupId = group.group_id || event.event.group_id || '';
  if (!groupId) {
    return;
  }

  const groupName = group.group_name || event.event.group_name || '';
  storeGroupId_(cfg, groupId, groupName);

  if (!cfg.SEATALK_WELCOME_ON_ADD) {
    return;
  }

  postSeatalkJson_(cfg, '/messaging/v2/group_chat_typing', { group_id: groupId });
  sendText_(cfg, groupId, cfg.BOT_NAME + ' report bot is connected.', false);
}

function storeGroupId_(cfg, groupId, groupName) {
  const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  const range = getRange_(spreadsheet, cfg.GOOGLE_GROUP_IDS_RANGE);
  const values = range.getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === groupId) {
      console.log('SeaTalk group already exists in ' + cfg.GOOGLE_GROUP_IDS_RANGE + ': ' + groupId);
      return;
    }
  }

  const sheet = range.getSheet();
  const column = range.getColumn();
  const startRow = range.getRow();
  let targetRow = startRow;

  for (let i = 0; i < values.length; i++) {
    if (!String(values[i][0] || '').trim()) {
      targetRow = startRow + i;
      break;
    }
    targetRow = startRow + values.length;
  }

  if (targetRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), targetRow - sheet.getMaxRows());
  }

  sheet.getRange(targetRow, column).setValue(groupId);
  if (groupName) {
    if (column + 1 > sheet.getMaxColumns()) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), column + 1 - sheet.getMaxColumns());
    }
    sheet.getRange(targetRow, column + 1).setValue(groupName);
    console.log('Stored SeaTalk group ' + groupName + ' (' + groupId + ') in ' + sheet.getName() + '!' + sheet.getRange(targetRow, column).getA1Notation());
  } else {
    console.log('Stored SeaTalk group ' + groupId + ' in ' + sheet.getName() + '!' + sheet.getRange(targetRow, column).getA1Notation());
  }
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
  cfg.SEATALK_WELCOME_ON_ADD = parseBool_(cfg.SEATALK_WELCOME_ON_ADD);
  cfg.GOOGLE_EXPORT_LANDSCAPE = parseBool_(cfg.GOOGLE_EXPORT_LANDSCAPE);
  cfg.REPORT_SEND_IMAGE = parseBool_(cfg.REPORT_SEND_IMAGE);
  cfg.REPORT_REQUIRE_IMAGE = parseBool_(cfg.REPORT_REQUIRE_IMAGE);
  cfg.REPORT_SETTLE_DELAY_SECONDS = Number(cfg.REPORT_SETTLE_DELAY_SECONDS);
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

function readConfigGroupIds_(spreadsheet, cfg) {
  const values = getRange_(spreadsheet, cfg.GOOGLE_GROUP_IDS_RANGE).getDisplayValues();
  const seen = {};
  const ids = [];

  values.forEach(function(row) {
    addGroupId_(row[0], seen, ids);
  });

  return ids;
}

function addGroupId_(value, seen, ids) {
  const groupId = String(value || '').trim();
  if (!groupId || seen[groupId]) {
    return;
  }
  seen[groupId] = true;
  ids.push(groupId);
}

function readRangeDisplayValue_(spreadsheet, rangeName) {
  return String(getRange_(spreadsheet, rangeName).getDisplayValue() || '').trim();
}

function getRange_(spreadsheet, rangeName) {
  const parsed = splitSheetRange_(rangeName);
  if (!parsed.sheetName) {
    return spreadsheet.getRange(parsed.cellRange);
  }

  const sheet = spreadsheet.getSheetByName(parsed.sheetName);
  if (!sheet) {
    throw new Error('Sheet not found for range ' + rangeName);
  }
  return sheet.getRange(parsed.cellRange);
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
