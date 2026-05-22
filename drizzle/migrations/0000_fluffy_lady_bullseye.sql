CREATE TABLE `inquiries` (
	`id` integer PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`category` text NOT NULL,
	`reporter_name` text NOT NULL,
	`status` text DEFAULT '未対応' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "category_check" CHECK("inquiries"."category" IN ('総務', 'IT', '人事')),
	CONSTRAINT "status_check" CHECK("inquiries"."status" IN ('未対応', '対応中', '完了'))
);
