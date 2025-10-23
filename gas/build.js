const Build = {
  /**
   * ディレクトリ確認（なければ作成）してIDを返す
   * ※ 親=スプレッドシートの入っているフォルダ
   */
  checkDirectories() {
    const parent = Utils.getParentFolder_();
    if (!parent) {
      SpreadsheetApp.getActive().toast('親フォルダが見つかりません。スプレッドシートをフォルダに入れてください。', 'エラー', 6);
      throw new Error('親フォルダなし');
    }

    // assets/
    const assets    = Utils.getOrCreateSubFolder_(parent, DIR_ASSETS);
    const assetsImg = Utils.getOrCreateSubFolder_(assets, ASSETS_IMG);       // assets/img/

    // output/
    const output      = Utils.getOrCreateSubFolder_(parent, DIR_OUTPUT);
    const outCss      = Utils.getOrCreateSubFolder_(output, OUT_CSS);        // output/css/
    const outCssPages = Utils.getOrCreateSubFolder_(outCss, OUT_CSS_PAGES);  // output/css/pages/
    const outJs       = Utils.getOrCreateSubFolder_(output, OUT_JS);         // output/js/
    const outImg      = Utils.getOrCreateSubFolder_(output, OUT_IMG);        // output/img/
    // const outPages = Utils.getOrCreateSubFolder_(output, OUT_PAGES_HTML);  // ← 廃止

    // 保存（必要なもののみ）
    PropertiesService.getScriptProperties().setProperties({
      [PROP_KEYS.PARENT_ID]:           parent.getId(),
      [PROP_KEYS.ASSETS_ID]:           assets.getId(),
      [PROP_KEYS.ASSETS_IMG_ID]:       assetsImg.getId(),
      [PROP_KEYS.OUTPUT_ID]:           output.getId(),
      [PROP_KEYS.OUTPUT_CSS_ID]:       outCss.getId(),
      [PROP_KEYS.OUTPUT_CSS_PAGES_ID]: outCssPages.getId(),
      [PROP_KEYS.OUTPUT_JS_ID]:        outJs.getId(),
      [PROP_KEYS.OUTPUT_IMG_ID]:       outImg.getId(),
      // [PROP_KEYS.OUTPUT_CSS_COMPS_ID]:  // ← 廃止
      // [PROP_KEYS.OUTPUT_PAGES_ID]:      // ← 廃止
    }, true);

    // 呼び出し側で使いやすいよう返却
    return {
      parentId: parent.getId(),
      assets: {
        rootId: assets.getId(),
        imgId: assetsImg.getId(),
      },
      output: {
        rootId: output.getId(),
        cssId: outCss.getId(),
        cssPagesId: outCssPages.getId(),
        jsId: outJs.getId(),
        imgId: outImg.getId(),
        // cssComponentsId:  // ← 廃止
        // pagesHtmlId:      // ← 廃止
      },
    };
  },


  loadTemplates(targetLayout, order) {
    Utils.logToSheet(`テンプレート読み込み開始`, 'loadTemplates');

    let indexLayout = this.getTemplateFile('layout', targetLayout || 'default');

    let sectionString = ''

    if(order && order.length > 0) {
      order.map((item) => {
        Utils.logToSheet(`セクションID:[${item.id}]`, 'loadTemplates');
        if(item.id === 'mv') {
          sectionString += this.getMvContents() + '\n';
        }
        if(item.id === 'mission') {
          sectionString += this.getMissionContents() + '\n';
        }
      });

      if(sectionString.length > 0) {
        indexLayout = this.applyTagReplacements(indexLayout, {contents: sectionString});
      }
    }

    Utils.logToSheet(`${targetLayout}テンプレート読み込み完了:[${typeof indexLayout}]`, 'loadTemplates');

    const replacements = {
      title: Utils.getSheetValue('meta', 'title'),
      description: Utils.getSheetValue('meta', 'description'),
      url: Utils.getSheetValue('meta', 'og:url'),
      image: Utils.getSheetValue('meta', 'og:image'),
    };

    const output = this.applyTagReplacements(indexLayout, replacements); 
    return output
  },

  /** mv */
  getMvContents() {
    const template = this.getTemplateFile('components', 'mv');
    const replacements = {
      mv_catchphrase: Utils.getSheetValue('mv', 'catchphrase'),
      mv_bg_image_url_pc: Utils.getSheetValue('mv', 'bg_image_url_pc'),
      mv_bg_image_url_sp: Utils.getSheetValue('mv', 'bg_image_url_sp'),
      mv_bg_image_alt: Utils.getSheetValue('mv', 'bg_image_alt'),
    };

    return this.applyTagReplacements(template, replacements);
  },

  /** mission */
  getMissionContents() {
    const template = this.getTemplateFile('components', 'mission');
    const replacements = {
      mission_heading_text: Utils.getSheetValue('mission', 'heading_text'),
      mission_intro_text: Utils.getSheetValue('mission', 'intro_text'),
    };

    return this.applyTagReplacements(template, replacements);
  },



  /**
   * 指定フォルダ内に同名ファイルがあれば上書き、なければ新規作成して保存
   * @param {string} folderId - 保存先フォルダID（例: ids.output.pagesHtmlId）
   * @param {string} filename - 保存ファイル名（例: "index.html"）
   * @param {string} html     - 保存するHTML文字列（例: tmp）
   * @return {string} fileId  - 保存（更新）されたファイルID
   */
  saveHtmlToFolder(folderId, filename, html) {
    const folder = DriveApp.getFolderById(folderId);

    const files = folder.getFilesByName(filename);
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(html);
      return file.getId();
    }

    // なければ新規作成
    const blob = Utilities.newBlob(html, 'text/html', filename);
    const created = folder.createFile(blob);
    return created.getId();
  },

  /**
   * シート「コンテンツ表示順」から表示順に並んだセクションID配列を返す
   * @return {Array<{order:number, id:string}>}
   */
  getContentOrder() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("コンテンツ表示順");
    if (!sheet) throw new Error("シート「コンテンツ表示順」が見つかりません");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // A〜D列を取得（2行目から最終行まで）
    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

    // 表示フラグ(D列)がtrueの行だけ取り出し、order(A列)とid(B列)を抽出
    const items = values
      .filter(row => row[3] === true)
      .map(row => ({
        order: Number(row[0]),
        id: String(row[1])
      }));

    // 表示順でソート
    items.sort((a, b) => a.order - b.order);

    return items;
  },

  /**
   * Drive上のテンプレートを取得して文字列で返す
   * 期待パス: TEMPLATE_ROOT/<baseDir>/<targetKey>.template.html
   *   例) baseDir="layout",     targetKey="index"   -> layout/index.template.html
   *       baseDir="components", targetKey="mission" -> components/mission.template.html
   *
   * @param {("layout"|"components")} baseDir
   * @param {string} targetKey
   * @return {string} HTML文字列 (UTF-8)
   */
  getTemplateFile(baseDir, targetKey) {
    const rootId = DRIVE_FILES.TEMPLATE_ROOT;
    if (!rootId) throw new Error('DRIVE_FILES.TEMPLATE_ROOT が未設定です');

    if (baseDir !== 'layout' && baseDir !== 'components') {
      throw new Error(`baseDir は "layout" か "components" を指定してください: ${baseDir}`);
    }
    if (!targetKey) throw new Error('targetKey を指定してください');

    const root = DriveApp.getFolderById(rootId);

    const baseIt = root.getFoldersByName(baseDir);
    if (!baseIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`${baseDir} フォルダが見つかりません`, 'getTemplateFile');
      throw new Error(`${baseDir} フォルダが見つかりません`);
    }
    const baseFolder = baseIt.next();

    const filename = `${targetKey}.template.html`;
    const files = baseFolder.getFilesByName(filename);
    if (!files.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`${filename} が見つかりません`, 'getTemplateFile');
      throw new Error(`${filename} が見つかりません`);
    }
    const file = files.next();

    const html = file.getBlob().getDataAsString('UTF-8');
    if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`OK: ${baseDir}/${filename}`, 'getTemplateFile');
    return html;
  },


  /**
   * テンプレート文字列内の <?= key ?> を replacements の値で置換する
   * @param {string} template - 置換対象のテンプレート文字列
   * @param {Object<string,string>} replacements - キーと値の対応
   * @return {string} 置換後のHTML文字列
   */
  applyTagReplacements(template, replacements) {
    return template.replace(/<\?=\s*([a-zA-Z0-9_]+)\s*\?>/g, function(_, key) {
      return (key in replacements) ? replacements[key] : "";
    });
  }


}