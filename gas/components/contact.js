// contact シート処理を集約
// グローバル保持用（他コンポーネントと同様のパターン）
var contact = contact || {};

var ContactInfo = (function () {
  const SHEET_NAME = 'contact';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME = 'Logs';

  let lastRows = [];

  function applyContactColorVars_() {
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
  }

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
    const hasHeader = ((a1 === 'key' || a1 === 'field_name') && (b1 === 'value' || b1 === 'val' || b1 === 'input_value' || b1 === '値'));

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
    applyContactColorVars_();
    lastRows = rows.slice();
    return rows;
  }

  // Parameters 関連機能は廃止済み

  function getContactSheetValues_() {
    const overrideRows = (typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]);
    if (overrideRows) return overrideRows;
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) return [];
    return sh.getDataRange().getValues() || [];
  }

  function getStartRow_(values) {
    if (!values || values.length === 0) return 0;
    const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
    const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
    const hasHeader = ((a1 === 'key' || a1 === 'field_name') && (b1 === 'value' || b1 === 'val' || b1 === 'input_value' || b1 === '値'));
    return hasHeader ? 1 : 0;
  }

  function parseItemType_(rawInputType, inputValue) {
    const raw = String(rawInputType || '').trim();
    if (!raw) return null;

    const idx = raw.indexOf(':');
    if (idx < 0) return null;

    const type = raw.slice(0, idx).trim().toLowerCase();
    let label = raw.slice(idx + 1).trim();
    if (!type) return null;

    const isTelType = (type === 'tel' || type === 'tel-lg' || type === 'tel-upp');
    if (!label) {
      if (!isTelType) return null;
      label = String(inputValue || '').trim();
    }

    return { type, label, isTelType };
  }

  function parseItemColorStyleInfo_(itemColor) {
    const raw = String(itemColor || '').trim();
    if (!raw) {
      return { anchorStyleAttr: '', subStyleAttr: '' };
    }

    const parts = raw.split(':');
    const bg = (parts.shift() || '').trim();
    const textColor = (parts.shift() || '').trim();
    const subColor = parts.length ? parts.join(':').trim() : '';
    const anchorStyleParts = [];

    if (bg) anchorStyleParts.push(`background:${bg}`);
    if (textColor) anchorStyleParts.push(`color:${textColor}`);

    return {
      anchorStyleAttr: anchorStyleParts.length ? ` style="${anchorStyleParts.join(';')}"` : '',
      subStyleAttr: subColor ? ` style="color:${subColor}"` : ''
    };
  }

  function formatContactText_(value) {
    const raw = String(value || '');
    return (typeof Utils !== 'undefined' && Utils.br) ? Utils.br(raw) : raw;
  }

  function getContactItemEntriesFromValues_(values) {
    if (!values || values.length === 0) return [];

    const startRow = getStartRow_(values);
    const entries = [];
    for (let r = startRow; r < values.length; r++) {
      const fieldName = values[r][0] != null ? String(values[r][0]).trim() : '';
      if (fieldName !== 'item') continue;

      const inputValue = values[r][1] != null ? String(values[r][1]).trim() : '';
      const subValue = values[r][2] != null ? String(values[r][2]).trim() : '';
      const inputType = values[r][3] != null ? String(values[r][3]).trim() : '';
      const itemColor = values[r][4] != null ? String(values[r][4]).trim() : '';
      if (!inputValue || !inputType) continue;

      const parsed = parseItemType_(inputType, inputValue);
      if (!parsed) continue;

      let href = inputValue;
      if (parsed.isTelType) href = `tel:${inputValue}`;
      else if (parsed.type === 'mail') href = `mailto:${inputValue}`;

      const external = ['line', 'form', 'link'].includes(parsed.type);
      entries.push({
        type: parsed.type,
        mess: parsed.label,
        subValue,
        inputValue,
        href,
        external,
        itemColor,
      });
    }
    return entries;
  }

  function getContactItemEntries_() {
    return getContactItemEntriesFromValues_(getContactSheetValues_());
  }

  function buildGenericItemHtml_(entry, index) {
    if (!entry) return '';

    const typeClass = entry.type ? ` type-${entry.type}` : '';
    const targetAttr = entry.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const clickAttr = ` @click="onCtaClick($event, '${entry.type}', ${index})"`;
    const styleInfo = parseItemColorStyleInfo_(entry.itemColor);
    const subHtml = entry.subValue ? `<span class="sub"${styleInfo.subStyleAttr}>${formatContactText_(entry.subValue)}</span>` : '';
    return [
      `<div class="item${typeClass}">` ,
      `  <a href="${entry.href}"${targetAttr}${clickAttr}${styleInfo.anchorStyleAttr}>`,
      `    <span class="item-body"><span class="mess">${formatContactText_(entry.mess)}</span>${subHtml}</span>`,
      '  </a>',
      '</div>'
    ].join('\n');
  }

  function buildTelBoxHtml_(entry) {
    if (!entry) return '';

    const styleInfo = parseItemColorStyleInfo_(entry.itemColor);
    const telMessageHtml = entry.subValue ? `  <p class="tel-message">${formatContactText_(entry.subValue)}</p>` : '';
    return [
      '<div class="tel-box">' ,
      `  <p class="tel-number"><a href="tel:${entry.inputValue}"${styleInfo.anchorStyleAttr}>`,
      '    <i class="fa-solid fa-phone"></i>',
      `    <span>${formatContactText_(entry.mess)}</span>`,
      '  </a></p>',
      telMessageHtml,
      '</div>'
    ].filter(Boolean).join('\n');
  }

  function parseContactItems_() {
    return getContactItemEntries_();
  }

  function buildItemsHtml_() {
    try {
      const entries = getContactItemEntries_().filter(entry => entry.type !== 'tel-lg' && entry.type !== 'tel-upp');
      return entries.map((entry, index) => buildGenericItemHtml_(entry, index)).join('\n');
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`contact items 構築失敗: ${e.message}`, 'ContactInfo');
      }
      return '';
    }
  }

  function record() {
    if ((!lastRows || lastRows.length === 0) && typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]) {
      try {
        const values = globalThis.__snapshotOverrides[SHEET_NAME];
        if (values && values.length) {
          const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
          const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
          const hasHeader = ((a1 === 'key' || a1 === 'field_name') && (b1 === 'value' || b1 === 'val' || b1 === 'input_value' || b1 === '値'));
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
    applyContactColorVars_();
    const items = parseContactItems_();
    const ok = (items && items.length > 0) || (lastRows && lastRows.length > 0);
    return { contact: JSON.parse(JSON.stringify(contact)), rows: lastRows.slice(), items, ok };
  }

  function getTemplateReplacements() {
    const title = String(contact['title'] || '').trim();
    const message = String(contact['message'] || '').trim();
    const description = String(contact['description'] || '').trim();
    const titleHtml = title ? `<h2>${title}</h2>` : '';
    const messageHtml = message ? `<p class="message">${message}</p>` : '';
    const descriptionHtml = description ? `<p class="description">${description}</p>` : '';
    const itemEntries = getContactItemEntries_();
    const upperTelEntry = itemEntries.find(entry => entry.type === 'tel-upp') || null;
    const telBoxEntry = itemEntries.find(entry => entry.type === 'tel-lg') || null;
    const itemsHtml = buildItemsHtml_();
    return {
      title: titleHtml,
      message: messageHtml,
      description: descriptionHtml,
      upper_tel_box: buildTelBoxHtml_(upperTelEntry),
      tel_box: buildTelBoxHtml_(telBoxEntry),
      form_item: '',
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
