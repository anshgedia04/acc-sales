const SALES_SHEET_NAME = 'SALES DATA';
const SALES_SUMMARY_SHEET_NAME = 'SALES SUMMARY';
const HEADER_ROW = 1;
const ENTRY_ID_COLUMN = 15;
const OPTIONS_SHEET_NAME = 'APP OPTIONS';

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : 'health';

    if (action === 'list') {
      return json_({ ok: true, entries: listEntries_(e.parameter.search || '') });
    }

    if (action === 'options') {
      return json_({ ok: true, options: listOptions_() });
    }

    if (action === 'summary') {
      return json_({ ok: true, summary: getSalesSummary_() });
    }

    return json_({ ok: true, status: 'ready', message: 'Sales Entry API is ready.' });
  } catch (error) {
    return json_({ ok: false, message: error.message || 'Unable to read Google Sheets.' });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (data.action === 'addOption') return json_({ ok: true, options: addOption_(data.option) });
      if (!data.entry || typeof data.entry !== 'object') throw new Error('Entry data is required.');
      if (data.action === 'create') return json_({ ok: true, entry: createEntry_(data.entry) });
      if (data.action === 'update') return json_({ ok: true, entry: updateEntry_(data.entry) });
      throw new Error('Unsupported action.');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json_({ ok: false, message: error.message || 'Unable to save the entry.' });
  }
}

function getSalesSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SALES_SHEET_NAME) || spreadsheet.getSheets()[0];
}

function ensureEntryIdColumn_(sheet) {
  if (sheet.getRange(HEADER_ROW, ENTRY_ID_COLUMN).getValue() !== 'ENTRY ID') {
    sheet.getRange(HEADER_ROW, ENTRY_ID_COLUMN).setValue('ENTRY ID');
    sheet.hideColumns(ENTRY_ID_COLUMN);
  }
}

function listEntries_(search) {
  const sheet = getSalesSheet_();
  ensureEntryIdColumn_(sheet);
  ensureLegacyIds_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return [];

  const query = String(search || '').trim().toLowerCase();
  return sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, ENTRY_ID_COLUMN).getValues()
    .filter(hasInputData_)
    .map((row, index) => rowToEntry_(row, index + HEADER_ROW + 1))
    .filter((entry) => !query || entry.party.toLowerCase().includes(query) || entry.billNo.toLowerCase().includes(query));
}

function listOptions_() {
  const entries = listEntries_('');
  const saved = getSavedOptions_();
  return {
    parties: uniqueOptions_(saved.parties.concat(entries.map((entry) => entry.party))),
    products: uniqueOptions_(saved.products.concat(entries.map((entry) => entry.product))),
    paymentTypes: uniqueOptions_(saved.paymentTypes.concat(entries.map((entry) => entry.paymentType))),
  };
}

function getSalesSummary_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SALES_SUMMARY_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SALES_SUMMARY_SHEET_NAME}" was not found.`);

  const range = sheet.getDataRange();
  const labels = range.getDisplayValues();
  const values = range.getValues();
  const dashboard = findSalesDashboard_(labels);
  if (!dashboard) throw new Error(`Could not find the SALES DASHBOARD table in ${SALES_SUMMARY_SHEET_NAME}.`);
  const total = (label) => findSummaryTotal_(labels, values, label, dashboard);

  return {
    quantity: total('TOTAL QUANTITY'),
    billSale: total('TOTAL BILL SALE'),
    withoutSale: total('TOTAL WITHOUT BILL'),
    totalSale: total('TOTAL SALES'),
    totalPaid: total('TOTAL PAID'),
    balance: total('TOTAL BALANCE'),
  };
}

