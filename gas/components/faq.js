// グローバル保持
var faq = faq || {};

var FaqInfo = (function () {
  const SHEET_NAME = 'faq';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  let lastRows = [];

  function read() {
    const overrideRows = (typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]);
    let values;
    if (overrideRows) {
      values = overrideRows;
    } else {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName(SHEET_NAME);
      if (!sh) throw new Error('「faq」シートが見つかりません。');
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
      faq[key] = val;
      rows.push({ category: 'faq', key, value: val, note });
    }
    lastRows = rows.slice();
    return rows;
  }

  function parseFaqItems_() {
    const items = [];
    const maxN = 500;
    for (let i = 1; i <= maxN; i++) {
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
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`faq.json 出力エラー: ${e.message}`, 'FaqInfo');
      }
      throw e;
    }
  }

  function record() {
    if ((!lastRows || lastRows.length === 0) && typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]) {
      try {
        const values = globalThis.__snapshotOverrides[SHEET_NAME];
        if (values && values.length) {
          const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
          const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
          const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
          const startRow = hasHeader ? 1 : 0;
          const rows = [];
          faq = {};
          for (let r = startRow; r < values.length; r++) {
            const key  = values[r][0] ? String(values[r][0]).trim() : '';
            const val  = values[r][1] != null ? values[r][1] : '';
            const note = values[r][2] != null ? String(values[r][2]) : '';
            if (!key) continue;
            faq[key] = val;
            rows.push({ category: 'faq', key, value: val, note });
          }
          lastRows = rows.slice();
        }
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('faq snapshot再構築失敗: ' + e.message, 'FaqInfo.record');
      }
    }
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
    } catch (_) {}
    // 前倒しパース済み items 利用（存在すれば parseFaqItems_ スキップ）
    let items;
    if (typeof globalThis !== 'undefined' && globalThis.__processedSnapshot && globalThis.__processedSnapshot.faq && globalThis.__processedSnapshot.faq.data && globalThis.__processedSnapshot.faq.data.items) {
      try { items = JSON.parse(JSON.stringify(globalThis.__processedSnapshot.faq.data.items)); } catch(_) { items = parseFaqItems_(); }
    } else {
      items = parseFaqItems_();
    }
    writeFaqJson_(items);
    const ok = (items && items.length > 0) || (lastRows && lastRows.length > 0);
    return { faq: JSON.parse(JSON.stringify(faq)), rows: lastRows.slice(), items, ok };
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

  function getAll() { return JSON.parse(JSON.stringify(faq)); }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
    parseFaqItems_: parseFaqItems_,
    writeFaqJson_: writeFaqJson_,
  };
})();
