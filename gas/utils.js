const Utils = {

  /**
   * Logsシートにログを追加し、最新30件だけ残す
   * @param {string} message - ログメッセージ
   * @param {string} [funcName] - 関数名（不要なら省略）
   */
  logToSheet(message, funcName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'Logs';
    
    // Logsシートがなければ作成（初期レイアウト設定もここで）
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Time', 'Function', 'Message']); // ヘッダー行

      // 列幅設定（A列=140, B列=140, C列=720）
      sheet.setColumnWidths(1, 1, 140); // A
      sheet.setColumnWidths(2, 1, 140); // B
      sheet.setColumnWidths(3, 1, 720); // C

      // ヘッダー以外のA列・B列を中央寄せ（初期状態では空なので全体に設定しておく）
      sheet.getRange('A2:B').setHorizontalAlignment('center');
    }

    // ログ行を追加
    sheet.appendRow([new Date(), funcName || '', message]);

    // ヘッダー含め31行を超えたら古い行を削除
    const lastRow = sheet.getLastRow();
    if (lastRow > 20) {
      const extra = lastRow - 20;
      sheet.deleteRows(2, extra);
    }
  },

  /**
   * 親フォルダ取得（スプレッドシートが入ってるフォルダ）
   */
  getParentFolder_() {
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const file = DriveApp.getFileById(ssId);
    const it = file.getParents();
    return it.hasNext() ? it.next() : null;
  },

  /**
   * 子フォルダ取得 or 作成（同名が複数あれば最初の1つを採用）
   */
  getOrCreateSubFolder_(parentFolder, name) {
    const it = parentFolder.getFoldersByName(name);
    if (it.hasNext()) return it.next();
    return parentFolder.createFolder(name);
  },

  /**
   * 指定シートの A列から key を探し、同じ行の B列の値を返す
   * @param {string} sheetName - シート名
   * @param {string} key - 探すキー（A列の文字列）
   * @return {string|null} 見つかれば B列の値、なければ null
   */
  getSheetValue(sheetName, key) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("シートが見つかりません: " + sheetName);

    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return null;

    // A列とB列をまとめて取得
    var values = sheet.getRange(1, 1, lastRow, 2).getValues();

    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === key) {
        return values[i][1]; // B列
      }
    }

    return null; // 見つからなかった場合
  },

  /**
   * 指定フォルダをZIP化してDriveに保存する
   * @param {string} folderId - 圧縮対象のフォルダID
   * @param {string} zipName  - 出力するzipファイル名
   * @return {GoogleAppsScript.Drive.File} 作成されたzipファイル
   */
  zipFolder(folderId, zipName) {
    const folder = DriveApp.getFolderById(folderId);
    const blobs = [];

    // フォルダ直下のファイルを全部まとめる（サブフォルダは別処理が必要）
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      blobs.push(file.getBlob().setName(file.getName())); 
    }

    // zip化して保存
    const zip = Utilities.zip(blobs, zipName + ".zip");
    const saved = DriveApp.createFile(zip);
    return saved;
  }


}