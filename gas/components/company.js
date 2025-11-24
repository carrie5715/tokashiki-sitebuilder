// グローバル保持
var company = company || {};

var CompanyInfo = (function () {
  const SHEET_NAME            = 'company';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  let lastRows = [];

  // 純粋な読み込み処理
  function read() {
    const overrideRows = (typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]);
    let values;
    if (overrideRows) {
      values = overrideRows;
    } else {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName(SHEET_NAME);
      if (!sh) throw new Error('「company」シートが見つかりません。');
      values = sh.getDataRange().getValues();
    }
    if (!values || values.length === 0) return [];

    // 先頭行がヘッダーかどうか判定（A1=key かつ B1=value ならヘッダーとみなす）
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

      company[key] = val;
      rows.push({ category: 'company', key, value: val, note });
    }
    lastRows = rows.slice();
    return rows;
  }

  // Parameters 関連機能は廃止済み（ensure/append 削除）

  function parseCompanyItems_() {
    // company_section_1 .. company_section_6（将来拡張可）
    const out = [];
    const maxN = 50;
    for (let i = 1; i <= maxN; i++) {
      const key = `company_section_${i}`;
      const raw = company[key];
      if (raw == null) continue;
      const str = String(raw).trim();
      if (!str) continue;

      // 最初の区切り記号（半角: または 全角：）を探す
      const idxHalf = str.indexOf(':');
      const idxFull = str.indexOf('：');
      let sepIdx = -1;
      if (idxHalf >= 0 && idxFull >= 0) sepIdx = Math.min(idxHalf, idxFull);
      else sepIdx = (idxHalf >= 0 ? idxHalf : idxFull);
      if (sepIdx >= 0) {
        const label = str.slice(0, sepIdx).trim();
        const value = str.slice(sepIdx + 1).trim();
        out.push({ label: label || `セクション${i}`, value });
      } else {
        out.push({ label: `セクション${i}`, value: str });
      }
    }
    return out;
  }

  function writeCompanyJson_(items) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');

      const json = JSON.stringify(items || [], null, 2);
      const filename = 'company.json';
      const files = dataFolder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        file.setContent(json);
      } else {
        const blob = Utilities.newBlob(json, 'application/json', filename);
        dataFolder.createFile(blob);
      }

      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        // Utils.logToSheet(`company.json を出力しました（${(items || []).length}件）`, 'CompanyInfo');
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`company.json 出力エラー: ${e.message}`, 'CompanyInfo');
      }
      throw e;
    }
  }

  function getGoogleMapTag_() {
    const tag = company['googlemap_tag'];
    const raw = (tag != null ? String(tag).trim() : '');
    if (!raw) return '';
    return `<div class="googlemap-wrap">${raw}</div>`;
  }

  // 公開API
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
          company = {};
          for (let r = startRow; r < values.length; r++) {
            const key  = values[r][0] ? String(values[r][0]).trim() : '';
            const val  = values[r][1] != null ? values[r][1] : '';
            const note = values[r][2] != null ? String(values[r][2]) : '';
            if (!key) continue;
            company[key] = val;
            rows.push({ category: 'company', key, value: val, note });
          }
          lastRows = rows.slice();
        }
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('company snapshot再構築失敗: ' + e.message, 'CompanyInfo.record');
      }
    }
    try {
      const bg = company['bg_color'];
      const tx = company['text_color'];
      const hd = company['heading_color'];
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        if (bg) CommonInfo.addColorVar('--pcol-company-bg-color', String(bg));
        if (tx) CommonInfo.addColorVar('--pcol-company-text-color', String(tx));
        if (hd) CommonInfo.addColorVar('--pcol-company-heading-color', String(hd));
      }
    } catch (e) {}
    const items = parseCompanyItems_();
    writeCompanyJson_(items);
    const ok = (items && items.length > 0) || (lastRows && lastRows.length > 0);
    return { company: JSON.parse(JSON.stringify(company)), rows: lastRows.slice(), items, ok };
  }

  function getTemplateReplacements() {
    return {
      section_title: String(company['section_title'] || ''),
      section_title_en: String(company['section_title_en'] || ''),
      googlemap_tag: getGoogleMapTag_(),
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(company));
  }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
    parseCompanyItems_: parseCompanyItems_,
    writeCompanyJson_: writeCompanyJson_,
  };
})();
