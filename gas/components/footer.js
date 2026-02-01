// footer シート処理を集約
var footer = footer || {};

var FooterInfo = (function() {
  const SHEET_NAME = 'footer';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME = 'Logs';

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
      if (!sh) return [];
      values = sh.getDataRange().getValues();
    }
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
    if ((!lastRows || lastRows.length === 0) && typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]) {
      try {
        const values = globalThis.__snapshotOverrides[SHEET_NAME];
        if (values && values.length) {
          const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
          const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
          const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
          const startRow = hasHeader ? 1 : 0;
          const rows = [];
          footer = {};
          for (let r = startRow; r < values.length; r++) {
            const key  = values[r][0] ? String(values[r][0]).trim() : '';
            const val  = values[r][1] != null ? values[r][1] : '';
            const note = values[r][2] != null ? String(values[r][2]) : '';
            if (!key) continue;
            footer[key] = val;
            rows.push({ category: 'footer', key, value: val, note });
          }
          lastRows = rows.slice();
        }
      } catch (e) {
        if (typeof Utils !== 'undefined' && Utils.logToSheet) {
          Utils.logToSheet('footer snapshot再構築失敗: ' + e.message, 'FooterInfo.record');
        }
      }
    }
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

    // company_name / address は「基本設定」シート優先（siteInfos）
    let companyName = '';
    let address = '';
    if (typeof siteInfos !== 'undefined' && siteInfos) {
      companyName = String(siteInfos['company_name'] || '').trim();
      address = String(siteInfos['address'] || '').trim();
    }
    if (!companyName) companyName = String(footer['company_name'] || '').trim();
    if (!address) address = String(footer['address'] || '').trim();
    const mainNavShow = String(footer['main_nav_show'] || '').trim();
    const subNavShow  = String(footer['sub_nav_show'] || '').trim();

    // SNS リンク（基本設定シート優先、無ければ footer シート）
    let xUrl = '';
    let igUrl = '';
    let fbUrl = '';
    if (typeof siteInfos !== 'undefined' && siteInfos) {
      xUrl = String(siteInfos['x'] || '').trim();
      igUrl = String(siteInfos['instagram'] || '').trim();
      fbUrl = String(siteInfos['facebook'] || '').trim();
    }
    if (!xUrl) xUrl = String(footer['x'] || '').trim();
    if (!igUrl) igUrl = String(footer['instagram'] || '').trim();
    if (!fbUrl) fbUrl = String(footer['facebook'] || '').trim();

    let snsLinksHtml = '';
    const snsChunks = [];
    if (xUrl) {
      snsChunks.push(`  <a class="sns-x" href="${xUrl}" target="_blank" rel="noopener noreferrer"><\/a>`);
    }
    if (igUrl) {
      snsChunks.push(`  <a class="sns-instagram" href="${igUrl}" target="_blank" rel="noopener noreferrer"><\/a>`);
    }
    if (fbUrl) {
      snsChunks.push(`  <a class="sns-facebook" href="${fbUrl}" target="_blank" rel="noopener noreferrer"><\/a>`);
    }
    if (snsChunks.length > 0) {
      snsLinksHtml = ['<div class="sns-links">', snsChunks.join('\n'), '<\/div>'].join('\n');
    }

    // copyrights は「基本設定」シート優先（siteInfos）、無ければ footer シート
    let cp = '';
    if (typeof siteInfos !== 'undefined' && siteInfos) {
      cp = String((siteInfos['copyrights'] || siteInfos['copyright'] || '')).trim();
    }
    if (!cp) {
      cp = String((footer['copyrights'] || footer['copyright'] || '')).trim();
    }
    return {
      logo_url: logoUrl,
      company_name: companyName,
      address: address,
      main_nav_show: mainNavShow,
      sub_nav_show: subNavShow,
      sns_links: snsLinksHtml,
      copyrights: cp,
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
