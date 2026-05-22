import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/home";
import { getDb } from "~/db/client";
import { inquiries } from "~/db/schema";
import { validateInquiry } from "~/lib/validation";
import { CATEGORIES } from "~/lib/constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function meta() {
	return [{ title: "問い合わせ登録" }];
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const result = validateInquiry({
		subject: formData.get("subject"),
		body: formData.get("body"),
		category: formData.get("category"),
		reporterName: formData.get("reporterName"),
	});

	if (!result.ok) {
		return { errors: result.errors };
	}

	const db = getDb(context.cloudflare.env);
	await db.insert(inquiries).values(result.value);
	throw redirect("/thanks");
}

// native select を Input と質感を揃えるための共通クラス
const selectClass =
	"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function Home() {
	const actionData = useActionData<typeof action>();
	const errors = actionData?.errors ?? {};

	return (
		<main className="mx-auto max-w-xl p-6">
			<Card>
				<CardHeader>
					<CardTitle>社内問い合わせ登録</CardTitle>
				</CardHeader>
				<CardContent>
					<Form method="post" className="space-y-4">
						<div>
							<label htmlFor="subject" className="mb-1 block text-sm font-medium">
								件名
							</label>
							<Input id="subject" name="subject" />
							{errors.subject && (
								<p className="mt-1 text-sm text-red-600">{errors.subject}</p>
							)}
						</div>
						<div>
							<label htmlFor="body" className="mb-1 block text-sm font-medium">
								本文
							</label>
							<Textarea id="body" name="body" rows={5} />
							{errors.body && (
								<p className="mt-1 text-sm text-red-600">{errors.body}</p>
							)}
						</div>
						<div>
							<label htmlFor="category" className="mb-1 block text-sm font-medium">
								カテゴリ
							</label>
							<select id="category" name="category" defaultValue="" className={selectClass}>
								<option value="">選択してください</option>
								{CATEGORIES.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</select>
							{errors.category && (
								<p className="mt-1 text-sm text-red-600">{errors.category}</p>
							)}
						</div>
						<div>
							<label htmlFor="reporterName" className="mb-1 block text-sm font-medium">
								登録者名
							</label>
							<Input id="reporterName" name="reporterName" />
							{errors.reporterName && (
								<p className="mt-1 text-sm text-red-600">{errors.reporterName}</p>
							)}
						</div>
						<Button type="submit">送信する</Button>
					</Form>
				</CardContent>
			</Card>
		</main>
	);
}
