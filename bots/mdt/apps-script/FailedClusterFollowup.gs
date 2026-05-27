/**
 * Sends the MDT failed-cluster follow-up after the main MDT report card.
 *
 * This file is intentionally separate from Code.gs to keep the new
 * second-message logic isolated.
 */

const MDT_FAILED_CLUSTER_FOLLOWUP_DEFAULTS_ = {
  CAPTURE_RANGE: 'misses-soc5-mdt!F3:Q55',
  CROP_CAPTURE_ROWS_WITH_DATA: 'true',
};

function sendMdtFailedClusterFollowup_(cfg, spreadsheet, groupId) {
  const followup = buildMdtFailedClusterFollowup_(cfg, spreadsheet);

  sendMdtFailedClusterText_(cfg, groupId, followup.text);
  if (followup.imageBase64) {
    sendMdtFailedClusterImage_(cfg, groupId, followup.imageBase64);
  }
}

function buildMdtFailedClusterFollowup_(cfg, spreadsheet) {
  const followupCfg = loadMdtFailedClusterFollowupConfig_();
  const text = [
    'Misses Breakdown:',
    '**1st MDT**',
    mdtMissesBreakdownLine_(spreadsheet, 1, 'misses_breakdown!H10', 'misses_breakdown!I10'),
    mdtMissesBreakdownLine_(spreadsheet, 2, 'misses_breakdown!H11', 'misses_breakdown!I11'),
    mdtMissesBreakdownLine_(spreadsheet, 3, 'misses_breakdown!H12', 'misses_breakdown!I12'),
    '',
    '**2nd MDT**',
    mdtMissesBreakdownLine_(spreadsheet, 1, 'misses_breakdown!L10', 'misses_breakdown!M10'),
    mdtMissesBreakdownLine_(spreadsheet, 2, 'misses_breakdown!L11', 'misses_breakdown!M11'),
    mdtMissesBreakdownLine_(spreadsheet, 3, 'misses_breakdown!L12', 'misses_breakdown!M12'),
  ].join('\n');

  const captureRange = followupCfg.cropCaptureRowsWithData
    ? mdtCropRangeToRowsWithData_(spreadsheet, followupCfg.captureRange)
    : followupCfg.captureRange;
  const pdfBlob = cfg.REPORT_SEND_IMAGE
    ? exportReportPdfForRange_(spreadsheet, cfg, captureRange)
    : null;
  const imageBase64 = cfg.REPORT_SEND_IMAGE
    ? tryConvertPdfToPng_(cfg, pdfBlob)
    : '';

  return {
    text: text,
    imageBase64: imageBase64,
  };
}

function loadMdtFailedClusterFollowupConfig_() {
  const props = PropertiesService.getScriptProperties();

  return {
    captureRange: props.getProperty('GOOGLE_CAPTURE_RANGE2') ||
      MDT_FAILED_CLUSTER_FOLLOWUP_DEFAULTS_.CAPTURE_RANGE,
    cropCaptureRowsWithData: mdtParseBool_(
      props.getProperty('MDT_FAILED_CLUSTER_CROP_CAPTURE_ROWS_WITH_DATA') ||
      MDT_FAILED_CLUSTER_FOLLOWUP_DEFAULTS_.CROP_CAPTURE_ROWS_WITH_DATA
    ),
  };
}

function mdtMissesBreakdownLine_(spreadsheet, rank, labelRange, valueRange) {
  const label = String(spreadsheet.getRange(labelRange).getDisplayValue() || '').trim();
  const value = String(spreadsheet.getRange(valueRange).getDisplayValue() || '').trim();
  return rank + '. ' + label + ' - ' + value;
}

function mdtCropRangeToRowsWithData_(spreadsheet, rangeName) {
  const sourceRange = spreadsheet.getRange(rangeName);
  const displayValues = sourceRange.getDisplayValues();
  let lastDataOffset = -1;

  for (let r = displayValues.length - 1; r >= 0; r--) {
    if (mdtDisplayRowHasData_(displayValues[r])) {
      lastDataOffset = r;
      break;
    }
  }

  if (lastDataOffset === -1) {
    return rangeName;
  }

  const croppedRange = sourceRange.offset(0, 0, lastDataOffset + 1, sourceRange.getNumColumns());
  return sourceRange.getSheet().getName() + '!' + croppedRange.getA1Notation();
}

function mdtDisplayRowHasData_(displayRow) {
  return displayRow.some(function(value) {
    return Boolean(String(value || '').trim());
  });
}

function mdtParseBool_(value) {
  return String(value).toLowerCase() === 'true';
}

function sendMdtFailedClusterText_(cfg, groupId, content) {
  const textPayload = {
    format: 1,
    content: content,
  };

  return postSeatalkJson_(cfg, '/messaging/v2/group_chat', {
    group_id: groupId,
    message: {
      tag: 'text',
      text: textPayload,
    },
  });
}

function sendMdtFailedClusterImage_(cfg, groupId, contentBase64) {
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
