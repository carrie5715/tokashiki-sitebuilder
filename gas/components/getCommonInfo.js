// グローバル保持
var siteInfos = siteInfos || {};
var colors    = colors || {};
// 追加のカスタムCSS変数（--xxx 形式でそのまま出力）
var cssVars   = cssVars || {};

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
    'company_name', 'address', 'template', 'top_url', 'logo_url',
    // 追加: フッター用
    'copyright', 'copyrights'
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
      } else if (COLOR_KEYS.indexOf(key) >= 0) {
        colors[key] = val;
        category = 'colors';
      } else {
        // 対象外はスキップ（必要なら 'others' に積む）
        continue;
      }
      rows.push({ category, key, value: val, note });
    }
    return rows;
  }

  // Parameters シートを Logs の手前に作成（存在すれば再利用）
  function ensureParametersSheet_() {
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(PARAMETERS_SHEET_NAME);
    if (sheet) return sheet;

    const sheets = ss.getSheets();
    let logsIndex = -1;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() === LOGS_SHEET_NAME) {
        logsIndex = i;
        break;
      }
    }
    // Logs があればその手前、なければ末尾へ
    sheet = (logsIndex >= 0)
      ? ss.insertSheet(PARAMETERS_SHEET_NAME, logsIndex)
      : ss.insertSheet(PARAMETERS_SHEET_NAME);

    // ヘッダ付与（空なら）
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 4).setValues([['カテゴリ', 'キー', 'バリュー', 'ノート']]);
      safeFreezeTopRow_(sheet);
    }
    return sheet;
  }

  // Parameters をリセット（ヘッダーは維持・なければ再作成）。位置は Logs の手前に維持。
  function resetParametersSheet() {
    const sh = ensureParametersSheet_();
    const lastRow = sh.getLastRow();
    const frozenRows = sh.getFrozenRows ? sh.getFrozenRows() : 1; // 通常1
    const nonFrozenCount = Math.max(0, lastRow - frozenRows);

    // Sheetsの制約: 「非固定の全行を削除」はエラーになるため、1行は残してクリアする
    if (nonFrozenCount > 1) {
      // 先に (frozen+2 〜 最終) を削除し、(frozen+1) は空行として残す
      sh.deleteRows(frozenRows + 2, nonFrozenCount - 1);
      sh.getRange(frozenRows + 1, 1, 1, 4).clearContent();
    } else if (nonFrozenCount === 1) {
      // 残っている1行は削除せず中身だけクリア
      sh.getRange(frozenRows + 1, 1, 1, 4).clearContent();
    }

    // ヘッダーを再設定（万一欠けていても復旧）
    const headerRange = sh.getRange(1, 1, 1, 4);
    headerRange.setValues([[ 'カテゴリ', 'キー', 'バリュー', 'ノート' ]]);
    safeFreezeTopRow_(sh);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet('Parameters シートをリセットしました', 'CommonInfo');
    }
  }

  // Parameters へ追記
  function appendToParameters_(rows) {
    if (!rows || rows.length === 0) return;
    const sh = ensureParametersSheet_();
    const start = Math.max(sh.getLastRow(), 1) + 1;
    const values = rows.map(r => [r.category, r.key, r.value, r.note || '']);
    sh.getRange(start, 1, values.length, 4).setValues(values);
  }

  // 公開API: 読み込み + Parameters 追記 + 概要返却
  function readAndRecordBasicSettings() {
    const rows = readBasicSettings_();
    appendToParameters_(rows);

    // 任意でログ
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`基本設定: siteInfos=${Object.keys(siteInfos).length}, colors=${Object.keys(colors).length}`, 'CommonInfo');
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
      const varName = `--color-${suffix}`;
      decls.push(`  ${varName}: ${val};`);
    }

    // 追加のCSS変数（名称はそのまま使用）
    const extraKeys = Object.keys(cssVars || {});
    for (let i = 0; i < extraKeys.length; i++) {
      const name = String(extraKeys[i] || '').trim();
      let val = cssVars[name];
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

      const count = (cssText.match(/--color-/g) || []).length;
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`colors.css を出力しました（変数 ${count} 件）`, 'CommonInfo');
      }
      return { filename: filename, count };
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet(`colors.css 出力エラー: ${e.message}`, 'CommonInfo');
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

  return {
    readAndRecordBasicSettings,
    toCssVariables,
    writeColorsCss,
    addCssVar,
    resetParametersSheet,
    // 必要ならエクスポート
    readBasicSettings_: readBasicSettings_,
    ensureParametersSheet_: ensureParametersSheet_,
    appendToParameters_: appendToParameters_,
    safeFreezeTopRow_: safeFreezeTopRow_,
    SITE_KEYS, COLOR_KEYS
  };
})();