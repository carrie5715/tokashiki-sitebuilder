// デバッグ出力のON/OFF（debug__*.html の出力制御などに使用）
var DEBUG_BUILD = false; // 納品用にデバッグ出力を無効化

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi && SpreadsheetApp.getUi();
    if (!ui) return;
    ui.createMenu('サイト生成')
      .addItem('シート読み取り', 'sheetReadAll')
      .addItem('ファイル出力', 'buildAll')
      .addItem('出力をZIP作成（ダウンロード用）', 'zipOutput')
      .addItem('出力ZIPの共有リンク生成', 'zipOutputWithLink')
      .addSeparator()
      .addItem('テンプレートID設定', 'setTemplateRootIdPrompt')
      .addItem('テンプレートIDクリア', 'clearTemplateRootId')
      .addToUi();
  } catch (e) {
    if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('onOpen UIメニュー生成スキップ: ' + e.message, 'onOpen');
  }
}

function sheetReadAll() {
  const stTime = new Date().getTime();
  Utils.logToSheet('>>>>> シート読み取り開始 >>>>>', 'sheetReadAll');
  // 出力用フォルダID取得（info/snapshot）
  let ids;
  try {
    ids = Build.checkDirectories();
  } catch (e) {
    Utils.logToSheet('フォルダ確認失敗: ' + e.message, 'sheetReadAll');
    throw e;
  }
  const snapshotFolderId = ids && ids.info && ids.info.snapshotId;
  if (!snapshotFolderId) {
    Utils.logToSheet('snapshot保存先(info/snapshot)取得失敗', 'sheetReadAll');
    throw new Error('snapshotフォルダなし');
  }

  // 対象シート名（必要に応じて拡張）
  const sheetNames = [
    'mv', 'message', 'service', 'contact', 'faq', 'company', 'works', 'footer', 'header', 'meta', 'nav'
  ];

  const ss = SpreadsheetApp.getActive();
  const components = {};
  sheetNames.forEach(name => {
    try {
      const sh = ss.getSheetByName(name);
      if (!sh) return;
      const values = sh.getDataRange().getValues();
      components[name] = {
        sheetName: name,
        rows: values,
        rowCount: values.length,
        colCount: values.length ? values[0].length : 0
      };
    } catch (e) {
      Utils.logToSheet(`シート取得失敗: ${name} - ${e.message}`, 'sheetReadAll');
    }
  });

  // スナップショット構造
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const timestamp = now.getTime();
  const snapshot = {
    version: 1,
    generatedAt: now.toISOString(),
    dateKey: dateStr,
    timestamp: timestamp,
    spreadsheetId: ss.getId(),
    components: components
  };

  // ファイル名提案: prefix = 'snapshot_' → snapshot_YYYYMMDD-HHmmss-<timestamp>.json
  const fileName = `snapshot_${dateStr}-${timestamp}.json`;
  try {
    const folder = DriveApp.getFolderById(snapshotFolderId);
    const blob = Utilities.newBlob(JSON.stringify(snapshot, null, 2), 'application/json', fileName);
    folder.createFile(blob);
    Utils.logToSheet(`snapshot保存: info/snapshot/${fileName}`, 'sheetReadAll');
  } catch (e) {
    Utils.logToSheet('snapshot保存失敗: ' + e.message, 'sheetReadAll');
    throw e;
  }

  const edTime = new Date().getTime();
  const elapSec = ((edTime - stTime) / 1000).toFixed(2);
  Utils.logToSheet(`##### シート読み取り全て完了 処理時間: ${elapSec} 秒 #####`, 'sheetReadAll');
}


