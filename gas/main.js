// デバッグ出力のON/OFF（debug__*.html の出力制御などに使用）
var DEBUG_BUILD = false; // 納品用にデバッグ出力を無効化

/**
 * スプレッドシートを開いた時にカスタムメニューを追加する
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi && SpreadsheetApp.getUi();
    if (!ui) return; // UI コンテキストでない場合はメニュー生成をスキップ
    ui.createMenu('サイト生成')
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

/**
 * 出力
 */
function buildAll () {

  const stTime = new Date().getTime();
  Utils.logToSheet('>>>>> 処理開始 >>>>>', 'buildAll');

  // Parameters 廃止済み（旧リセット処理は不要）

  // 処理開始時に Utility シート（Parameters / Logs）を末尾配置 & タブ色保証
  try { if (typeof Utils !== 'undefined' && Utils.ensureUtilitySheets) { Utils.ensureUtilitySheets(); } } catch (e) {}

  const ids = Build.checkDirectories();
  SpreadsheetApp.getActive().toast('出力準備OK（フォルダ確認済み）', 'buildAll', 3);
  Utils.logToSheet('出力準備OK（フォルダ確認・作成完了）', 'buildAll');

  // テンプレ側のCSSを output/css にコピー（colors.css は別途生成）
  try {
    const copiedCss = Build.copyAllCssFromTemplate();
    // Utils.logToSheet(`テンプレCSSコピー: ${copiedCss}件`, 'buildAll');
  } catch (e) {
    Utils.logToSheet(`テンプレCSSコピー失敗: ${e.message}`, 'buildAll');
  }

  // assets/img → output/img へコピー（画像アセットを出力側に展開）
  try {
    const copiedAssets = Build.copyAssetsToOutputImg();
    // Utils.logToSheet(`assets→output/img コピー: ${copiedAssets}件`, 'buildAll');
  } catch (e) {
    Utils.logToSheet(`assets→output/img コピー失敗: ${e.message}`, 'buildAll');
  }

  // 追加: 基本設定読み込み
  const common = CommonInfo.readAndRecordBasicSettings();

  // 追加: meta 読み込み
  if (typeof MetaInfo !== 'undefined' && MetaInfo.readAndRecordMeta) {
    const m = MetaInfo.readAndRecordMeta();
    // Utils.logToSheet(`meta 追記: ${m.rows.length}件`, 'buildAll');
  }

  // 追加: mv 読み込み
  if (typeof MvInfo !== 'undefined' && MvInfo.readAndRecordMv) {
    var mvRes = MvInfo.readAndRecordMv();
    // Utils.logToSheet(`mv 追記: ${mvRes.rows.length}件`, 'buildAll');
  }

  // 追加: message 読み込み + JSON出力 + 色変数登録（旧 mission）
  if (typeof MessageInfo !== 'undefined' && MessageInfo.readAndRecordMessage) {
    var messageRes = MessageInfo.readAndRecordMessage();
    // Utils.logToSheet(`message 追記: ${messageRes.rows.length}件 / slides=${messageRes.slides.length}`, 'buildAll');
  }

  // 追加: service 読み込み + JSON出力
  if (typeof ServiceInfo !== 'undefined' && ServiceInfo.readAndRecordService) {
    var serviceRes = ServiceInfo.readAndRecordService();
    // Utils.logToSheet(`service 追記: ${serviceRes.rows.length}件 / items=${serviceRes.items.length}`, 'buildAll');
  }

  // 追加: contact 読み込み（色変数登録含む）
  if (typeof ContactInfo !== 'undefined' && ContactInfo.readAndRecordContact) {
    var contactRes = ContactInfo.readAndRecordContact();
    // Utils.logToSheet(`contact 追記: ${contactRes.rows.length}件 / items=${contactRes.items.length}`, 'buildAll');
  }

  // 追加: faq 読み込み + JSON出力
  if (typeof FaqInfo !== 'undefined' && FaqInfo.readAndRecordFaq) {
    var faqRes = FaqInfo.readAndRecordFaq();
    // Utils.logToSheet(`faq 追記: ${faqRes.rows.length}件 / items=${faqRes.items.length}`, 'buildAll');
  }

  // 追加: company 読み込み + JSON出力
  if (typeof CompanyInfo !== 'undefined' && CompanyInfo.readAndRecordCompany) {
    var companyRes = CompanyInfo.readAndRecordCompany();
    // Utils.logToSheet(`company 追記: ${companyRes.rows.length}件 / items=${companyRes.items.length}`, 'buildAll');
  }

  // 追加: works 読み込み + JSON出力
  if (typeof WorksInfo !== 'undefined' && WorksInfo.readAndRecordWorks) {
    var worksRes = WorksInfo.readAndRecordWorks();
    // Utils.logToSheet(`works 追記: ${worksRes.rows.length}件 / items=${worksRes.items.length}`, 'buildAll');
  }

  // 追加: footer 読み込み + 色変数登録
  if (typeof FooterInfo !== 'undefined' && FooterInfo.readAndRecordFooter) {
    var footerRes = FooterInfo.readAndRecordFooter();
    // Utils.logToSheet(`footer 追記: ${footerRes.rows.length}件`, 'buildAll');
  }

  const order = Build.getContentOrder();
  // Utils.logToSheet(`コンテンツ表示順取得完了（${order.length}）`, 'buildAll');

  const mainHtml = Build.loadTemplates('top', order);
  // Utils.logToSheet(`テンプレート読み込み完了:[${typeof mainHtml}]`, 'buildAll');

  // scripts 差し込み（body閉じタグ前の <?= scripts ?> を置換）
  var mvOk = !!(mvRes && mvRes.ok);
  var messageOk = !!(messageRes && messageRes.ok);
  var serviceOk = !!(serviceRes && serviceRes.ok);
  var companyOk = !!(companyRes && companyRes.ok);
  var faqOk = !!(typeof faqRes !== 'undefined' && faqRes && faqRes.ok);
  var worksOk = !!(worksRes && worksRes.ok);
  const scriptsTag = Build.buildScriptsTag({ mvOk, messageOk, serviceOk, faqOk, companyOk, worksOk });
  const mainWithScripts = Build.applyTagReplacements(mainHtml, { scripts: scriptsTag });

  // 出力直前にHTMLコメントを整理（SectionTitle: 以外は削除）
  const finalHtml = (typeof Build.stripHtmlCommentsExceptSectionTitle_ === 'function')
    ? Build.stripHtmlCommentsExceptSectionTitle_(mainWithScripts)
    : mainWithScripts;

  Build.saveHtmlToFolder(ids.output.rootId, 'index.html', finalHtml);
  Utils.logToSheet(`HTML出力完了: output/index.html`, 'buildAll');

  // 最後に colors.css を出力（他コンポーネントで追加された colors も含めて集計）
  if (typeof CommonInfo !== 'undefined' && CommonInfo.writeColorsCss) {
    const res = CommonInfo.writeColorsCss(ids.output.cssId);
    Utils.logToSheet(`CSS変数出力: ${res.filename}（${res.count}件）`, 'buildAll');
  }

  // variables.css を出力（フォントウェイトなどの共通変数）
  if (typeof CommonInfo !== 'undefined' && CommonInfo.writeVariablesCss) {
    const resV = CommonInfo.writeVariablesCss(ids.output.cssId);
    Utils.logToSheet(`CSS変数出力: ${resV.filename}（${resV.count}件）`, 'buildAll');
  }
 
  const edTime = new Date().getTime();
  const elapSec = ((edTime - stTime) / 1000).toFixed(2);
  
  Utils.logToSheet(`##### 書き出し処理全て完了 処理時間: ${elapSec} 秒 #####`, 'buildAll');
}

