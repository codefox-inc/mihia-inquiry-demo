import { CATEGORIES, STATUSES, type Category, type Status } from "~/lib/constants";

export type ValidatedInquiry = {
	subject: string;
	body: string;
	category: Category;
	reporterName: string;
};

export type ValidationResult =
	| { ok: true; value: ValidatedInquiry }
	| { ok: false; errors: Record<string, string> };

type RawInput = Partial<Record<keyof ValidatedInquiry, FormDataEntryValue | null>>;

export function validateInquiry(input: RawInput): ValidationResult {
	const errors: Record<string, string> = {};

	const subject = String(input.subject ?? "").trim();
	const body = String(input.body ?? "").trim();
	const category = String(input.category ?? "").trim();
	const reporterName = String(input.reporterName ?? "").trim();

	if (!subject) errors.subject = "件名を入力してください";
	if (!body) errors.body = "本文を入力してください";
	if (!reporterName) errors.reporterName = "登録者名を入力してください";
	if (!CATEGORIES.includes(category as Category)) {
		errors.category = "カテゴリを選択してください";
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: { subject, body, category: category as Category, reporterName },
	};
}

export function isValidStatus(value: unknown): value is Status {
	return typeof value === "string" && STATUSES.includes(value as Status);
}
