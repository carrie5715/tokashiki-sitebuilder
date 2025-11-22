// グローバル保持
var company = company || {};

var CompanyInfo = (function () {
  const SHEET_NAME            = 'company';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  function readCompany_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('「company」シートが見つかりません。');

    const values = sh.getDataRange().getValues();
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
    return rows;
  }

  // Parameters シート確保（CommonInfo があれば共用。なければフォールバックで作成）
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

  // Parameters へ追記
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
  function readAndRecordCompany() {
    const rows = readCompany_();
    appendToParameters_(rows);

    // 追加: company セクションのカラー変数を colors.css に出力
    try {
      const bg = company['bg_color'];
      const tx = company['text_color'];
      const hd = company['heading_color'];
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        if (bg) CommonInfo.addColorVar('--pcol-company-bg-color', String(bg));
        if (tx) CommonInfo.addColorVar('--pcol-company-text-color', String(tx));
        if (hd) CommonInfo.addColorVar('--pcol-company-heading-color', String(hd));
      }
    } catch (e) {
      // noop（色指定がなくても続行）
    }

    const items = parseCompanyItems_();
    writeCompanyJson_(items);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      // Utils.logToSheet(`company: ${Object.keys(company).length}件`, 'CompanyInfo');
    }
    const ok = (items && items.length > 0) || (rows && rows.length > 0);
    return { company: JSON.parse(JSON.stringify(company)), rows, items, ok };
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
    readAndRecordCompany,
    getTemplateReplacements,
    getAll,
    // internal for tests
    readCompany_: readCompany_,
    appendToParameters_: appendToParameters_,
    ensureParametersSheet_: ensureParametersSheet_,
    parseCompanyItems_: parseCompanyItems_,
    writeCompanyJson_: writeCompanyJson_,
  };
})();
