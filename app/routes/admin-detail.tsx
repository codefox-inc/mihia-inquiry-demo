import { Form, Link, data, redirect, useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/admin-detail";
import { getDb } from "~/db/client";
import { inquiries } from "~/db/schema";
import { isValidStatus } from "~/lib/validation";
import { STATUSES, STATUS_BADGE_CLASS } from "~/lib/constants";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function meta() {
	return [{ title: "問い合わせ詳細" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw data("Not Found", { status: 404 });

	const db = getDb(context.cloudflare.env);
	const row = await db.select().from(inquiries).where(eq(inquiries.id, id)).get();
	if (!row) throw data("Not Found", { status: 404 });

	return { row };
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw data("Not Found", { status: 404 });

	const formData = await request.formData();
	const status = formData.get("status");
	if (!isValidStatus(status)) {
		return { error: "不正なステータスです" };
	}

	const db = getDb(context.cloudflare.env);
	await db.update(inquiries).set({ status }).where(eq(inquiries.id, id));
	throw redirect(`/admin/${id}`);
}

export default function AdminDetail() {
	const { row } = useLoaderData<typeof loader>();

	return (
		<main className="mx-auto max-w-2xl p-6">
			<Link to="/admin" className="text-sm text-blue-600 underline">
				← 一覧へ戻る
			</Link>
			<Card className="mt-4">
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span>{row.subject}</span>
						<Badge className={STATUS_BADGE_CLASS[row.status]}>{row.status}</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p>
						<span className="font-medium">カテゴリ:</span> {row.category}
					</p>
					<p>
						<span className="font-medium">登録者:</span> {row.reporterName}
					</p>
					<p>
						<span className="font-medium">登録日時:</span> {row.createdAt}
					</p>
					<p className="whitespace-pre-wrap border-t pt-3">{row.body}</p>

					<Form method="post" className="flex items-center gap-2 border-t pt-4">
						<label htmlFor="status" className="text-sm font-medium">
							ステータス変更:
						</label>
						<select
							id="status"
							name="status"
							defaultValue={row.status}
							className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							{STATUSES.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
						<Button type="submit" size="sm">
							更新
						</Button>
					</Form>
				</CardContent>
			</Card>
		</main>
	);
}
