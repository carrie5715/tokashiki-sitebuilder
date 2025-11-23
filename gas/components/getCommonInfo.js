// グローバル保持
var siteInfos = siteInfos || {};
var colors    = colors || {};
// 追加のカスタムCSS変数（--xxx 形式でそのまま出力）
var cssVars   = cssVars || {};
// colors.css に出したい追加変数（--pcol-xxx 等）
var colorVars = colorVars || {};
// body に付与するクラスの蓄積（重複排除して出力）
var bodyClassBag = bodyClassBag || [];

var CommonInfo = (function () {
  const BASIC_SHEET_NAME      = '基本設定';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  // 上部1行を安全に固定（行数が少ない場合の例外を回避）
  function safeFreezeTopRow_(sheet) {
    try {
      if (!sheet) return;
      // 1行しかないと setFrozenRows(1) で「全行を固定」例外になるため、行を追加してから固定
      if (sheet.getMaxRows() <= 1) {
        sheet.insertRowsAfter(1, 1);
      }
      sheet.setFrozenRows(1);
    } catch (e) {
      // 固定に失敗しても致命的ではないので継続
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`safeFreezeTopRow エラー: ${e.message}`, 'CommonInfo');
      }
    }
  }

  // 保存対象キー
  const SITE_KEYS = [
    'company_name', 'address', 'template', 'top_url', 'logo_url', 'contact_url', 'contact_is_external',
    // 追加: フッター用
    'copyright', 'copyrights',
    // 追加: フォント系（クラス付与に使用）
    'base_font'
  ];
  const COLOR_KEYS = [
    'theme_color', 'base_color1', 'base_color2', 'base_color3',
    'base_white', 'base_black', 'base_gray1', 'base_gray2'
  ];

  // 基本設定シートを読み込み、siteInfos/colors を更新し、行データを返す
  function readBasicSettings_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(BASIC_SHEET_NAME);
    if (!sh) throw new Error('「基本設定」シートが見つかりません。');

    const values = sh.getDataRange().getValues();
    if (!values || values.length <= 1) return [];

    // 1行目はヘッダ
    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const key  = values[r][0] ? String(values[r][0]).trim() : '';
      const val  = values[r][1] != null ? values[r][1] : '';
      const note = values[r][2] != null ? String(values[r][2]) : '';

      if (!key) continue;

      let category = '';
      if (SITE_KEYS.indexOf(key) >= 0) {
        siteInfos[key] = val;
        category = 'siteInfos';
        // base_font の場合は body クラスへも反映
        if (key === 'base_font') {
          const cls = mapBaseFontToClass_(val);
          if (cls) addBodyClass(cls);
        }
      } else if (COLOR_KEYS.indexOf(key) >= 0) {
        colors[key] = val;
        category = 'colors';
      } else if (key === 'base_font_weight') {
        // variables.css 用のCSS変数へ
        addCssVar('--base-font-weight', String(val).trim());
        category = 'variables';
      } else if (key === 'base_font_bold_weight') {
        addCssVar('--base-font-bold-weight', String(val).trim());
        category = 'variables';
      } else {
        // 対象外はスキップ（必要なら 'others' に積む）
        continue;
      }
      rows.push({ category, key, value: val, note });
    }
    return rows;
  }

  // 基本フォント → bodyクラス 変換
  function mapBaseFontToClass_(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    if (s === 'ゴシック') return 'sans';
    if (s === '明朝') return 'serif';
    if (s === '丸ゴシック') return 'rounded';
    // 不明値は何もしない
    return '';
  }

  // Parameters 関連機能 (ensure/reset/append) は完全廃止済み

  // 公開API: 読み込み + Parameters 追記 + 概要返却
  function readAndRecordBasicSettings() {
    const rows = readBasicSettings_();

    // 任意でログ
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      // Utils.logToSheet(`基本設定: siteInfos=${Object.keys(siteInfos).length}, colors=${Object.keys(colors).length}`, 'CommonInfo');
    }
    return { siteInfos: JSON.parse(JSON.stringify(siteInfos)), colors: JSON.parse(JSON.stringify(colors)), rows };
  }

  // colors マップから CSS 変数定義を生成
  function toCssVariables(targetColors) {
    const obj = targetColors || colors || {};
    const entries = Object.keys(obj);
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // 宣言行を生成
    const decls = [];
    for (let i = 0; i < entries.length; i++) {
      const key = String(entries[i] || '').trim();
      let val = obj[key];
      if (val == null || String(val).trim() === '') continue;
      val = String(val).trim();

  // snake_case → kebab-case、'color' トークンは除去、英字-数字の境界にハイフン
      const tokens = key.toLowerCase().split('_').filter(Boolean).filter(t => t !== 'color');
      const normTokens = tokens.map(t => t.replace(/([a-z]+)(\d+)/i, '$1-$2'));
      const suffix = normTokens.join('-');
      if (!suffix) continue;
  // 変数接頭辞を --pcol- に統一（旧 --color- は廃止）
  const varName = `--pcol-${suffix}`;
      decls.push(`  ${varName}: ${val};`);
    }

    // 追加のカラー変数（名称はそのまま使用）: colorVars の内容を追記
    const extraColorKeys = Object.keys(colorVars || {});
    for (let i = 0; i < extraColorKeys.length; i++) {
      const name = String(extraColorKeys[i] || '').trim();
      let val = colorVars[name];
      if (!name || !/^--[a-z0-9\-]+$/i.test(name)) continue; // 無効な名前はスキップ
      if (val == null || String(val).trim() === '') continue;
      decls.push(`  ${name}: ${String(val).trim()};`);
    }

    const body = decls.length ? `:root {\n${decls.join('\n')}\n}` : ':root {}';
    const header = [
      '/*',
      ` * generated by GAS (CommonInfo) ${ts}`,
      ' * source: シート「基本設定」および各コンポーネントで追加された colors',
      ' */'
    ].join('\n');

    return `${header}\n${body}\n`;
  }

  // colors.css を Drive の output/css/ に保存（folderId が省略時は ScriptProperties から取得）
  function writeColorsCss(folderId) {
    try {
      let cssFolderId = folderId;
      if (!cssFolderId) {
        const props = PropertiesService.getScriptProperties();
        cssFolderId = props.getProperty(PROP_KEYS.OUTPUT_CSS_ID);
      }
      if (!cssFolderId) throw new Error('CSS 出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');

      const cssText = toCssVariables(colors);
      const folder = DriveApp.getFolderById(cssFolderId);
      const filename = 'colors.css';

      const it = folder.getFilesByName(filename);
      if (it.hasNext()) {
        const file = it.next();
        file.setContent(cssText);
      } else {
        const blob = Utilities.newBlob(cssText, 'text/css', filename);
        folder.createFile(blob);
      }

  const count = (cssText.match(/--pcol-/g) || []).length;
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        // Utils.logToSheet(`colors.css を出力しました（変数 ${count} 件）`, 'CommonInfo');
      }
      return { filename: filename, count };
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`colors.css 出力エラー: ${e.message}`, 'CommonInfo');
      }
      throw e;
    }
  }

  // variables.css を Drive の output/css/ に保存（cssVars を :root に展開）
  function writeVariablesCss(folderId) {
    try {
      let cssFolderId = folderId;
      if (!cssFolderId) {
        const props = PropertiesService.getScriptProperties();
        cssFolderId = props.getProperty(PROP_KEYS.OUTPUT_CSS_ID);
      }
      if (!cssFolderId) throw new Error('CSS 出力フォルダIDが不明です。Build.checkDirectories() 実行後に呼び出してください。');

      const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const decls = [];
      const extraKeys = Object.keys(cssVars || {});
      for (let i = 0; i < extraKeys.length; i++) {
        const name = String(extraKeys[i] || '').trim();
        let val = cssVars[name];
        if (!name || !/^--[a-z0-9\-]+$/i.test(name)) continue; // 無効名スキップ
        if (val == null || String(val).trim() === '') continue;
        decls.push(`  ${name}: ${String(val).trim()};`);
      }
      const body = decls.length ? `:root {\n${decls.join('\n')}\n}` : ':root {}';
      const header = [
        '/*',
        ` * generated by GAS (CommonInfo) ${ts}`,
        ' * source: シート「基本設定」および各コンポーネントで追加された variables',
        ' */'
      ].join('\n');
      const cssText = `${header}\n${body}\n`;

      const folder = DriveApp.getFolderById(cssFolderId);
      const filename = 'variables.css';
      const it = folder.getFilesByName(filename);
      if (it.hasNext()) {
        const file = it.next();
        file.setContent(cssText);
      } else {
        const blob = Utilities.newBlob(cssText, 'text/css', filename);
        folder.createFile(blob);
      }

      const count = (cssText.match(/--[a-z0-9\-]+:/gi) || []).length;
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        // Utils.logToSheet(`variables.css を出力しました（変数 ${count} 件）`, 'CommonInfo');
      }
      return { filename: filename, count };
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`variables.css 出力エラー: ${e.message}`, 'CommonInfo');
      }
      throw e;
    }
  }

  // 追加のCSS変数を登録（--name, value）
  function addCssVar(name, value) {
    if (!name) return;
    const n = String(name).trim();
    if (!/^--[a-z0-9\-]+$/i.test(n)) return; // 不正な名前は無視
    cssVars[n] = value;
  }

  // 追加のカラー変数を登録（--name, value）→ colors.css に出力
  function addColorVar(name, value) {
    if (!name) return;
    const n = String(name).trim();
    if (!/^--[a-z0-9\-]+$/i.test(n)) return; // 不正な名前は無視
    colorVars[n] = value;
  }

  // body クラス操作
  function addBodyClass(name) {
    const n = String(name || '').trim();
    if (!n) return;
    if (bodyClassBag.indexOf(n) === -1) bodyClassBag.push(n);
  }
  function resetBodyClasses() {
    bodyClassBag = [];
  }
  function getBodyClassesString() {
    // 重複を避けて半角スペース区切り
    const uniq = Array.from(new Set(bodyClassBag));
    return uniq.join(' ');
  }

  return {
    readAndRecordBasicSettings,
    toCssVariables,
    writeColorsCss,
    writeVariablesCss,
    addCssVar,
  addColorVar,
    addBodyClass,
    resetBodyClasses,
    getBodyClassesString,
    // reset/removeParametersSheet は廃止
    // 必要ならエクスポート
    readBasicSettings_: readBasicSettings_,
    // ensureParametersSheet_, appendToParameters_ は廃止
    safeFreezeTopRow_: safeFreezeTopRow_,
    SITE_KEYS, COLOR_KEYS
  };
})();