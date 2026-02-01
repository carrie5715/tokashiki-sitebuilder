// contact シート処理を集約
// グローバル保持用（他コンポーネントと同様のパターン）
var contact = contact || {};

var ContactInfo = (function () {
  const SHEET_NAME = 'contact';
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
      if (!sh) throw new Error('「contact」シートが見つかりません。');
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
      contact[key] = val;
      rows.push({ category: 'contact', key, value: val, note });
    }
    lastRows = rows.slice();
    return rows;
  }

  // Parameters 関連機能は廃止済み

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
          contact = {};
          for (let r = startRow; r < values.length; r++) {
            const key  = values[r][0] ? String(values[r][0]).trim() : '';
            const val  = values[r][1] != null ? values[r][1] : '';
            const note = values[r][2] != null ? String(values[r][2]) : '';
            if (!key) continue;
            contact[key] = val;
            rows.push({ category: 'contact', key, value: val, note });
          }
          lastRows = rows.slice();
        }
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('contact snapshot再構築失敗: ' + e.message, 'ContactInfo.record');
      }
    }
    try {
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        const colorKeys = [
          'background',
          'card_bg_color',
          'card_text_color',
          'card_item_bg_color',
          'card_item_text_color',
        ];
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
    const ok = (items && items.length > 0) || (lastRows && lastRows.length > 0);
    return { contact: JSON.parse(JSON.stringify(contact)), rows: lastRows.slice(), items, ok };
  }

  function getTemplateReplacements() {
    const title = String(contact['title'] || '').trim();
    const message = String(contact['message'] || '').trim();
    const description = String(contact['description'] || '').trim();
    const tel = String(contact['tel'] || '').trim();
    const telMess = String(contact['tel_mess'] || '').trim();
    const formUrl = String(contact['form_url'] || '').trim();
    const formMess = String(contact['form_mess'] || '').trim();
    const formSub = String(contact['form_sub'] || '').trim();
    const titleHtml = title ? `<h2>${title}</h2>` : '';
    const messageHtml = message ? `<p class="message">${message}</p>` : '';
    const descriptionHtml = description ? `<p class="description">${description}</p>` : '';
    let telBoxHtml = '';
    if (tel) {
      const safeTel = tel;
      const safeTelMess = telMess;
      telBoxHtml = [
        '<div class="tel-box">',
        `  <p class="tel-number"><a href="tel:${safeTel}">`,
        '    <i class="fa-solid fa-phone"></i>',
        `    <span>${safeTel}</span>`,
        '  </a></p>',
        safeTelMess ? `  <p class="tel-message">${safeTelMess}</p>` : '',
        '</div>'
      ].filter(Boolean).join('\n');
    }
    let formItemHtml = '';
    if (formUrl) {
      const safeUrl = formUrl;
      const safeSub = formSub;
      const safeMess = formMess;
      formItemHtml = [
        '<div class="item type-form">',
        `  <a href="${safeUrl}">`,
        '    <span class="item-body">',
        safeSub ? `      <span class="sub">${safeSub}</span>` : '',
        safeMess ? `      <span class="main">${safeMess}</span>` : '',
        '    </span>',
        '  </a>',
        '</div>'
      ].filter(Boolean).join('\n');
    }
    const itemsHtml = buildItemsHtml_();
    return {
      title: titleHtml,
      message: messageHtml,
      description: descriptionHtml,
      tel_box: telBoxHtml,
      form_item: formItemHtml,
      items: itemsHtml,
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(contact));
  }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
    parseContactItems_: parseContactItems_,
    buildItemsHtml_: buildItemsHtml_,
  };
})();
