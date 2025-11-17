// グローバル保持
var faq = faq || {};

var FaqInfo = (function () {
  const SHEET_NAME = 'faq';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME = 'Logs';

  function readFaq_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('「faq」シートが見つかりません。');

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

      faq[key] = val;
      rows.push({ category: 'faq', key, value: val, note });
    }
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

  function parseFaqItems_() {
    const items = [];
    const maxN = 500; // 十分多め
    for (let i = 1; i <= maxN; i++) {
      // シートキーは item1_q のような形式（item + 数字 + _q）
      const q = faq[`item${i}_q`];
      const a = faq[`item${i}_a`];
      const hasAny = [q, a].some(v => v != null && String(v).trim() !== '');
      if (!hasAny) continue;
      items.push({ q: String(q || ''), a: String(a || '') });
    }
    return items;
  }

  function writeFaqJson_(items) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');

      const json = JSON.stringify(items || [], null, 2);
      const filename = 'faq.json';
      const files = dataFolder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        file.setContent(json);
      } else {
        const blob = Utilities.newBlob(json, 'application/json', filename);
        dataFolder.createFile(blob);
      }

      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`faq.json を出力しました（${(items || []).length}件）`, 'FaqInfo');
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`faq.json 出力エラー: ${e.message}`, 'FaqInfo');
      }
      throw e;
    }
  }

  function readAndRecordFaq() {
    const rows = readFaq_();
    appendToParameters_(rows);

    // カラー変数登録
    try {
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        const map = {
          bg_color: '--pcol-faq-bg-color',
          text_color: '--pcol-faq-text-color',
          heading_color: '--pcol-faq-heading-color',
          accent_color: '--pcol-faq-accent-color',
        };
        Object.keys(map).forEach(k => {
          const v = faq[k];
          if (v != null && String(v).trim() !== '') {
            CommonInfo.addColorVar(map[k], String(v));
          }
        });
      }
    } catch (_) { /* noop */ }

    const items = parseFaqItems_();
    writeFaqJson_(items);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`faq: ${Object.keys(faq).length}件`, 'FaqInfo');
    }
    const ok = (items && items.length > 0) || (rows && rows.length > 0);
    return { faq: JSON.parse(JSON.stringify(faq)), rows, items, ok };
  }

  function getTemplateReplacements() {
    const typeVal = String(faq['type'] || '').trim();
    const classes = typeVal ? `type-${typeVal}` : '';
    const desc = String(faq['description'] || '').trim();
    const descHtml = desc ? `<p class="description">${desc}</p>` : '';
    return {
      section_title: String(faq['section_title'] || ''),
      section_title_en: String(faq['section_title_en'] || ''),
      description: descHtml,
      faq_classes: classes,
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(faq));
  }

  return {
    readAndRecordFaq,
    getTemplateReplacements,
    getAll,
    // internal
    readFaq_: readFaq_,
    appendToParameters_: appendToParameters_,
    ensureParametersSheet_: ensureParametersSheet_,
    parseFaqItems_: parseFaqItems_,
    writeFaqJson_: writeFaqJson_,
  };
})();