function buildAll() {
  const stTime = new Date().getTime();
  Utils.logToSheet('>>>>> 処理開始 >>>>>', 'buildAll');

  try { if (typeof Utils !== 'undefined' && Utils.ensureUtilitySheets) { Utils.ensureUtilitySheets(); } } catch (e) {}

  const ids = Build.checkDirectories();
  SpreadsheetApp.getActive().toast('出力準備OK（フォルダ確認済み）', 'buildAll', 3);
  Utils.logToSheet('出力準備OK（フォルダ確認・作成完了）', 'buildAll');

  try { Build.copyAllCssFromTemplate(); } catch (e) { Utils.logToSheet(`テンプレCSSコピー失敗: ${e.message}`, 'buildAll'); }
  try { Build.copyAssetsToOutputImg(); } catch (e) { Utils.logToSheet(`assets→output/img コピー失敗: ${e.message}`, 'buildAll'); }

  const common = CommonInfo.readAndRecordBasicSettings();

  // 最新snapshot適用（存在すれば read() はシートアクセスせず rows を利用）
  let snapshot = null;
  try { snapshot = Build.loadLatestSnapshot(); } catch(_) {}
  if (snapshot && snapshot.components) {
    globalThis.__snapshotOverrides = {};
    Object.keys(snapshot.components).forEach(name => {
      const comp = snapshot.components[name];
      if (comp && comp.rows) {
        globalThis.__snapshotOverrides[name] = comp.rows;
      }
    });
    Utils.logToSheet(`snapshot適用: ${Object.keys(snapshot.components).length}コンポ / ${snapshot.dateKey}`, 'buildAll');
  } else {
    Utils.logToSheet('snapshotなし: 通常readでシート参照', 'buildAll');
  }

  // スナップショット必須化: 無ければ中止
  if (!snapshot) {
    Utils.logToSheet('snapshot未検出のため処理中止。先に「シート読み取り」を実行してください。', 'buildAll');
    SpreadsheetApp.getActive().toast('snapshotが存在しません。sheetReadAll を先に実行してください。', 'buildAll', 6);
    return;
  }

  // recordのみ呼び出し（read() を呼ばず snapshot再構築ロジックを各 record が内包）
  var metaRes   = (typeof MetaInfo !== 'undefined'   && MetaInfo.record)   ? MetaInfo.record()   : null;
  var mvRes     = (typeof MvInfo !== 'undefined'     && MvInfo.record)     ? MvInfo.record()     : null;
  var messageRes= (typeof MessageInfo !== 'undefined'&& MessageInfo.record)? MessageInfo.record(): null;
  var serviceRes= (typeof ServiceInfo !== 'undefined'&& ServiceInfo.record)? ServiceInfo.record(): null;
  var contactRes= (typeof ContactInfo !== 'undefined'&& ContactInfo.record)? ContactInfo.record(): null;
  var faqRes    = (typeof FaqInfo !== 'undefined'    && FaqInfo.record)    ? FaqInfo.record()    : null;
  var companyRes= (typeof CompanyInfo !== 'undefined'&& CompanyInfo.record)? CompanyInfo.record(): null;
  var worksRes  = (typeof WorksInfo !== 'undefined'  && WorksInfo.record)  ? WorksInfo.record()  : null;
  var footerRes = (typeof FooterInfo !== 'undefined' && FooterInfo.record) ? FooterInfo.record() : null;

  // snapshot overrides 終了処理（後続の別関数影響を避けるためクリア）
  if (globalThis.__snapshotOverrides) {
    try { delete globalThis.__snapshotOverrides; } catch(_) {}
  }

  const order = Build.getContentOrder();
  const mainHtml = Build.loadTemplates('top', order);

  var mvOk = !!(mvRes && mvRes.ok);
  var messageOk = !!(messageRes && messageRes.ok);
  var serviceOk = !!(serviceRes && serviceRes.ok);
  var companyOk = !!(companyRes && companyRes.ok);
  var faqOk = !!(faqRes && faqRes.ok);
  var worksOk = !!(worksRes && worksRes.ok);
  const scriptsTag = Build.buildScriptsTag({ mvOk, messageOk, serviceOk, faqOk, companyOk, worksOk });
  const mainWithScripts = Build.applyTagReplacements(mainHtml, { scripts: scriptsTag });

  const finalHtml = (typeof Build.stripHtmlCommentsExceptSectionTitle_ === 'function')
    ? Build.stripHtmlCommentsExceptSectionTitle_(mainWithScripts)
    : mainWithScripts;
  Build.saveHtmlToFolder(ids.output.rootId, 'index.html', finalHtml);
  Utils.logToSheet(`HTML出力完了: output/index.html`, 'buildAll');

  if (typeof CommonInfo !== 'undefined' && CommonInfo.writeColorsCss) {
    try { CommonInfo.writeColorsCss(ids.output.cssId); } catch (e) { Utils.logToSheet(`colors.css 出力失敗: ${e.message}`, 'buildAll'); }
  }
  if (typeof CommonInfo !== 'undefined' && CommonInfo.writeVariablesCss) {
    try { CommonInfo.writeVariablesCss(ids.output.cssId); } catch (e) { Utils.logToSheet(`variables.css 出力失敗: ${e.message}`, 'buildAll'); }
  }

  const edTime = new Date().getTime();
  const elapSec = ((edTime - stTime) / 1000).toFixed(2);
  Utils.logToSheet(`##### 書き出し処理全て完了 処理時間: ${elapSec} 秒 #####`, 'buildAll');
}

