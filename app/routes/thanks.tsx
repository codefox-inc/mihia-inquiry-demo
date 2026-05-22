import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export function meta() {
	return [{ title: "受付完了" }];
}

export default function Thanks() {
	return (
		<main className="mx-auto max-w-xl p-6 text-center">
			<h1 className="mb-4 text-2xl font-bold">送信が完了しました</h1>
			<p className="mb-6 text-muted-foreground">
				担当者が確認します。ありがとうございました。
			</p>
			<Button asChild>
				<Link to="/">続けて登録する</Link>
			</Button>
		</main>
	);
}
