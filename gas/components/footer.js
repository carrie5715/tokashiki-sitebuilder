// footer シート処理を集約
var footer = footer || {};

var FooterInfo = (function() {
  const SHEET_NAME = 'footer';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME = 'Logs';

  let lastRows = [];

  // 純粋な読み込み処理
  function read() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) return [];
    const values = sh.getDataRange().getValues();
    if (!values || values.length === 0) return [];

    const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
    const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
    const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));

    const startRow = hasHeader ? 1 : 0;
    const rows = [];
    for (let r = startRow; r < values.length; r++) {
      const key  = values[r][0] ? String(values[r][0]).trim() : '';
      const val  = values[r][1] != null ? values[r][1] : '';
      const note = values[r][2] != null ? String(values[r][2]) : '';
      if (!key) continue;
      footer[key] = val;
      rows.push({ category: 'footer', key, value: val, note });
    }
    lastRows = rows.slice();
    return rows;
  }

  // Parameters 関連機能は廃止済み

  function record() {
    try {
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        const bg = footer['bg_color'];
        const tx = footer['text_color'];
        if (bg != null && String(bg).trim() !== '') CommonInfo.addColorVar('--pcol-footer-bg-color', String(bg));
        if (tx != null && String(tx).trim() !== '') CommonInfo.addColorVar('--pcol-footer-text-color', String(tx));
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`footer 色変数登録失敗: ${e.message}`, 'FooterInfo');
      }
    }
    const ok = lastRows.length > 0;
    return { footer: JSON.parse(JSON.stringify(footer)), rows: lastRows.slice(), ok };
  }

  function getTemplateReplacements() {
    // base fields
    const logoUrl = String(footer['logo_url'] || '').trim();
    const companyName = String(footer['company_name'] || '').trim();
    const address = String(footer['address'] || '').trim();
    const mainNavShow = String(footer['main_nav_show'] || '').trim();
    const subNavShow  = String(footer['sub_nav_show'] || '').trim();
    // copyright variants
    let cp = String(footer['copyright'] || '').trim();
    if (!cp) cp = String(footer['copyrights'] || '').trim();
    return {
      logo_url: logoUrl,
      company_name: companyName,
      address: address,
      main_nav_show: mainNavShow,
      sub_nav_show: subNavShow,
      copyright: cp,
    };
  }

  function getAll() { return JSON.parse(JSON.stringify(footer)); }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
  };
})();
