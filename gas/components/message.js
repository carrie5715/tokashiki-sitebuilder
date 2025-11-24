// グローバル保持
var message = message || {};

var MessageInfo = (function () {
  const SHEET_NAME            = 'message';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  // 直近 read() の行キャッシュ
  let lastRows = [];

  // 純粋な読み込み処理 (シート→ message 反映)
  function read() {
    const overrideRows = (typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]);
    let values;
    if (overrideRows) {
      values = overrideRows;
    } else {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName(SHEET_NAME);
      if (!sh) throw new Error('「message」シートが見つかりません。');
      values = sh.getDataRange().getValues();
    }
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
    lastRows = rows.slice();
    return rows;
  }

  // Parameters 関連機能は廃止済み

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

  function record() {
    // スナップショットオーバーライドから再構築（必要時）
    if ((!lastRows || lastRows.length === 0) && typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]) {
      try {
        const values = globalThis.__snapshotOverrides[SHEET_NAME];
        if (values && values.length) {
          const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
          const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
            const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
          const startRow = hasHeader ? 1 : 0;
          const rows = [];
          message = {};
          for (let r = startRow; r < values.length; r++) {
            const key  = values[r][0] ? String(values[r][0]).trim() : '';
            const val  = values[r][1] != null ? values[r][1] : '';
            const note = values[r][2] != null ? String(values[r][2]) : '';
            if (!key) continue;
            message[key] = val;
            rows.push({ category: 'message', key, value: val, note });
          }
          lastRows = rows.slice();
          // 色変数の再登録
          try {
            const bg = message['bg_color'];
            const tx = message['text_color'];
            const hd = message['heading_color'];
            if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
              if (bg) CommonInfo.addColorVar('--pcol-message-bg-color', String(bg));
              if (tx) CommonInfo.addColorVar('--pcol-message-text-color', String(tx));
              if (hd) CommonInfo.addColorVar('--pcol-message-heading-color', String(hd));
            }
          } catch (_) {}
        }
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('message snapshot再構築失敗: ' + e.message, 'MessageInfo.record');
      }
    }
    // 前倒しパース済みデータ（processed）があれば利用し buildSlides_ を省略
    let slides;
    if (typeof globalThis !== 'undefined' && globalThis.__processedSnapshot && globalThis.__processedSnapshot.message && globalThis.__processedSnapshot.message.data && globalThis.__processedSnapshot.message.data.slides) {
      try {
        slides = JSON.parse(JSON.stringify(globalThis.__processedSnapshot.message.data.slides));
      } catch(_) { slides = buildSlides_(); }
    } else {
      slides = buildSlides_();
    }
    writeMessageJson_(slides);
    const ok = (slides && slides.length > 0) || (lastRows && lastRows.length > 0);
    return { message: JSON.parse(JSON.stringify(message)), rows: lastRows.slice(), slides, ok };
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
    read,
    record,
    getTemplateReplacements,
    getAll,
    buildSlides_: buildSlides_,
    writeMessageJson_: writeMessageJson_,
  };
})();