function findSalesDashboard_(labels) {
  for (let row = 0; row < labels.length; row += 1) {
    for (let column = 0; column < labels[row].length; column += 1) {
      if (normalizeSummaryLabel_(labels[row][column]) === 'SALES DASHBOARD') return { row, column };
    }
  }

  // In some Sheets, the formatted table name is visual only and does not
  // exist in the cell values. Identify the dashboard by its six fixed labels.
  const requiredLabels = [
    'TOTAL QUANTITY',
    'TOTAL BILL SALE',
    'TOTAL WITHOUT BILL',
    'TOTAL SALES',
    'TOTAL PAID',
    'TOTAL BALANCE',
  ];

  for (let row = 0; row < labels.length; row += 1) {
    for (let column = 0; column < labels[row].length; column += 1) {
      if (normalizeSummaryLabel_(labels[row][column]) !== 'TOTAL QUANTITY') continue;

      const nearbyLabels = [];
      for (let nextRow = row; nextRow < Math.min(labels.length, row + 40); nextRow += 1) {
        nearbyLabels.push(normalizeSummaryLabel_(labels[nextRow][column]));
      }

      if (requiredLabels.every((label) => nearbyLabels.includes(label))) {
        // findSummaryTotal_ starts after the returned row, so place the
        // virtual header immediately above TOTAL QUANTITY.
        return { row: row - 1, column };
      }
    }
  }

  return null;
}

