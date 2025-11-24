// デバッグ出力のON/OFF（debug__*.html の出力制御などに使用）
var DEBUG_BUILD = false; // 納品用にデバッグ出力を無効化

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi && SpreadsheetApp.getUi();
    if (!ui) return;
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

  if (typeof MetaInfo !== 'undefined' && MetaInfo.read && MetaInfo.record) { MetaInfo.read(); var metaRes = MetaInfo.record(); }
  if (typeof MvInfo !== 'undefined' && MvInfo.read && MvInfo.record) { MvInfo.read(); var mvRes = MvInfo.record(); }
  if (typeof MessageInfo !== 'undefined' && MessageInfo.read && MessageInfo.record) { MessageInfo.read(); var messageRes = MessageInfo.record(); }
  if (typeof ServiceInfo !== 'undefined' && ServiceInfo.read && ServiceInfo.record) { ServiceInfo.read(); var serviceRes = ServiceInfo.record(); }
  if (typeof ContactInfo !== 'undefined' && ContactInfo.read && ContactInfo.record) { ContactInfo.read(); var contactRes = ContactInfo.record(); }
  if (typeof FaqInfo !== 'undefined' && FaqInfo.read && FaqInfo.record) { FaqInfo.read(); var faqRes = FaqInfo.record(); }
  if (typeof CompanyInfo !== 'undefined' && CompanyInfo.read && CompanyInfo.record) { CompanyInfo.read(); var companyRes = CompanyInfo.record(); }
  if (typeof WorksInfo !== 'undefined' && WorksInfo.read && WorksInfo.record) { WorksInfo.read(); var worksRes = WorksInfo.record(); }
  if (typeof FooterInfo !== 'undefined' && FooterInfo.read && FooterInfo.record) { FooterInfo.read(); var footerRes = FooterInfo.record(); }

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
