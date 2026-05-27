/**
 * Manual test entrypoints for the MDT failed-cluster follow-up.
 *
 * Add this file to Apps Script only when you need the test helper.
 */

const MDT_FAILED_CLUSTER_FOLLOWUP_TEST_GROUP_ID_ = 'NjkwNjYwNzkyMjI3';

function sendMdtFailedClusterFollowupTestNow() {
  const cfg = loadConfig_();
  const spreadsheet = SpreadsheetApp.openById(cfg.GOOGLE_SPREADSHEET_ID);
  const groupId = PropertiesService.getScriptProperties().getProperty('SEATALK_FAILED_CLUSTER_TEST_GROUP_ID') ||
    MDT_FAILED_CLUSTER_FOLLOWUP_TEST_GROUP_ID_;

  sendMdtFailedClusterFollowup_(cfg, spreadsheet, groupId);
  return {
    sent: true,
    groupId: groupId,
  };
}
