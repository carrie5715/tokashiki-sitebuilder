// グローバル保持
var works = works || {};

var WorksInfo = (function () {
  const SHEET_NAME            = 'works';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  function readWorks_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('「works」シートが見つかりません。');

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

      works[key] = val;
      rows.push({ category: 'works', key, value: val, note });
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

  function parseWorksItems_() {
    const items = [];
    const maxN = 200; // worksは多めに想定
    for (let i = 1; i <= maxN; i++) {
      const title = works[`card_${i}_title`];
      const tagsStr = works[`card_${i}_tags`];
      const desc = works[`card_${i}_description`];
      const link = works[`card_${i}_link`];
      const isExtRaw = works[`card_${i}_is_external`];
      const layoutRaw = works[`card_${i}_image_layout`];

      const image1 = works[`card_${i}_image1`];
      const image1_alt = works[`card_${i}_image1_alt`];
      // 将来的に image2.. も対応
      const imgs = [];
      if (image1 && String(image1).trim()) {
        imgs.push({ url: String(image1).trim(), alt: String(image1_alt || '').trim() });
      }

      // 何も無ければスキップ
      const hasAny = [title, tagsStr, desc, link, image1].some(v => v != null && String(v).trim() !== '');
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
        title, tagsRaw, description: desc, link, is_external, images: imgs, layout
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
        tags,
        description: String(it.description || ''),
        images: (it.images || []).map(im => ({ url: String(im.url||''), alt: String(im.alt||'') })),
        link: { url, is_external: isExt },
        layout: it.layout || 0,
      };
    });

    return out;
  }

  function writeWorksJson_(items) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');

      const json = JSON.stringify(items || [], null, 2);
      const filename = 'works.json';
      const files = dataFolder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        file.setContent(json);
      } else {
        const blob = Utilities.newBlob(json, 'application/json', filename);
        dataFolder.createFile(blob);
      }

      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`works.json を出力しました（${(items || []).length}件）`, 'WorksInfo');
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`works.json 出力エラー: ${e.message}`, 'WorksInfo');
      }
      throw e;
    }
  }

  // 公開API
  function readAndRecordWorks() {
    const rows = readWorks_();
    appendToParameters_(rows);

    // 新しいカラー変数（colors.css に出力）
    // 対象キーを列挙し、存在するものだけ CSS 変数へ: --pcol-works- + key ( _ -> - )
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
    } catch (e) {
      // noop
    }

    const items = parseWorksItems_();
    writeWorksJson_(items);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`works: ${Object.keys(works).length}件`, 'WorksInfo');
    }
    const ok = (items && items.length > 0) || (rows && rows.length > 0);
    return { works: JSON.parse(JSON.stringify(works)), rows, items, ok };
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
    readAndRecordWorks,
    getTemplateReplacements,
    getAll,
    // internal
    readWorks_: readWorks_,
    appendToParameters_: appendToParameters_,
    ensureParametersSheet_: ensureParametersSheet_,
    parseWorksItems_: parseWorksItems_,
    writeWorksJson_: writeWorksJson_,
  };
})();
