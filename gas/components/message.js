// グローバル保持
var message = message || {};

var MessageInfo = (function () {
  const SHEET_NAME            = 'message';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  function readMessage_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('「message」シートが見つかりません。');
    const values = sh.getDataRange().getValues();
    if (!values || values.length === 0) return [];
    const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
    const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
    const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
    const rows = [];
    const startRow = hasHeader ? 1 : 0;
    for (let r = startRow; r < values.length; r++) {
      const key  = values[r][0] ? String(values[r][0]).trim() : '';
      const val  = values[r][1] != null ? values[r][1] : '';
      const note = values[r][2] != null ? String(values[r][2]) : '';
      if (!key) continue;
      message[key] = val;
      rows.push({ category: 'message', key, value: val, note });
    }
    try {
      const bg = message['bg_color'];
      const tx = message['text_color'];
      const hd = message['heading_color'];
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        if (bg) CommonInfo.addColorVar('--pcol-message-bg-color', String(bg));
        if (tx) CommonInfo.addColorVar('--pcol-message-text-color', String(tx));
        if (hd) CommonInfo.addColorVar('--pcol-message-heading-color', String(hd));
      }
    } catch (e) {}
    return rows;
  }

  function ensureParametersSheet_() {
    if (typeof CommonInfo !== 'undefined' && CommonInfo.ensureParametersSheet_) {
      return CommonInfo.ensureParametersSheet_();
    }
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(PARAMETERS_SHEET_NAME);
    if (sheet) return sheet;
    const sheets = ss.getSheets();
    let logsIndex = -1;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() === LOGS_SHEET_NAME) { logsIndex = i; break; }
    }
    sheet = (logsIndex >= 0)
      ? ss.insertSheet(PARAMETERS_SHEET_NAME, logsIndex)
      : ss.insertSheet(PARAMETERS_SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 4).setValues([[ 'カテゴリ', 'キー', 'バリュー', 'ノート' ]]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function appendToParameters_(rows) {
    if (!rows || rows.length === 0) return;
    if (typeof CommonInfo !== 'undefined' && CommonInfo.appendToParameters_) {
      return CommonInfo.appendToParameters_(rows);
    }
    const sh = ensureParametersSheet_();
    const start = Math.max(sh.getLastRow(), 1) + 1;
    const values = rows.map(r => [r.category, r.key, r.value, r.note || '']);
    sh.getRange(start, 1, values.length, 4).setValues(values);
  }

  function buildSlides_() {
    const slides = [];
    for (let i = 1; i <= 5; i++) {
      const img = message[`slide_${i}_image`];
      const alt = message[`slide_${i}_alt`];
      const cap = message[`slide_${i}_caption`];
      const typ = message[`slide_${i}_type`];
      if (!img) continue;
      slides.push({
        image: String(img),
        alt: String(alt || ''),
        type: (typ == null || String(typ).trim() === '') ? 0 : Number(typ),
        caption: String(cap || ''),
      });
    }
    return slides;
  }

  function writeMessageJson_(slides) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');
      const json = JSON.stringify(slides || [], null, 2);
      const filename = 'message.json';
      const files = dataFolder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        file.setContent(json);
      } else {
        const blob = Utilities.newBlob(json, 'application/json', filename);
        dataFolder.createFile(blob);
      }
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        // Utils.logToSheet(`message.json を出力しました（${(slides || []).length}件）`, 'MessageInfo');
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`message.json 出力エラー: ${e.message}`, 'MessageInfo');
      }
      throw e;
    }
  }

  function readAndRecordMessage() {
    const rows = readMessage_();
    appendToParameters_(rows);
    const slides = buildSlides_();
    writeMessageJson_(slides);
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      // Utils.logToSheet(`message: ${Object.keys(message).length}件`, 'MessageInfo');
    }
    const ok = (slides && slides.length > 0) || (rows && rows.length > 0);
    return { message: JSON.parse(JSON.stringify(message)), rows, slides, ok };
  }

  function getTemplateReplacements() {
    const br = (s) => String(s == null ? '' : s).replace(/\r\n|\r|\n/g, '<br>');
    return {
      section_title_en: br(message['section_title_en']),
      message_heading_text: br(message['heading_text']),
      message_intro_text: br(message['intro_text']),
    };
  }

  function getAll() { return JSON.parse(JSON.stringify(message)); }

  return {
    readAndRecordMessage,
    getTemplateReplacements,
    getAll,
    readMessage_: readMessage_,
    appendToParameters_: appendToParameters_,
    ensureParametersSheet_: ensureParametersSheet_,
    buildSlides_: buildSlides_,
    writeMessageJson_: writeMessageJson_,
  };
})();