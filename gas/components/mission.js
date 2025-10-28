// グローバル保持
var mission = mission || {};

var MissionInfo = (function () {
  const SHEET_NAME            = 'mission';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  function readMission_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('「mission」シートが見つかりません。');

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

      // グローバルに保存
      mission[key] = val;

      // Parameters へ渡す行（カテゴリは "mission" 固定）
      rows.push({ category: 'mission', key, value: val, note });
    }

    // カラー変数（colors.cssに追記）
    try {
      const bg = mission['bg_color'];
      const tx = mission['text_color'];
      const hd = mission['heading_color'];
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addCssVar) {
        // 変数接頭辞を --pcol- に統一
        if (bg) CommonInfo.addCssVar('--pcol-mission-bg-color', String(bg));
        if (tx) CommonInfo.addCssVar('--pcol-mission-text-color', String(tx));
        if (hd) CommonInfo.addCssVar('--pcol-mission-heading-color', String(hd));
      }
    } catch (e) {
      // noop（色指定がなくても続行）
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

    // CommonInfo が持つ append を使えるならそれを使う（列揃えの一貫性）
    if (typeof CommonInfo !== 'undefined' && CommonInfo.appendToParameters_) {
      return CommonInfo.appendToParameters_(rows);
    }

    const sh = ensureParametersSheet_();
    const start = Math.max(sh.getLastRow(), 1) + 1;
    const values = rows.map(r => [r.category, r.key, r.value, r.note || '']);
    sh.getRange(start, 1, values.length, 4).setValues(values);
  }

  // スライド配列を mission.* から生成
  function buildSlides_() {
    const slides = [];
    for (let i = 1; i <= 5; i++) {
      const img = mission[`slide_${i}_image`];
      const alt = mission[`slide_${i}_alt`];
      const cap = mission[`slide_${i}_caption`];
      const typ = mission[`slide_${i}_type`];
      if (!img) continue; // 画像が無ければスキップ
      slides.push({
        image: String(img),
        alt: String(alt || ''),
        type: (typ == null || String(typ).trim() === '') ? 0 : Number(typ),
        caption: String(cap || ''),
      });
    }
    return slides;
  }

  // JSON を output/data/mission.json に保存
  function writeMissionJson_(slides) {
    try {
      const props = PropertiesService.getScriptProperties();
      const outRootId = props.getProperty(PROP_KEYS.OUTPUT_ID);
      if (!outRootId) throw new Error('出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');
      const outRoot = DriveApp.getFolderById(outRootId);
      const dataFolder = Utils.getOrCreateSubFolder_(outRoot, 'data');

      const json = JSON.stringify(slides || [], null, 2);
      const filename = 'mission.json';
      const files = dataFolder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        file.setContent(json);
      } else {
        const blob = Utilities.newBlob(json, 'application/json', filename);
        dataFolder.createFile(blob);
      }

      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`mission.json を出力しました（${(slides || []).length}件）`, 'MissionInfo');
      }
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`mission.json 出力エラー: ${e.message}`, 'MissionInfo');
      }
      throw e;
    }
  }

  // 公開API: 読み込み + Parameters 追記 + JSON保存 + 概要返却
  function readAndRecordMission() {
    const rows = readMission_();
    appendToParameters_(rows);

    const slides = buildSlides_();
    writeMissionJson_(slides);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`mission: ${Object.keys(mission).length}件`, 'MissionInfo');
    }
    const ok = (slides && slides.length > 0) || (rows && rows.length > 0);
    return { mission: JSON.parse(JSON.stringify(mission)), rows, slides, ok };
  }

  // テンプレ置換用（改行は <br> に変換）
  function getTemplateReplacements() {
    const br = (s) => String(s == null ? '' : s).replace(/\r\n|\r|\n/g, '<br>');
    return {
      mission_heading_text: br(mission['heading_text']),
      mission_intro_text: br(mission['intro_text']),
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(mission));
  }

  return {
    readAndRecordMission,
    getTemplateReplacements,
    getAll,
    // 内部API
    readMission_: readMission_,
    appendToParameters_: appendToParameters_,
    ensureParametersSheet_: ensureParametersSheet_,
    buildSlides_: buildSlides_,
    writeMissionJson_: writeMissionJson_,
  };
})();
