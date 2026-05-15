/**
 * Shared Apps Script helper for writing bot send events to `bot_logs`.
 *
 * Optional New Relic forwarding:
 *   NEW_RELIC_LICENSE_KEY=<new-relic-license-key>
 *   NEW_RELIC_LOG_API_URL=https://log-api.newrelic.com/log/v1
 *
 * Add this file to each bot's Apps Script project alongside Code.gs.
 */

const BOT_LOGS_COLUMNS_ = [
  'bot_name',
  'target_group_id',
  'group_name',
  'sent_timestamp',
  'interval_from_previous_sent',
  'reason_for_delay',
  'success',
  'failed',
  'status',
  'error_message',
  'new_relic_sent',
];

function logBotSend_(spreadsheet, cfg, groupId, groupName, sentAt, reasonForDelay) {
  return logBotEvent_(spreadsheet, cfg, {
    targetGroupId: groupId,
    groupName: groupName,
    status: 'success',
    eventAt: sentAt || new Date(),
    reasonForDelay: reasonForDelay || '',
    errorMessage: '',
  });
}

function logBotFailure_(spreadsheet, cfg, groupId, error, groupName) {
  return logBotEvent_(spreadsheet, cfg, {
    targetGroupId: groupId,
    groupName: groupName,
    status: 'failure',
    eventAt: new Date(),
    reasonForDelay: '',
    errorMessage: botLogErrorMessage_(error),
  });
}

function logBotEvent_(spreadsheet, cfg, event) {
  event = event || {};
  const targetGroupId = String(event.targetGroupId || '').trim();
  if (!targetGroupId) {
    return;
  }

  const book = spreadsheet || SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  const sheet = getOrCreateBotLogsSheet_(book, cfg);
  const botName = String((cfg && cfg.BOT_NAME) || 'unknown').trim();
  const timestamp = event.eventAt || new Date();
  const status = String(event.status || 'success').trim().toLowerCase();
  const resolvedGroupName = resolveBotLogGroupName_(book, cfg, targetGroupId, event.groupName);
  const previousSentAt = status === 'success' ? findPreviousBotSentAt_(sheet, botName, targetGroupId) : null;
  const interval = previousSentAt ? timestamp.getTime() - previousSentAt.getTime() : null;
  const intervalText = interval === null ? '' : formatBotLogDuration_(interval);
  const delayReason = event.reasonForDelay || botLogDelayReason_(cfg, interval);
  const errorMessage = String(event.errorMessage || '').trim();
  const successValue = status === 'success' ? 1 : 0;
  const failedValue = status === 'failure' ? 1 : 0;
  const newRelicSent = pushBotLogToNewRelic_(cfg, {
    botName: botName,
    targetGroupId: targetGroupId,
    groupName: resolvedGroupName,
    status: status,
    success: successValue,
    failed: failedValue,
    timestamp: timestamp,
    intervalFromPreviousSent: intervalText,
    reasonForDelay: delayReason,
    errorMessage: errorMessage,
  });

  appendBotLogRow_(sheet, {
    bot_name: botName,
    target_group_id: targetGroupId,
    group_name: resolvedGroupName,
    sent_timestamp: timestamp,
    interval_from_previous_sent: intervalText,
    reason_for_delay: delayReason,
    success: successValue,
    failed: failedValue,
    status: status,
    error_message: errorMessage,
    new_relic_sent: newRelicSent ? 'yes' : 'no',
  });

  const row = sheet.getLastRow();
  const sentTimestampColumn = findBotLogColumn_(sheet, 'sent_timestamp');
  if (sentTimestampColumn > 0) {
    sheet.getRange(row, sentTimestampColumn).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
}

function getOrCreateBotLogsSheet_(spreadsheet, cfg) {
  const sheetName = String((cfg && cfg.BOT_LOGS_SHEET_NAME) || 'bot_logs').trim();
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const headerWidth = Math.max(sheet.getLastColumn(), BOT_LOGS_COLUMNS_.length);
  const headerRange = sheet.getRange(1, 1, 1, headerWidth);
  const currentHeader = headerRange.getDisplayValues()[0];
  const hasHeader = currentHeader.some(function(value) {
    return String(value || '').trim();
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, BOT_LOGS_COLUMNS_.length).setValues([BOT_LOGS_COLUMNS_]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  BOT_LOGS_COLUMNS_.forEach(function(columnName) {
    if (currentHeader.indexOf(columnName) !== -1) {
      return;
    }
    const nextColumn = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextColumn).setValue(columnName);
  });

  return sheet;
}

function appendBotLogRow_(sheet, valuesByColumn) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const row = headers.map(function(header) {
    const key = String(header || '').trim();
    return Object.prototype.hasOwnProperty.call(valuesByColumn, key) ? valuesByColumn[key] : '';
  });
  sheet.appendRow(row);
}

function findBotLogColumn_(sheet, columnName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const index = headers.indexOf(columnName);
  return index === -1 ? 0 : index + 1;
}

function resolveBotLogGroupName_(spreadsheet, cfg, groupId, groupName) {
  const provided = String(groupName || '').trim();
  if (provided) {
    return provided;
  }
  if (!cfg || !cfg.GOOGLE_GROUP_IDS_RANGE) {
    return '';
  }

  try {
    const range = spreadsheet.getRange(cfg.GOOGLE_GROUP_IDS_RANGE);
    const groupIds = range.getDisplayValues();
    const nameRange = range.offset(0, 1, range.getNumRows(), 1);
    const groupNames = nameRange.getDisplayValues();

    for (let i = 0; i < groupIds.length; i++) {
      if (String(groupIds[i][0] || '').trim() === groupId) {
        return String(groupNames[i][0] || '').trim();
      }
    }
  } catch (err) {
    console.warn('Unable to resolve group name for bot log: ' + err.message);
  }

  return '';
}

function findPreviousBotSentAt_(sheet, botName, groupId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const botNameIndex = headers.indexOf('bot_name');
  const groupIdIndex = headers.indexOf('target_group_id');
  const timestampIndex = headers.indexOf('sent_timestamp');
  const statusIndex = headers.indexOf('status');
  if (botNameIndex === -1 || groupIdIndex === -1 || timestampIndex === -1) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][botNameIndex] || '').trim() !== botName) {
      continue;
    }
    if (String(values[i][groupIdIndex] || '').trim() !== groupId) {
      continue;
    }
    if (statusIndex !== -1 && values[i][statusIndex] && String(values[i][statusIndex] || '').trim().toLowerCase() !== 'success') {
      continue;
    }
    if (values[i][timestampIndex] instanceof Date) {
      return values[i][timestampIndex];
    }
  }

  return null;
}

