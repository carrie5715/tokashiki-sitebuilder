// グローバル保持
var meta = meta || {};

var MetaInfo = (function () {
  const META_SHEET_NAME       = 'meta';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  // meta シートを読み込み、meta を更新し、Parameters へ投げる行データを返す
  function readMeta_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(META_SHEET_NAME);
    if (!sh) throw new Error('「meta」シートが見つかりません。');

    const values = sh.getDataRange().getValues();
    if (!values || values.length <= 1) return [];

    // 1行目はヘッダー想定: A=key, B=value, C=note
    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const key  = values[r][0] ? String(values[r][0]).trim() : '';
      const val  = values[r][1] != null ? values[r][1] : '';
      const note = values[r][2] != null ? String(values[r][2]) : '';
      if (!key) continue;

      // グローバルに保存
      meta[key] = val;

      // Parameters へ渡す行（カテゴリは "meta" 固定）
      rows.push({ category: 'meta', key, value: val, note });
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

    // CommonInfo が持つ append を使えるならそれを使う（列揃えの一貫性）
    if (typeof CommonInfo !== 'undefined' && CommonInfo.appendToParameters_) {
      return CommonInfo.appendToParameters_(rows);
    }

    const sh = ensureParametersSheet_();
    const start = Math.max(sh.getLastRow(), 1) + 1;
    const values = rows.map(r => [r.category, r.key, r.value, r.note || '']);
    sh.getRange(start, 1, values.length, 4).setValues(values);
  }

  // 公開API: 読み込み + Parameters 追記 + 概要返却
  function readAndRecordMeta() {
    const rows = readMeta_();
    appendToParameters_(rows);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`meta: ${Object.keys(meta).length}件`, 'MetaInfo');
    }
    return { meta: JSON.parse(JSON.stringify(meta)), rows };
  }

  return {
    readAndRecordMeta,
    // エクスポート（必要に応じて）
    readMeta_: readMeta_,
    ensureParametersSheet_: ensureParametersSheet_,
    appendToParameters_: appendToParameters_,
    get: function(key) { return meta[key]; }
  };
})();
