import { describe, expect, it } from "vitest";
import { isValidStatus, validateInquiry } from "~/lib/validation";

describe("validateInquiry", () => {
	const valid = {
		subject: "PCが起動しない",
		body: "電源が入りません",
		category: "IT",
		reporterName: "山田太郎",
	};

	it("有効な入力を受け付ける", () => {
		const result = validateInquiry(valid);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.category).toBe("IT");
	});

	it("必須項目（件名）が空ならエラーを返す", () => {
		const result = validateInquiry({ ...valid, subject: "   " });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.subject).toBeDefined();
	});

	it("許可外カテゴリを拒否する", () => {
		const result = validateInquiry({ ...valid, category: "経理" });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.category).toBeDefined();
	});
});

describe("isValidStatus", () => {
	it("許可ステータスを通す", () => {
		expect(isValidStatus("対応中")).toBe(true);
	});
	it("許可外ステータスを弾く", () => {
		expect(isValidStatus("却下")).toBe(false);
	});
});
