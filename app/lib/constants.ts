export const CATEGORIES = ["総務", "IT", "人事"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["未対応", "対応中", "完了"] as const;
export type Status = (typeof STATUSES)[number];

// ステータスごとの Badge 配色（Tailwind クラス）
// border-transparent で variant 既定の枠線色が浮くのを防ぐ。Badge は <span> なので hover 指定は不要。
export const STATUS_BADGE_CLASS: Record<Status, string> = {
	未対応: "border-transparent bg-gray-200 text-gray-800",
	対応中: "border-transparent bg-blue-200 text-blue-800",
	完了: "border-transparent bg-green-200 text-green-800",
};
