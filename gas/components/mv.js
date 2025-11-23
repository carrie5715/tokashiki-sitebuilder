// グローバル保持
var mv = mv || {};

var MvInfo = (function () {
	const SHEET_NAME            = 'mv';
	const PARAMETERS_SHEET_NAME = 'Parameters';
	const LOGS_SHEET_NAME       = 'Logs';

	// mv シートを読み込み、mv を更新し、Parameters へ投げる行データを返す
	function readMv_() {
		const ss = SpreadsheetApp.getActive();
		const sh = ss.getSheetByName(SHEET_NAME);
		if (!sh) throw new Error('「mv」シートが見つかりません。');

		const values = sh.getDataRange().getValues();
		if (!values || values.length === 0) return [];

		// 先頭行がヘッダーかどうか判定（A1=key, B1=value 系をヘッダーとみなす）
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
			mv[key] = val;

			// Parameters へ渡す行（カテゴリは "mv" 固定）
			rows.push({ category: 'mv', key, value: val, note });
		}
		return rows;
	}

	// Parameters 関連機能は廃止済み

	// 公開API: 読み込み + Parameters 追記 + 概要返却
	function readAndRecordMv() {
		const rows = readMv_();

		if (typeof Utils !== 'undefined' && Utils.logToSheet) {
			// Utils.logToSheet(`mv: ${Object.keys(mv).length}件`, 'MvInfo');
		}
		const ok = Object.keys(mv || {}).length > 0;
		return { mv: JSON.parse(JSON.stringify(mv)), rows, ok };
	}

	// テンプレ置換用: mv_<key> 形式のキーに変換して返却
	function getTemplateReplacements() {
		const out = {};
		Object.keys(mv).forEach(k => {
			out[`mv_${k}`] = mv[k];
		});
		return out;
	}

	// 全メタを浅いコピーで取得
	function getAll() {
		return JSON.parse(JSON.stringify(mv));
	}

	return {
		readAndRecordMv,
		getTemplateReplacements,
		getAll,
		// 内部API（必要なら利用）
		readMv_: readMv_,
		// ensureParametersSheet_, appendToParameters_ は廃止
	};
})();