function botLogDelayReason_(cfg, intervalMs) {
  if (intervalMs === null || !cfg || !cfg.BOT_EXPECTED_SEND_INTERVAL_MINUTES) {
    return '';
  }

  const expectedMinutes = Number(cfg.BOT_EXPECTED_SEND_INTERVAL_MINUTES);
  if (!expectedMinutes || expectedMinutes <= 0) {
    return '';
  }

  const graceMinutes = Number(cfg.BOT_DELAY_GRACE_MINUTES || 5);
  const actualMinutes = intervalMs / 60000;
  if (actualMinutes <= expectedMinutes + graceMinutes) {
    return '';
  }

  return 'Sent after ' + Math.round(actualMinutes) +
    ' minutes; expected about ' + expectedMinutes + ' minutes';
}

function formatBotLogDuration_(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    padBotLogNumber_(hours),
    padBotLogNumber_(minutes),
    padBotLogNumber_(seconds),
  ].join(':');
}

function padBotLogNumber_(value) {
  return value < 10 ? '0' + value : String(value);
}

function pushBotLogToNewRelic_(cfg, event) {
  const licenseKey = botLogConfigValue_(cfg, 'NEW_RELIC_LICENSE_KEY');
  if (!licenseKey) {
    return false;
  }

  const url = normalizeNewRelicLogApiUrl_(botLogConfigValue_(cfg, 'NEW_RELIC_LOG_API_URL'));
  const payload = {
    timestamp: event.timestamp.toISOString(),
    message: event.botName + ' bot send ' + event.status,
    logtype: 'soc5_bot_logs',
    service: 'soc5-bots',
    bot_name: event.botName,
    target_group_id: event.targetGroupId,
    group_name: event.groupName,
    status: event.status,
    success: event.success,
    failed: event.failed,
    sent_timestamp: event.timestamp.toISOString(),
    interval_from_previous_sent: event.intervalFromPreviousSent,
    reason_for_delay: event.reasonForDelay,
    error_message: event.errorMessage,
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Api-Key': licenseKey,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    if (status >= 300) {
      console.warn('New Relic push failed HTTP ' + status + ': ' + response.getContentText());
      return false;
    }
    return true;
  } catch (err) {
    console.warn('New Relic push failed: ' + err.message);
    return false;
  }
}

function botLogConfigValue_(cfg, key) {
  if (cfg && cfg[key]) {
    return String(cfg[key]).trim();
  }
  try {
    return String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
  } catch (err) {
    return '';
  }
}

function normalizeNewRelicLogApiUrl_(value) {
  return String(value || 'https://log-api.newrelic.com/log/v1').trim();
}

function botLogErrorMessage_(error) {
  if (!error) {
    return '';
  }
  if (error.message) {
    return String(error.message).trim();
  }
  return String(error).trim();
}
