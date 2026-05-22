// ============================================================
// GOOGLE APPS SCRIPT - AutoVenda Pro v3.0
// Implantar como:
//   - Executar como: Eu
//   - Acesso: Qualquer pessoa
// ============================================================

const CLIENTS_SHEET = 'Clientes';
const AGENDA_SHEET = 'Agenda';

const CLIENT_HEADERS = [
  'id','nome','empresa','telefone','email','cnpj','cidade','obs',
  'lastContact','createdAt','purchaseCount','history'
];

const AGENDA_HEADERS = [
  'id','clientId','clientName','date','time','obs','done'
];

// ====== HELPERS ======
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ====== READ ======
function readAll(sheet, headers) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const fileHeaders = data[0];
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const obj = {};
    fileHeaders.forEach((h, j) => { obj[h] = data[i][j]; });
    // Parse history
    if (typeof obj.history === 'string') {
      try { obj.history = JSON.parse(obj.history); } catch(e) { obj.history = []; }
    }
    if (!Array.isArray(obj.history)) obj.history = [];
    out.push(obj);
  }
  return out;
}

function getClients() {
  return readAll(getOrCreateSheet(CLIENTS_SHEET, CLIENT_HEADERS), CLIENT_HEADERS);
}

function getAgenda() {
  return readAll(getOrCreateSheet(AGENDA_SHEET, AGENDA_HEADERS), AGENDA_HEADERS);
}

// ====== WRITE ======
function saveClients(clients) {
  const sheet = getOrCreateSheet(CLIENTS_SHEET, CLIENT_HEADERS);
  // Always preserve headers; clear all data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, CLIENT_HEADERS.length).clearContent();
  if (!clients || clients.length === 0) return;
  const rows = clients.map(c => CLIENT_HEADERS.map(h => {
    if (h === 'history') return JSON.stringify(c.history || []);
    return c[h] != null ? c[h] : '';
  }));
  sheet.getRange(2, 1, rows.length, CLIENT_HEADERS.length).setValues(rows);
}

function saveAgenda(items) {
  const sheet = getOrCreateSheet(AGENDA_SHEET, AGENDA_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, AGENDA_HEADERS.length).clearContent();
  if (!items || items.length === 0) return;
  const rows = items.map(a => AGENDA_HEADERS.map(h => a[h] != null ? a[h] : ''));
  sheet.getRange(2, 1, rows.length, AGENDA_HEADERS.length).setValues(rows);
}

// ====== ENDPOINTS ======
function doGet(e) {
  try {
    const action = e.parameter ? e.parameter.action : null;
    
    if (action === 'getAll' || !action) {
      return createResponse({
        status: 'ok',
        clients: getClients(),
        agenda: getAgenda()
      });
    }
    
    if (action === 'getClients') {
      return createResponse({ status: 'ok', clients: getClients() });
    }
    
    if (action === 'getAgenda') {
      return createResponse({ status: 'ok', agenda: getAgenda() });
    }
    
    return createResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch(err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    
    if (body.action === 'saveAll') {
      if (Array.isArray(body.clients)) saveClients(body.clients);
      if (Array.isArray(body.agenda)) saveAgenda(body.agenda);
      return createResponse({ status: 'ok', saved: { clients: (body.clients||[]).length, agenda: (body.agenda||[]).length } });
    }
    
    if (body.action === 'saveClients' || body.action === 'save') {
      if (Array.isArray(body.clients)) saveClients(body.clients);
      return createResponse({ status: 'ok', saved: (body.clients||[]).length });
    }
    
    if (body.action === 'saveAgenda') {
      if (Array.isArray(body.agenda)) saveAgenda(body.agenda);
      return createResponse({ status: 'ok', saved: (body.agenda||[]).length });
    }
    
    return createResponse({ status: 'error', message: 'Unknown action' });
  } catch(err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}
