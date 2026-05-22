import { describe, expect, it } from "vitest";
import { formatJst } from "~/lib/datetime";

describe("formatJst", () => {
	it("UTCをJST(+9h)に変換して整形する", () => {
		// 09:00 UTC -> 18:00 JST（同日）
		expect(formatJst("2026-05-20 09:00:00")).toBe("2026/05/20 18:00");
	});

	it("日付をまたぐ変換を正しく扱う", () => {
		// 16:30 UTC -> 翌日 01:30 JST
		expect(formatJst("2026-05-20 16:30:00")).toBe("2026/05/21 01:30");
	});

	it("T区切りのISO風文字列も扱える", () => {
		expect(formatJst("2026-05-19T14:00:00")).toBe("2026/05/19 23:00");
	});

	it("解析できない文字列は入力をそのまま返す", () => {
		expect(formatJst("invalid")).toBe("invalid");
	});
});
