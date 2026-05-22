import { Form, Link, useLoaderData, useSearchParams } from "react-router";
import { desc, eq } from "drizzle-orm";
import type { Route } from "./+types/admin";
import { getDb } from "~/db/client";
import { inquiries } from "~/db/schema";
import { isValidStatus } from "~/lib/validation";
import { formatJst } from "~/lib/datetime";
import { STATUSES, STATUS_BADGE_CLASS } from "~/lib/constants";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";

export function meta() {
	return [{ title: "問い合わせ一覧" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const statusFilter = url.searchParams.get("status");
	const db = getDb(context.cloudflare.env);

	const rows = isValidStatus(statusFilter)
		? await db
				.select()
				.from(inquiries)
				.where(eq(inquiries.status, statusFilter))
				.orderBy(desc(inquiries.createdAt))
		: await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));

	return { rows };
}

export default function Admin() {
	const { rows } = useLoaderData<typeof loader>();
	const [searchParams] = useSearchParams();
	const current = searchParams.get("status") ?? "";

	return (
		<main className="mx-auto max-w-4xl p-6">
			<h1 className="mb-4 text-2xl font-bold">問い合わせ一覧</h1>

			<Form method="get" className="mb-4 flex items-center gap-2">
				<label htmlFor="status-filter" className="text-sm">
					ステータス絞り込み:
				</label>
				<select
					id="status-filter"
					name="status"
					defaultValue={current}
					className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<option value="">すべて</option>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
				<Button type="submit" size="sm">
					適用
				</Button>
			</Form>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>件名</TableHead>
						<TableHead>カテゴリ</TableHead>
						<TableHead>登録者</TableHead>
						<TableHead>ステータス</TableHead>
						<TableHead>登録日時</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.length === 0 ? (
						<TableRow>
							<TableCell colSpan={5} className="text-center text-muted-foreground">
								該当する問い合わせはありません
							</TableCell>
						</TableRow>
					) : (
						rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell>
									<Link to={`/admin/${row.id}`} className="text-blue-600 underline">
										{row.subject}
									</Link>
								</TableCell>
								<TableCell>{row.category}</TableCell>
								<TableCell>{row.reporterName}</TableCell>
								<TableCell>
									<Badge className={STATUS_BADGE_CLASS[row.status]}>{row.status}</Badge>
								</TableCell>
								<TableCell>{formatJst(row.createdAt)}</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</main>
	);
}
