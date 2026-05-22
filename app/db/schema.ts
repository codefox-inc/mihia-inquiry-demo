import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { CATEGORIES, STATUSES } from "~/lib/constants";

const categoryList = CATEGORIES.map((c) => `'${c}'`).join(", ");
const statusList = STATUSES.map((s) => `'${s}'`).join(", ");

export const inquiries = sqliteTable(
	"inquiries",
	{
		id: integer("id").primaryKey(),
		subject: text("subject").notNull(),
		body: text("body").notNull(),
		// { enum } で型を Category/Status の union に締める（$inferSelect.status が Status になり
		// 一覧/詳細でのキャストが不要になる）。enum は型のみでランタイム検証はしないため、
		// 下の check() 制約と action 側 validateInquiry の二重ガードは引き続き必要。
		category: text("category", { enum: CATEGORIES }).notNull(),
		reporterName: text("reporter_name").notNull(),
		status: text("status", { enum: STATUSES }).notNull().default("未対応"),
		createdAt: text("created_at")
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(table) => [
		check("category_check", sql`${table.category} IN (${sql.raw(categoryList)})`),
		check("status_check", sql`${table.status} IN (${sql.raw(statusList)})`),
	],
);

export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
