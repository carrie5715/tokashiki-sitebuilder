// グローバル保持
var service = service || {};

var ServiceInfo = (function () {
  const SHEET_NAME            = 'service';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  function readService_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('「service」シートが見つかりません。');

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

      service[key] = val;
      rows.push({ category: 'service', key, value: val, note });
    }
    return rows;
  }

  // Parameters 関連機能は廃止済み

  // カンマ区切りタグから共通のIDマップを生成（出現順で service_tag_1.. を採番）
  function buildTagDict_(items) {
    const dict = {}; // name -> id
    let idx = 1;
    items.forEach(it => {
      const names = (it.tagsRaw || []).filter(Boolean);
      names.forEach(n => {
        const name = String(n).trim();
        if (!name) return;
        if (!dict[name]) {
          dict[name] = `service_tag_${idx++}`;
        }
      });
    });
    return dict;
  }

  function parseItems_() {
    // service_1_*, service_2_* ... を集約
    const items = [];
    const maxN = 50; // 念のため上限
    for (let i = 1; i <= maxN; i++) {
      const title = service[`service_${i}_title`];
      const subtitle = service[`service_${i}_subtitle`];
      const description = service[`service_${i}_description`];
      const image = service[`service_${i}_image`];
      const image_alt = service[`service_${i}_image_alt`];
      const image_aspect = service[`service_${i}_image_aspect`];
      const tagsStr = service[`service_${i}_tags`];
      const button_label = service[`service_${i}_button_label`];
      const button_link = service[`service_${i}_button_link`];

      // 何も無ければ次へ
      const hasAny = [title, subtitle, description, image, tagsStr, button_link].some(v => v != null && String(v).trim() !== '');
      if (!hasAny) continue;

      const tagsRaw = (typeof tagsStr === 'string' ? tagsStr.split(',') : []).map(s => String(s).trim()).filter(Boolean);
      items.push({
        title, subtitle, description, image, image_alt, image_aspect, tagsRaw, button_label, button_link
      });
    }

    // タグ辞書
    const tagDict = buildTagDict_(items);

    // 最終配列構築
    const out = items.map(it => {
      const url = it.button_link ? String(it.button_link).trim() : '';
      const isExt = /^https?:\/\//i.test(url);
      const imgUrl = it.image ? String(it.image).trim() : '';
      const alt = (it.image_alt && String(it.image_alt).trim()) ? String(it.image_alt).trim() : String(it.title || '');
      const tags = (it.tagsRaw || []).filter(Boolean).map(name => ({ id: tagDict[name], name }));
      // layout は未指定時は 0 固定
      const layout = 0;
      return {
        title: String(it.title || ''),
        subtitle: String(it.subtitle || ''),
        description: String(it.description || ''),
        more_link: { url, is_external: isExt },
        image: { url: imgUrl, alt },
        layout,
        tags,
      };
    });

    return out;
  }

  // JSON を output/data/service.json に保存
  function writeServiceJson_(items) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');

      const json = JSON.stringify(items || [], null, 2);
      const filename = 'service.json';
      const files = dataFolder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        file.setContent(json);
      } else {
        const blob = Utilities.newBlob(json, 'application/json', filename);
        dataFolder.createFile(blob);
      }

      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        // Utils.logToSheet(`service.json を出力しました（${(items || []).length}件）`, 'ServiceInfo');
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`service.json 出力エラー: ${e.message}`, 'ServiceInfo');
      }
      throw e;
    }
  }

  // 公開API
  function readAndRecordService() {
    const rows = readService_();

    const items = parseItems_();
    writeServiceJson_(items);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      // Utils.logToSheet(`service: ${Object.keys(service).length}件`, 'ServiceInfo');
    }
    const ok = (items && items.length > 0) || (rows && rows.length > 0);
    return { service: JSON.parse(JSON.stringify(service)), rows, items, ok };
  }

  function getTemplateReplacements() {
    return {
      section_title: String(service['section_title'] || ''),
      section_title_en: String(service['section_title_en'] || ''),
      section_intro: String(service['section_intro'] || ''),
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(service));
  }

  return {
    readAndRecordService,
    getTemplateReplacements,
    getAll,
    // 内部
    readService_: readService_,
    // appendToParameters_, ensureParametersSheet_ は廃止
    parseItems_: parseItems_,
    writeServiceJson_: writeServiceJson_,
  };
})();
