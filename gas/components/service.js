// グローバル保持
var service = service || {};

var ServiceInfo = (function () {
  const SHEET_NAME            = 'service';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  let lastRows = [];

  function loadFromValues_(values) {
    if (!values || values.length === 0) return [];

    const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
    const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
    const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));

    const rows = [];
    const startRow = hasHeader ? 1 : 0;
    let noticeIndex = 0;

    service = {};

    for (let r = startRow; r < values.length; r++) {
      const rawKey = values[r][0] ? String(values[r][0]).trim() : '';
      const val    = values[r][1] != null ? values[r][1] : '';
      const note   = values[r][2] != null ? String(values[r][2]) : '';
      if (!rawKey) continue;

      let key = rawKey;
      if (rawKey === 'notice') {
        noticeIndex += 1;
        key = (noticeIndex === 1) ? 'notice' : `notice_${noticeIndex}`;
      }

      service[key] = val;
      rows.push({ category: 'service', key, value: val, note });
    }

    return rows;
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
      if (!sh) throw new Error('「service」シートが見つかりません。');
      values = sh.getDataRange().getValues();
    }
    const rows = loadFromValues_(values);

    // セクション固有カラーのCSS変数を登録
    try {
      const bg1Col      = service['bg_color_1'];
      const bg2Col      = service['bg_color_2'];
      const tagBgCol    = service['tag_bg_color'];
      const tagTextCol  = service['tag_text_color'];
      const listTextCol = service['list_text_color'];
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        if (bg1Col != null && String(bg1Col).trim() !== '') {
          CommonInfo.addColorVar('--pcol-service-bg-color-1', String(bg1Col));
        }
        if (bg2Col != null && String(bg2Col).trim() !== '') {
          CommonInfo.addColorVar('--pcol-service-bg-color-2', String(bg2Col));
        }
        if (tagBgCol != null && String(tagBgCol).trim() !== '') {
          CommonInfo.addColorVar('--pcol-service-tag-bg-color', String(tagBgCol));
        }
        if (tagTextCol != null && String(tagTextCol).trim() !== '') {
          CommonInfo.addColorVar('--pcol-service-tag-text-color', String(tagTextCol));
        }
        if (listTextCol != null && String(listTextCol).trim() !== '') {
          CommonInfo.addColorVar('--pcol-service-list-text-color', String(listTextCol));
        }
      }
    } catch (e) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('service 色変数登録失敗: ' + e.message, 'ServiceInfo.read');
    }

    lastRows = rows.slice();
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
    // セクション共通設定
    const rawTagStyle = (service['tag_style'] != null ? String(service['tag_style']).trim().toLowerCase() : '');
    const tagStyle = (rawTagStyle === 'list') ? 'list' : 'tag';

    // service_1_*, service_2_* ... を集約
    const items = [];
    const maxN = 50; // 念のため上限
    for (let i = 1; i <= maxN; i++) {
      const title = service[`service_${i}_title`];
      const subtitle = service[`service_${i}_subtitle`];
      const description = service[`service_${i}_description`];
      const image = service[`service_${i}_image`];
      const image_alt = service[`service_${i}_image_alt`];
      const tagsStr = service[`service_${i}_tags`];
      const button_label = service[`service_${i}_button_label`];
      const button_link = service[`service_${i}_button_link`];

      // 何も無ければ次へ
      const hasAny = [title, subtitle, description, image, tagsStr, button_link].some(v => v != null && String(v).trim() !== '');
      if (!hasAny) continue;

      const tagsRaw = (typeof tagsStr === 'string' ? tagsStr.split(',') : []).map(s => String(s).trim()).filter(Boolean);
      items.push({
        title, subtitle, description, image, image_alt, tagsRaw, button_label, button_link
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
        tag_style: tagStyle,
        tags,
      };
    });

    return out;
  }

  // 注釈（notice_*）をまとめてHTML断片にする
  function buildNoticesHtml_() {
    try {
      if (!service) return '';

      const entries = Object.keys(service)
        .filter(k => k === 'notice' || /^notice_\d+$/.test(k))
        .map(k => {
          const m = k.match(/^notice_(\d+)$/);
          const order = m ? parseInt(m[1], 10) : 0;
          const value = service[k];
          return { key: k, order, value };
        })
        .filter(e => e.value != null && String(e.value).trim() !== '')
        .sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.key.localeCompare(b.key);
        });

      if (!entries.length) return '';

      const parts = entries.map(e => {
        const raw = String(e.value);
        const text = (typeof Utils !== 'undefined' && Utils.br)
          ? Utils.br(raw)
          : raw;
        return `<p class=\"notice\">${text}</p>`;
      });

      // notice が1件以上ある場合のみ .notice-area ごと返す
      return `<div class=\"notice-area\">\n${parts.join('\n')}\n<\/div>`;
    } catch (_) {
      return '';
    }
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
  function record() {
    if ((!lastRows || lastRows.length === 0) && typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]) {
      try {
        const values = globalThis.__snapshotOverrides[SHEET_NAME];
        if (values && values.length) {
          const rows = loadFromValues_(values);
          lastRows = rows.slice();

          // snapshot 経由時も色変数を再登録
          try {
            const bg1Col      = service['bg_color_1'];
            const bg2Col      = service['bg_color_2'];
            const tagBgCol    = service['tag_bg_color'];
            const tagTextCol  = service['tag_text_color'];
            const listTextCol = service['list_text_color'];
            if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
              if (bg1Col != null && String(bg1Col).trim() !== '') {
                CommonInfo.addColorVar('--pcol-service-bg-color-1', String(bg1Col));
              }
              if (bg2Col != null && String(bg2Col).trim() !== '') {
                CommonInfo.addColorVar('--pcol-service-bg-color-2', String(bg2Col));
              }
              if (tagBgCol != null && String(tagBgCol).trim() !== '') {
                CommonInfo.addColorVar('--pcol-service-tag-bg-color', String(tagBgCol));
              }
              if (tagTextCol != null && String(tagTextCol).trim() !== '') {
                CommonInfo.addColorVar('--pcol-service-tag-text-color', String(tagTextCol));
              }
              if (listTextCol != null && String(listTextCol).trim() !== '') {
                CommonInfo.addColorVar('--pcol-service-list-text-color', String(listTextCol));
              }
            }
          } catch (e2) {
            if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('service 色変数再登録失敗: ' + e2.message, 'ServiceInfo.record');
          }
        }
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('service snapshot再構築失敗: ' + e.message, 'ServiceInfo.record');
      }
    }
    // 前倒しパース済み items があれば利用
    let items;
    if (typeof globalThis !== 'undefined' && globalThis.__processedSnapshot && globalThis.__processedSnapshot.service && globalThis.__processedSnapshot.service.data && globalThis.__processedSnapshot.service.data.items) {
      try {
        items = JSON.parse(JSON.stringify(globalThis.__processedSnapshot.service.data.items));
      } catch(_) { items = parseItems_(); }
    } else {
      items = parseItems_();
    }
    writeServiceJson_(items);
    const ok = (items && items.length > 0) || (lastRows && lastRows.length > 0);
    return { service: JSON.parse(JSON.stringify(service)), rows: lastRows.slice(), items, ok };
  }

  function getTemplateReplacements() {
    return {
      section_title: String(service['section_title'] || ''),
      section_title_en: String(service['section_title_en'] || ''),
      section_intro: String(service['section_intro'] || ''),
      service_notices: buildNoticesHtml_(),
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(service));
  }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
    parseItems_: parseItems_,
    writeServiceJson_: writeServiceJson_,
  };
})();