function findSummaryTotal_(labels, values, target, dashboard) {
  const normalizedTarget = normalizeSummaryLabel_(target);
  const startRow = dashboard.row + 1;
  const endRow = Math.min(labels.length, dashboard.row + 40);
  for (let row = startRow; row < endRow; row += 1) {
    if (normalizeSummaryLabel_(labels[row][dashboard.column]) === normalizedTarget) {
      const value = values[row][dashboard.column + 1];
      if (typeof value === 'number') return value;
      const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  throw new Error(`Could not find ${target} in ${SALES_SUMMARY_SHEET_NAME}.`);
}

// Headers in Sheets can contain line breaks when text is wrapped. Treat any
// whitespace consistently so "SALES\nDASHBOARD" still identifies the table.
function normalizeSummaryLabel_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function getOptionsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(OPTIONS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(OPTIONS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([['TYPE', 'VALUE', 'CREATED AT']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSavedOptions_() {
  const sheet = getOptionsSheet_();
  const lastRow = sheet.getLastRow();
  const saved = { parties: [], products: [], paymentTypes: [] };
  if (lastRow <= 1) return saved;

  sheet.getRange(2, 1, lastRow - 1, 2).getValues().forEach((row) => {
    const type = String(row[0] || '').trim();
    const value = String(row[1] || '').trim();
    if (value && Object.prototype.hasOwnProperty.call(saved, type)) saved[type].push(value);
  });
  return saved;
}

function addOption_(option) {
  if (!option || typeof option !== 'object') throw new Error('Option data is required.');
  const type = String(option.type || '').trim();
  const value = String(option.value || '').trim();
  const allowedTypes = ['parties', 'products', 'paymentTypes'];
  if (!allowedTypes.includes(type)) throw new Error('Invalid option type.');
  if (!value) throw new Error('Enter a value before saving.');
  if (value.length > 120) throw new Error('Option values must be 120 characters or fewer.');

  const saved = getSavedOptions_();
  const existing = saved[type].some((item) => item.toLowerCase() === value.toLowerCase());
  if (!existing) getOptionsSheet_().appendRow([type, value, new Date()]);
  return listOptions_();
}

function uniqueOptions_(values) {
  const seen = {};
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => value && !seen[value.toLowerCase()] && (seen[value.toLowerCase()] = true))
    .sort((a, b) => a.localeCompare(b));
}

function createEntry_(entry) {
  const sheet = getSalesSheet_();
  ensureEntryIdColumn_(sheet);
  const rowNumber = Math.max(HEADER_ROW + 1, findLastDataRow_(sheet) + 1);
  const entryId = `ENTRY-${new Date().getTime()}-${Math.floor(Math.random() * 100000)}`;
  writeEntry_(sheet, rowNumber, entry, entryId);
  return rowToEntry_(sheet.getRange(rowNumber, 1, 1, ENTRY_ID_COLUMN).getValues()[0], rowNumber);
}

function updateEntry_(entry) {
  if (!entry.entryId) throw new Error('Entry ID is required for an update.');
  const sheet = getSalesSheet_();
  ensureEntryIdColumn_(sheet);
  const rowNumber = findEntryRow_(sheet, entry.entryId);
  if (!rowNumber) throw new Error('The selected entry could not be found. Refresh and try again.');
  writeEntry_(sheet, rowNumber, entry, entry.entryId);
  return rowToEntry_(sheet.getRange(rowNumber, 1, 1, ENTRY_ID_COLUMN).getValues()[0], rowNumber);
}

function writeEntry_(sheet, rowNumber, entry, entryId) {
  sheet.getRange(rowNumber, 1, 1, 6).setValues([[
    sheetDate_(entry.date), entry.party || '', entry.billNo || '', entry.product || '', number_(entry.quantity), number_(entry.billRate),
  ]]);
  sheet.getRange(rowNumber, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(rowNumber, 8).setValue(number_(entry.withoutBillRate));
  sheet.getRange(rowNumber, 10, 1, 3).setValues([[number_(entry.billPaid), number_(entry.withoutBillPaid), entry.paymentType || '']]);
  sheet.getRange(rowNumber, 7).setFormula(`=IFERROR(E${rowNumber}*F${rowNumber},"")`);
  sheet.getRange(rowNumber, 9).setFormula(`=IFERROR(E${rowNumber}*H${rowNumber},"")`);
  sheet.getRange(rowNumber, 13).setFormula(`=IFERROR(J${rowNumber}+K${rowNumber},"")`);
  sheet.getRange(rowNumber, 14).setFormula(`=IFERROR(G${rowNumber}+I${rowNumber}-M${rowNumber},"")`);
  sheet.getRange(rowNumber, ENTRY_ID_COLUMN).setValue(entryId);
}

function findEntryRow_(sheet, entryId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return null;
  const ids = sheet.getRange(HEADER_ROW + 1, ENTRY_ID_COLUMN, lastRow - HEADER_ROW, 1).getValues();
  const index = ids.findIndex((row) => String(row[0]) === String(entryId));
  return index === -1 ? null : index + HEADER_ROW + 1;
}

function findLastDataRow_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return HEADER_ROW;
  const rows = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, 14).getValues();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (hasInputData_(rows[index])) return index + HEADER_ROW + 1;
  }
  return HEADER_ROW;
}

function ensureLegacyIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return;
  const rows = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, ENTRY_ID_COLUMN).getValues();
  rows.forEach((row, index) => {
    if (hasInputData_(row) && !row[ENTRY_ID_COLUMN - 1]) {
      sheet.getRange(index + HEADER_ROW + 1, ENTRY_ID_COLUMN).setValue(`LEGACY-${index + HEADER_ROW + 1}`);
    }
  });
}

function hasInputData_(row) {
  const inputColumns = [1, 2, 3, 4, 5, 7, 9, 10, 11];
  return inputColumns.some((index) => row[index] !== '' && row[index] !== null);
}

function rowToEntry_(row, rowNumber) {
  return {
    rowNumber,
    entryId: String(row[14] || `LEGACY-${rowNumber}`),
    date: formatDate_(row[0]), party: String(row[1] || ''), billNo: String(row[2] || ''), product: String(row[3] || ''),
    quantity: value_(row[4]), billRate: value_(row[5]), billAmount: value_(row[6]), withoutBillRate: value_(row[7]), withoutBillAmount: value_(row[8]),
    billPaid: value_(row[9]), withoutBillPaid: value_(row[10]), paymentType: String(row[11] || ''), totalPaid: value_(row[12]), balance: value_(row[13]),
  };
}

function formatDate_(value) {
  return value instanceof Date ? Utilities.formatDate(value, spreadsheetTimezone_(), 'yyyy-MM-dd') : String(value || '');
}

function sheetDate_(value) {
  const dateText = String(value || '').trim();
  if (!dateText) return '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('Date must use YYYY-MM-DD.');
  }

  const timezone = spreadsheetTimezone_();
  const parsed = Utilities.parseDate(dateText, timezone, 'yyyy-MM-dd');
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime()) || Utilities.formatDate(parsed, timezone, 'yyyy-MM-dd') !== dateText) {
    throw new Error('Enter a valid date.');
  }

  return parsed;
}

function spreadsheetTimezone_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
}

function value_(value) { return value === '' || value === null ? '' : Number(value); }
function number_(value) { return value === '' || value === null || value === undefined ? 0 : Number(value); }
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
