// contact シート処理を集約
// グローバル保持用（他コンポーネントと同様のパターン）
var contact = contact || {};

var ContactInfo = (function () {
  const SHEET_NAME = 'contact';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME = 'Logs';

  function readContact_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('「contact」シートが見つかりません。');

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
      contact[key] = val;
      rows.push({ category: 'contact', key, value: val, note });
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

  function parseContactItems_() {
    const items = [];
    const maxN = 500;
    for (let i = 1; i <= maxN; i++) {
      const rawVal = contact[`item${i}`];
      const meta = contact[`item${i}_meta`]; // メタを別保存する場合の拡張余地（現状は直接 rows から取得済）
      // 既存シート構造では itemN の行(C列)に ident:label を含むため、readContact_ では note として保存済み
      // ここでは rows から再走査せず contact マップの値のみ利用（label/metaは後段HTML構築時に再取得）
      if (rawVal == null || String(rawVal).trim() === '') continue;
      items.push({ value: String(rawVal) });
    }
    return items; // 現段階ではシンプルな配列（HTML構築時に詳細要素化）
  }

  function buildItemsHtml_() {
    let html = '';
    try {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName(SHEET_NAME);
      if (!sh) return '';
      const values = sh.getDataRange().getValues();
      if (!values || values.length === 0) return '';
      const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
      const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
      const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
      const startRow = hasHeader ? 1 : 0;
      const chunks = [];
      for (let r = startRow; r < values.length; r++) {
        const key = values[r][0] != null ? String(values[r][0]).trim() : '';
        if (!/^item\d+$/i.test(key)) continue;
        const rawVal = values[r][1] != null ? String(values[r][1]).trim() : '';
        const meta = values[r][2] != null ? String(values[r][2]).trim() : '';
        if (!rawVal && !meta) continue;
        let ident = '';
        let label = '';
        if (meta && meta.includes(':')) {
          const idx = meta.indexOf(':');
          ident = meta.slice(0, idx).trim().toLowerCase();
          label = meta.slice(idx + 1).trim();
        } else {
          ident = (meta || '').trim().toLowerCase();
          label = '';
        }
        const typeClass = ident ? ` type-${ident}` : '';
        let href = rawVal;
        if (ident === 'tel') href = `tel:${rawVal}`;
        else if (ident === 'mail') href = `mailto:${rawVal}`;
        const openInNew = (ident === 'line' || ident === 'form' || ident === 'link');
        const targetAttr = openInNew ? ' target="_blank" rel="noopener noreferrer"' : '';
        const body = label || rawVal || '';
        const indexInList = chunks.length;
        const clickAttr = ` @click="onCtaClick($event, '${ident}', ${indexInList})"`;
        const itemHtml =
          `<div class="item${typeClass}">\n` +
          `  <a href="${href}"${targetAttr}${clickAttr}>\n` +
          `    <span class="item-body">${body}</span>\n` +
          `  </a>\n` +
          `</div>`;
        chunks.push(itemHtml);
      }
      html = chunks.join('\n');
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`contact items 構築失敗: ${e.message}`, 'ContactInfo');
      }
    }
    return html;
  }

  function readAndRecordContact() {
    const rows = readContact_();
    appendToParameters_(rows);

    // カラー変数登録
    try {
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        const colorKeys = [ 'background', 'card_bg_color', 'card_text_color' ];
        colorKeys.forEach(k => {
          const v = contact[k];
          if (v != null && String(v).trim() !== '') {
            const cssName = '--pcol-contact-' + k.replace(/_/g, '-');
            CommonInfo.addColorVar(cssName, String(v));
          }
        });
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`contact 色変数登録失敗: ${e.message}`, 'ContactInfo');
      }
    }

    const items = parseContactItems_();
    const ok = (items && items.length > 0) || (rows && rows.length > 0);
    return { contact: JSON.parse(JSON.stringify(contact)), rows, items, ok };
  }

  function getTemplateReplacements() {
    const title = String(contact['title'] || '').trim();
    const message = String(contact['message'] || '').trim();
    const description = String(contact['description'] || '').trim();
    const titleHtml = title ? `<h2>${title}</h2>` : '';
    const messageHtml = message ? `<p class="message">${message}</p>` : '';
    const descriptionHtml = description ? `<p class="description">${description}</p>` : '';
    const itemsHtml = buildItemsHtml_();
    return {
      title: titleHtml,
      message: messageHtml,
      description: descriptionHtml,
      items: itemsHtml,
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(contact));
  }

  return {
    readAndRecordContact,
    getTemplateReplacements,
    getAll,
    // internal
    readContact_: readContact_,
    appendToParameters_: appendToParameters_,
    ensureParametersSheet_: ensureParametersSheet_,
    parseContactItems_: parseContactItems_,
    buildItemsHtml_: buildItemsHtml_,
  };
})();
