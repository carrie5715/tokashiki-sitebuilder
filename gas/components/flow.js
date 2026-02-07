// グローバル保持
var flow = flow || {};

var FlowInfo = (function () {
  const SHEET_NAME            = 'flow';
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
      if (!sh) throw new Error('「flow」シートが見つかりません。');
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
      flow[key] = val;
      rows.push({ category: 'flow', key, value: val, note });
    }
    lastRows = rows.slice();
    return rows;
  }

  function parseFlowItems_() {
    const items = [];
    const maxN = 100;
    for (let i = 1; i <= maxN; i++) {
      const image    = flow[`item${i}_image`];
      const head     = flow[`item${i}_head`];
      const headSub  = flow[`item${i}_head_sub`];
      const text     = flow[`item${i}_text`];
      const hasAny = [image, head, headSub, text].some(v => v != null && String(v).trim() !== '');
      if (!hasAny) continue;
      items.push({
        index: i,
        image: String(image || ''),
        head: String(head || ''),
        head_sub: String(headSub || ''),
        text: String(text || ''),
      });
    }
    return items;
  }

  function writeFlowJson_(items) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');
      const json = JSON.stringify(items || [], null, 2);
      const filename = 'flow.json';
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
        Utils.logToSheet(`flow.json 出力エラー: ${e.message}`, 'FlowInfo');
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
          flow = {};
          for (let r = startRow; r < values.length; r++) {
            const key  = values[r][0] ? String(values[r][0]).trim() : '';
            const val  = values[r][1] != null ? values[r][1] : '';
            const note = values[r][2] != null ? String(values[r][2]) : '';
            if (!key) continue;
            flow[key] = val;
            rows.push({ category: 'flow', key, value: val, note });
          }
          lastRows = rows.slice();
        }
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('flow snapshot再構築失敗: ' + e.message, 'FlowInfo.record');
      }
    }
    try {
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        const map = {
          bg_color: '--pcol-flow-bg-color',
          text_color: '--pcol-flow-text-color',
          accent_color: '--pcol-flow-accent-color',
          card_num_color: '--pcol-flow-card-num-color',
          card_head_color: '--pcol-flow-card-head-color',
          card_head_sub_color: '--pcol-flow-card-head-sub-color',
          card_text_color: '--pcol-flow-card-text-color',
        };
        Object.keys(map).forEach(k => {
          const v = flow[k];
          if (v != null && String(v).trim() !== '') {
            CommonInfo.addColorVar(map[k], String(v));
          }
        });
      }
    } catch (_) {}

    let items;
    if (typeof globalThis !== 'undefined' && globalThis.__processedSnapshot && globalThis.__processedSnapshot.flow && globalThis.__processedSnapshot.flow.data && globalThis.__processedSnapshot.flow.data.items) {
      try { items = JSON.parse(JSON.stringify(globalThis.__processedSnapshot.flow.data.items)); } catch(_) { items = parseFlowItems_(); }
    } else {
      items = parseFlowItems_();
    }
    writeFlowJson_(items);
    const ok = (items && items.length > 0) || (lastRows && lastRows.length > 0);
    return { flow: JSON.parse(JSON.stringify(flow)), rows: lastRows.slice(), items, ok };
  }

  function getTemplateReplacements() {
    const h2Sub = Utils.br(flow['h2_sub']);
    const h2Main = Utils.br(flow['h2']);
    const sectionLead = Utils.br(flow['section_lead']);
    const typeVal = String(flow['type'] || '').trim();
    const classes = typeVal ? `type-${typeVal}` : '';

    let sectionLeadHtml = '';
    if (sectionLead) {
      sectionLeadHtml = `<div class="section-lead">${sectionLead}</div>`;
    }

    return {
      h2_sub: h2Sub || '',
      h2: h2Main || '',
      section_lead: sectionLeadHtml,
      flow_classes: classes,
    };
  }

  function getAll() { return JSON.parse(JSON.stringify(flow)); }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
    parseFlowItems_: parseFlowItems_,
    writeFlowJson_: writeFlowJson_,
  };
})();
