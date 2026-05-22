// SQLite の datetime('now') は UTC（"YYYY-MM-DD HH:MM:SS"、タイムゾーン表記なし）で保存される。
// DB は UTC のままにし、表示時のみ JST(+9h) に変換する。
// ICU/タイムゾーンデータに依存しないよう、UTC 演算で +9h して手動整形する。
export function formatJst(utc: string): string {
	const m = utc.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
	if (!m) return utc;

	const ms =
		Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + 9 * 60 * 60 * 1000;
	const jst = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, "0");

	return (
		`${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())}` +
		` ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
	);
}