/**
 * output フォルダを zip 化してダウンロードしやすくする（My Drive 直下に作成）
 */
function zipOutput() {
  try {
    // フォルダの存在を確実に
    const ids = Build.checkDirectories();
    const outId = ids.output.rootId;

    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const zipName = `output_${stamp}`;
    const zipFile = Utils.zipFolder(outId, zipName); // My Drive 直下に作成されます

    SpreadsheetApp.getActive().toast(`ZIP作成: ${zipFile.getName()}（マイドライブ直下）`, 'zipOutput', 5);
    // Utils.logToSheet(`ZIP作成: ${zipFile.getName()} (id=${zipFile.getId()})`, 'zipOutput');
  } catch (e) {
    SpreadsheetApp.getActive().toast('ZIP作成に失敗しました。ログを確認してください。', 'zipOutput', 5);
    Utils.logToSheet(`ZIP作成エラー: ${e.message}`, 'zipOutput');
    throw e;
  }
}

/**
 * output を zip 化し、共有リンク（リンクを知っている全員閲覧可）を作って Logs に出す
 */
function zipOutputWithLink() {
  try {
    const ids = Build.checkDirectories();
    const outId = ids.output.rootId;
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const zipName = `output_${stamp}`;
    const zipFile = Utils.zipFolder(outId, zipName);

    // 共有設定（リンクを知っている全員が閲覧可）
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

/**
 * UIからテンプレートルートIDを設定（ScriptProperties.TEMPLATE_ROOT_ID）
 */
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
  // Utils.logToSheet(`TEMPLATE_ROOT_ID を設定: ${value}`, 'setTemplateRootIdPrompt');
  SpreadsheetApp.getActive().toast('テンプレートIDを設定しました', 'setTemplateRootIdPrompt', 3);
}

/**
 * 設定済みのテンプレートルートIDをクリア（ScriptPropertiesから削除）
 * 以後は 基本設定→定数 へフォールバック
 */
function clearTemplateRootId() {
  PropertiesService.getScriptProperties().deleteProperty('TEMPLATE_ROOT_ID');
  Utils.logToSheet('TEMPLATE_ROOT_ID をクリア', 'clearTemplateRootId');
  SpreadsheetApp.getActive().toast('テンプレートIDをクリアしました', 'clearTemplateRootId', 3);
}