function zipOutput() {
  try {
    const ids = Build.checkDirectories();
    const outId = ids.output.rootId;
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const zipName = `output_${stamp}`;
    const zipFile = Utils.zipFolder(outId, zipName);
    SpreadsheetApp.getActive().toast(`ZIP作成: ${zipFile.getName()}（マイドライブ直下）`, 'zipOutput', 5);
  } catch (e) {
    SpreadsheetApp.getActive().toast('ZIP作成に失敗しました。ログを確認してください。', 'zipOutput', 5);
    Utils.logToSheet(`ZIP作成エラー: ${e.message}`, 'zipOutput');
    throw e;
  }
}

function zipOutputWithLink() {
  try {
    const ids = Build.checkDirectories();
    const outId = ids.output.rootId;
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const zipName = `output_${stamp}`;
    const zipFile = Utils.zipFolder(outId, zipName);
    zipFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = zipFile.getUrl();
    SpreadsheetApp.getActive().toast(`共有リンク作成: ${zipFile.getName()}`, 'zipOutputWithLink', 5);
    Utils.logToSheet(`ZIP共有リンク: ${url}`, 'zipOutputWithLink');
  } catch (e) {
    SpreadsheetApp.getActive().toast('共有リンク作成に失敗しました。ログを確認してください。', 'zipOutputWithLink', 5);
    Utils.logToSheet(`ZIP共有リンクエラー: ${e.message}`, 'zipOutputWithLink');
    throw e;
  }
}

function setTemplateRootIdPrompt() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('テンプレートルートIDを入力', 'Google DriveフォルダID（layout/components/js/cssが入ったルート）', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) {
    SpreadsheetApp.getActive().toast('キャンセルしました', 'setTemplateRootIdPrompt', 3);
    return;
  }
  const value = (res.getResponseText() || '').trim();
  if (!value) {
    SpreadsheetApp.getActive().toast('IDが空です', 'setTemplateRootIdPrompt', 4);
    return;
  }
  PropertiesService.getScriptProperties().setProperty('TEMPLATE_ROOT_ID', value);
  SpreadsheetApp.getActive().toast('テンプレートIDを設定しました', 'setTemplateRootIdPrompt', 3);
}

function clearTemplateRootId() {
  PropertiesService.getScriptProperties().deleteProperty('TEMPLATE_ROOT_ID');
  Utils.logToSheet('TEMPLATE_ROOT_ID をクリア', 'clearTemplateRootId');
  SpreadsheetApp.getActive().toast('テンプレートIDをクリアしました', 'clearTemplateRootId', 3);
}
