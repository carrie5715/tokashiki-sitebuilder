// デバッグ出力のON/OFF（debug__*.html の出力制御などに使用）
var DEBUG_BUILD = true; // 必要に応じて false に変更

/**
 * スプレッドシートを開いた時にカスタムメニューを追加する
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('サイト生成')
    .addItem('動作テスト（ログ出力）', 'testConsole')
    .addItem('ファイル出力', 'buildAll')
    .addToUi();
}

/**
 * 動作テスト：console.log / Logger.log に出力し、トーストも表示する
 */
function testConsole() {
  // 画面右下のトースト通知（ユーザーに見える）
  SpreadsheetApp.getActive().toast('動作テストを実行しました。ログを確認してください。', 'テスト', 4);

  // console.log は V8 ランタイムで使用可（Apps Script の実行ログに出力される）
  console.log('[testConsole] console.log からのメッセージです');

  // Logger.log でも一応出しておく（旧来のログ）k
  Logger.log('[testConsole] Logger.log からのメッセージです');

  // 例として現在のスプレッドシート名も出力
  const name = SpreadsheetApp.getActiveSpreadsheet().getName();
  Utils.logToSheet('テストのログよ')
  console.log(`[testConsole] Spreadsheet: ${name}`);
  Logger.log(`[testConsole] Spreadsheet: ${name}`);
}

/**
 * 出力
 */
function buildAll () {
  // 全体処理開始前に Parameters をリセット
  if (typeof CommonInfo !== 'undefined' && CommonInfo.resetParametersSheet) {
    CommonInfo.resetParametersSheet();
  }

  const ids = Build.checkDirectories();
  SpreadsheetApp.getActive().toast('出力準備OK（フォルダ確認済み）', 'buildAll', 3);
  Utils.logToSheet('出力準備OK（フォルダ確認・作成完了）', 'buildAll');

  // 追加: 基本設定の取得と Parameters への追記
  const common = CommonInfo.readAndRecordBasicSettings();
  Utils.logToSheet(`Parameters 追記: ${common.rows.length}件`, 'buildAll');

  // 追加: meta の取得と Parameters への追記（カテゴリ=meta）
  if (typeof MetaInfo !== 'undefined' && MetaInfo.readAndRecordMeta) {
    const m = MetaInfo.readAndRecordMeta();
    Utils.logToSheet(`meta 追記: ${m.rows.length}件`, 'buildAll');
  }

  // 追加: mv の取得と Parameters への追記（カテゴリ=mv）
  if (typeof MvInfo !== 'undefined' && MvInfo.readAndRecordMv) {
    const mvRes = MvInfo.readAndRecordMv();
    Utils.logToSheet(`mv 追記: ${mvRes.rows.length}件`, 'buildAll');
  }

  const order = Build.getContentOrder();
  Utils.logToSheet(`コンテンツ表示順取得完了（${order.length}）`, 'buildAll');

  const mainHtml = Build.loadTemplates('top', order);
  Utils.logToSheet(`テンプレート読み込み完了:[${typeof mainHtml}]`, 'buildAll');

  Build.saveHtmlToFolder(ids.output.rootId, 'index.html', mainHtml);
  Utils.logToSheet(`HTML出力完了: output/index.html`, 'buildAll');

  // 最後に colors.css を出力（他コンポーネントで追加された colors も含めて集計）
  if (typeof CommonInfo !== 'undefined' && CommonInfo.writeColorsCss) {
    const res = CommonInfo.writeColorsCss(ids.output.cssId);
    Utils.logToSheet(`CSS変数出力: ${res.filename}（${res.count}件）`, 'buildAll');
  }
}
