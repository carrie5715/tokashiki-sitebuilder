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

  /**
   * TEMPLATE_ROOT/js/<name> を output/js/ にコピー（同名があれば上書き）
   * @param {string} name 例) "store.js"
   * @returns {string|null} ファイルID（作成/更新）または null（ソースなし）
   */
  copyJsFromTemplate(name) {
    if (!name) return null;
    const rootId = DRIVE_FILES.TEMPLATE_ROOT;
    const root = DriveApp.getFolderById(rootId);

    // js フォルダ
    const jsFolderIt = root.getFoldersByName('js');
    if (!jsFolderIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('TEMPLATE_ROOT/js が見つかりません', 'copyJsFromTemplate');
      return null;
    }
    const jsFolder = jsFolderIt.next();

    const files = jsFolder.getFilesByName(name);
    if (!files.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`テンプレ側のJSが見つかりません: ${name}`, 'copyJsFromTemplate');
      return null;
    }
    const srcFile = files.next();
    const blob = srcFile.getBlob().setName(name);

    // 出力先: output/js
    const outJsId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_JS_ID);
    if (!outJsId) throw new Error('OUTPUT_JS_ID が未設定です。Build.checkDirectories() を先に呼んでください。');
    const outJsFolder = DriveApp.getFolderById(outJsId);

    // 既存があれば中身を更新、なければ新規作成
    const outIt = outJsFolder.getFilesByName(name);
    if (outIt.hasNext()) {
      const dst = outIt.next();
      dst.setContent(blob.getDataAsString());
      return dst.getId();
    } else {
      const created = outJsFolder.createFile(blob);
      return created.getId();
    }
  },

  /**
   * スクリプトタグを構築し、必須/条件付きのJSファイルを output/js に配置
  * @param {{mvOk:boolean, missionOk:boolean, serviceOk?:boolean, companyOk?:boolean, worksOk?:boolean}} flags
   * @returns {string} HTML の <script> タグ列
   */
  buildScriptsTag(flags) {
    const list = [
      'store.js',
      'main.js',
      'header.js',
    ];
    if (flags && flags.mvOk) list.push('mv.js');
    if (flags && flags.missionOk) list.push('mission.js');
  if (flags && flags.serviceOk) list.push('service.js');
  if (flags && flags.companyOk) list.push('company.js');
  if (flags && flags.worksOk) list.push('works.js');

    const tags = [];
    list.forEach((name) => {
      try {
        const id = this.copyJsFromTemplate(name);
        if (id) tags.push(`<script src="/js/${name}"></script>`);
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`JSコピー失敗: ${name} - ${e.message}`, 'buildScriptsTag');
      }
    });
    return tags.join('\n');
  },


  loadTemplates(targetLayout, order) {
    Utils.logToSheet(`テンプレート読み込み開始`, 'loadTemplates');

    let indexLayout = this.getTemplateFile('layout', targetLayout || 'default');

    // デバッグ: 読み込んだ生レイアウトを保存（DEBUG_BUILD が true のときのみ）
    if (typeof DEBUG_BUILD !== 'undefined' && DEBUG_BUILD) {
      try {
        const outRootId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_ID);
        if (outRootId) {
          this.saveHtmlToFolder(outRootId, `debug__layout_${targetLayout || 'default'}_raw.html`, indexLayout);
        }
      } catch (e) {
        // noop
      }
    }

    // セクション生成
    let sectionString = ''
    if (order && order.length > 0) {
      order.forEach((item) => {
        Utils.logToSheet(`セクションID:[${item.id}]`, 'loadTemplates');
        if (item.id === 'mv') {
          sectionString += this.getMvContents() + '\n';
        }
        if (item.id === 'mission') {
          sectionString += this.getMissionContents() + '\n';
        }
        if (item.id === 'service') {
          sectionString += this.getServiceContents() + '\n';
        }
        if (item.id === 'company') {
          sectionString += this.getCompanyContents() + '\n';
        }
        if (item.id === 'works') {
          sectionString += this.getWorksContents() + '\n';
        }
        // 他のセクションもこの分岐に追加
      });
    }

    // header/footer 読み込み（現状は静的テンプレートをそのまま埋め込み）
    const headerHtml = this.getHeaderContents();
    const footerHtml = this.getFooterContents();

    // 置換の順序: contents -> header/footer -> meta
    if (sectionString.length > 0) {
      indexLayout = this.applyTagReplacements(indexLayout, { contents: sectionString });
    }
    indexLayout = this.applyTagReplacements(indexLayout, { header: headerHtml, footer: footerHtml });

    // デバッグ: セクション・ヘッダー・フッター差し込み後も保存（DEBUG_BUILD が true のときのみ）
    if (typeof DEBUG_BUILD !== 'undefined' && DEBUG_BUILD) {
      try {
        const outRootId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_ID);
        if (outRootId) {
          this.saveHtmlToFolder(outRootId, `debug__layout_${targetLayout || 'default'}_before_meta.html`, indexLayout);
        }
      } catch (e) {
        // noop
      }
    }

    Utils.logToSheet(`${targetLayout}テンプレート読み込み完了:[${typeof indexLayout}]`, 'loadTemplates');

    // meta 情報の差し込み（MetaInfo に集約）
    const metaRepl = (typeof MetaInfo !== 'undefined' && MetaInfo.getTemplateReplacements)
      ? MetaInfo.getTemplateReplacements()
      : ((typeof MetaInfo !== 'undefined' && MetaInfo.getLayoutReplacements)
        ? MetaInfo.getLayoutReplacements()
        : { title: '', description: '', url: '', image: '' });
    const output = this.applyTagReplacements(indexLayout, metaRepl);
    return output;
  },

  /** mv */
  getMvContents() {
    const template = this.getTemplateFile('components', 'mv');
    // まず MvInfo（グローバルmvを元に整形したマップ）を優先し、
    // なければ従来の Utils.getSheetValue にフォールバック。
    let replacements = {};
    if (typeof MvInfo !== 'undefined' && typeof MvInfo.getTemplateReplacements === 'function') {
      replacements = MvInfo.getTemplateReplacements();
    } else {
      replacements = {
        mv_catchphrase: Utils.getSheetValue('mv', 'catchphrase'),
        mv_bg_image_url_pc: Utils.getSheetValue('mv', 'bg_image_url_pc'),
        mv_bg_image_url_sp: Utils.getSheetValue('mv', 'bg_image_url_sp'),
        mv_bg_image_alt: Utils.getSheetValue('mv', 'bg_image_alt'),
      };
    }

    return this.applyTagReplacements(template, replacements);
  },

  /** services */
  getServiceContents() {
    const template = this.getTemplateFile('components', 'service');
    let replacements = {};
    if (typeof ServiceInfo !== 'undefined' && typeof ServiceInfo.getTemplateReplacements === 'function') {
      replacements = ServiceInfo.getTemplateReplacements();
    } else {
      replacements = {
        section_title: Utils.getSheetValue('service', 'section_title') || '',
        section_title_en: Utils.getSheetValue('service', 'section_title_en') || '',
        section_intro: Utils.getSheetValue('service', 'section_intro') || '',
      };
    }
    return this.applyTagReplacements(template, replacements);
  },

  /** company */
  getCompanyContents() {
    const template = this.getTemplateFile('components', 'company');
    let replacements = {};
    if (typeof CompanyInfo !== 'undefined' && typeof CompanyInfo.getTemplateReplacements === 'function') {
      replacements = CompanyInfo.getTemplateReplacements();
    } else {
      const rawTag = Utils.getSheetValue('company', 'googlemap_tag') || '';
      const wrapped = (rawTag && String(rawTag).trim()) ? `<div class="googlemap-wrap">${String(rawTag).trim()}</div>` : '';
      replacements = {
        section_title: Utils.getSheetValue('company', 'section_title') || '',
        section_title_en: Utils.getSheetValue('company', 'section_title_en') || '',
        googlemap_tag: wrapped,
      };
    }
    return this.applyTagReplacements(template, replacements);
  },

  /** works */
  getWorksContents() {
    const template = this.getTemplateFile('components', 'works');
    let replacements = {};
    if (typeof WorksInfo !== 'undefined' && typeof WorksInfo.getTemplateReplacements === 'function') {
      replacements = WorksInfo.getTemplateReplacements();
    } else {
      replacements = {
        section_title: Utils.getSheetValue('works', 'section_title') || '',
        section_intro: Utils.getSheetValue('works', 'section_intro') || '',
      };
    }
    return this.applyTagReplacements(template, replacements);
  },

  /** header */
  getHeaderContents() {
    // 必要に応じて置換を追加
    const template = this.getTemplateFile('components', 'header');
    return template;
  },

  /** footer */
  getFooterContents() {
    // 必要に応じて置換を追加
    const template = this.getTemplateFile('components', 'footer');
    return template;
  },

  /** mission */
  getMissionContents() {
    const template = this.getTemplateFile('components', 'mission');
    // MissionInfo があればそれを優先（改行→<br> を含む）
    let replacements = {};
    if (typeof MissionInfo !== 'undefined' && typeof MissionInfo.getTemplateReplacements === 'function') {
      replacements = MissionInfo.getTemplateReplacements();
      // テンプレ互換: heading_text / intro_text キーがあれば優先で埋める
      if (replacements['mission_heading_text'] && !replacements['heading_text']) {
        replacements['heading_text'] = replacements['mission_heading_text'];
      }
      if (replacements['mission_intro_text'] && !replacements['intro_text']) {
        replacements['intro_text'] = replacements['mission_intro_text'];
      }
    } else {
      replacements = {
        mission_heading_text: Utils.getSheetValue('mission', 'heading_text'),
        mission_intro_text: Utils.getSheetValue('mission', 'intro_text'),
      };
      // 互換キー
      replacements['heading_text'] = replacements['mission_heading_text'];
      replacements['intro_text'] = replacements['mission_intro_text'];
    }

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

    // 表示フラグ(D列)がオンの行だけ取り出し（true/1/"TRUE"/"yes"/"on" 等を許容）
    const items = values
      .filter(row => {
        const v = row[3];
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
        }
        return false;
      })
      .map(row => ({
        order: Number(row[0]),
        id: String(row[1]).trim()
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
    // 未指定のキーは消さずに残す（後段の置換パスで埋めるため）
    return template.replace(/<\?=\s*([a-zA-Z0-9_]+)\s*\?>/g, function(match, key) {
      return (key in replacements) ? String(replacements[key]) : match;
    });
  }


}