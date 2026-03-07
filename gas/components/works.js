// グローバル保持
var works = works || {};

var WorksInfo = (function () {
  const SHEET_NAME            = 'works';
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
      // works は works1, works2 ... のみで運用されるケースもあるため
      // ベースシート「works」が無い場合はエラーにせず空扱いとする
      if (!sh) {
        works = {};
        lastRows = [];
        return [];
      }
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

      works[key] = val;
      rows.push({ category: 'works', key, value: val, note });
    }
    lastRows = rows.slice();
    return rows;
  }

  // Parameters 関連機能は廃止済み

  function buildTagDict_(items) {
    const dict = {}; // name -> id (works_tag_1..)
    let idx = 1;
    items.forEach(it => {
      const names = (it.tagsRaw || []).filter(Boolean);
      names.forEach(n => {
        const name = String(n).trim();
        if (!name) return;
        if (!dict[name]) {
          dict[name] = `works_tag_${idx++}`;
        }
      });
    });
    return dict;
  }

  function parseWorksItemsFromMap_(map) {
    const items = [];
    const maxN = 200; // worksは多めに想定
    for (let i = 1; i <= maxN; i++) {
      const title = map[`card_${i}_title`];
      const subtitle = map[`card_${i}_subtitle`];
      const tagsStr = map[`card_${i}_tags`];
      const desc = map[`card_${i}_description`];
      const link = map[`card_${i}_link`];
      const isExtRaw = map[`card_${i}_is_external`];
      const layoutRaw = map[`card_${i}_image_layout`];

      const image1 = map[`card_${i}_image1`];
      const image1_alt = map[`card_${i}_image1_alt`];
      // 将来的に image2.. も対応
      const imgs = [];
      if (image1 && String(image1).trim()) {
        imgs.push({ url: String(image1).trim(), alt: String(image1_alt || '').trim() });
      }

      // 何も無ければスキップ
      const hasAny = [title, subtitle, tagsStr, desc, link, image1].some(v => v != null && String(v).trim() !== '');
      if (!hasAny) continue;

      const tagsRaw = (typeof tagsStr === 'string' ? tagsStr.split(',') : []).map(s => String(s).trim()).filter(Boolean);

      // is_external の解釈
      let is_external = false;
      if (isExtRaw != null) {
        const s = String(isExtRaw).trim().toLowerCase();
        is_external = (s === 'true' || s === '1' || s === 'yes' || s === 'y');
      } else if (link) {
        is_external = /^https?:\/\//i.test(String(link));
      }

      const layout = (layoutRaw == null || String(layoutRaw).trim() === '') ? 0 : Number(layoutRaw);

      items.push({
        idx: i,
        title, subtitle, tagsRaw, description: desc, link, is_external, images: imgs, layout
      });
    }

    const tagDict = buildTagDict_(items);
    const out = items.map(it => {
      const url = it.link ? String(it.link).trim() : '';
      const isExt = !!it.is_external;
      const tags = (it.tagsRaw || []).map(name => ({ id: tagDict[name], name }));
      return {
        id: `work-${it.idx}`,
        title: String(it.title || ''),
        subtitle: String(it.subtitle || ''),
        tags,
        description: String(it.description || ''),
        images: (it.images || []).map(im => ({ url: String(im.url||''), alt: String(im.alt||'') })),
        link: { url, is_external: isExt },
        layout: it.layout || 0,
      };
    });

    return out;
  }

  // 互換用: 既存処理はグローバルworksを使う
  function parseWorksItems_() {
    return parseWorksItemsFromMap_(works);
  }

  function writeJsonForSheet_(sheetKey, items) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');

      const json = JSON.stringify(items || [], null, 2);
      const filename = `${sheetKey}.json`;
      const files = dataFolder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        file.setContent(json);
      } else {
        const blob = Utilities.newBlob(json, 'application/json', filename);
        dataFolder.createFile(blob);
      }

      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        // Utils.logToSheet(`${filename} を出力しました（${(items || []).length}件）`, 'WorksInfo');
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`works系JSON 出力エラー: ${e.message}`, 'WorksInfo');
      }
      throw e;
    }
  }

  // 既存API互換: works.json 固定出力
  function writeWorksJson_(items) {
    return writeJsonForSheet_(SHEET_NAME, items);
  }

  // 任意のworks系シートから items を構築し JSON を出力
  function buildFromSheet(sheetName) {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(sheetName);
    if (!sh) throw new Error(`「${sheetName}」シートが見つかりません。`);

    const values = sh.getDataRange().getValues();
    if (!values || values.length === 0) {
      writeJsonForSheet_(sheetName, []);
      return { sheetName, items: [], ok: false };
    }

    const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
    const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
    const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));

    const localMap = {};
    const startRow = hasHeader ? 1 : 0;
    for (let r = startRow; r < values.length; r++) {
      const key  = values[r][0] ? String(values[r][0]).trim() : '';
      const val  = values[r][1] != null ? values[r][1] : '';
      if (!key) continue;
      localMap[key] = val;
    }

    const items = parseWorksItemsFromMap_(localMap);
    writeJsonForSheet_(sheetName, items);
    const ok = items && items.length > 0;
    return { sheetName, items, ok };
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
          works = {};
          for (let r = startRow; r < values.length; r++) {
            const key  = values[r][0] ? String(values[r][0]).trim() : '';
            const val  = values[r][1] != null ? values[r][1] : '';
            const note = values[r][2] != null ? String(values[r][2]) : '';
            if (!key) continue;
            works[key] = val;
            rows.push({ category: 'works', key, value: val, note });
          }
          lastRows = rows.slice();
        }
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('works snapshot再構築失敗: ' + e.message, 'WorksInfo.record');
      }
    }
    try {
      const colorKeys = [
        'base_bg_color',
        'base_text_color',
        'base_tag_bg',
        'base_tag_text',
        'acc_bg_color',
        'acc_text_color',
        'acc_tag_bg',
        'acc_tag_text'
      ];
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        colorKeys.forEach(k => {
          const v = works[k];
          if (v != null && String(v).trim() !== '') {
            const cssName = '--pcol-works-' + k.replace(/_/g, '-');
            CommonInfo.addColorVar(cssName, String(v));
          }
        });
      }
    } catch (e) {}
    // 前倒しパース済み items 利用（存在すれば parseWorksItems_ スキップ）
    let items;
    if (typeof globalThis !== 'undefined' && globalThis.__processedSnapshot && globalThis.__processedSnapshot.works && globalThis.__processedSnapshot.works.data && globalThis.__processedSnapshot.works.data.items) {
      try { items = JSON.parse(JSON.stringify(globalThis.__processedSnapshot.works.data.items)); } catch(_) { items = parseWorksItems_(); }
    } else {
      items = parseWorksItems_();
    }
    writeWorksJson_(items);
    const ok = (items && items.length > 0) || (lastRows && lastRows.length > 0);
    return { works: JSON.parse(JSON.stringify(works)), rows: lastRows.slice(), items, ok };
  }

  function getTemplateReplacements() {
    return {
      section_title: String(works['section_title'] || ''),
      section_intro: String(works['section_intro'] || ''),
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(works));
  }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
    parseWorksItems_: parseWorksItems_,
    writeWorksJson_: writeWorksJson_,
    buildFromSheet: buildFromSheet,
  };
})();
