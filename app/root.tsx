import {
	isRouteErrorResponse,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="min-h-screen bg-gray-50 dark:bg-gray-950">
				<header className="border-b bg-white dark:bg-gray-900">
					<div className="mx-auto flex max-w-4xl items-center gap-6 p-4">
						<Link to="/" className="font-bold">
							問い合わせ管理（デモ）
						</Link>
						<nav className="flex gap-4 text-sm text-muted-foreground">
							<Link to="/" className="hover:underline">
								登録
							</Link>
							<Link to="/admin" className="hover:underline">
								一覧
							</Link>
						</nav>
					</div>
				</header>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "エラー";
		details =
			error.status === 404
				? "指定された問い合わせが見つかりませんでした。"
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="container mx-auto max-w-xl p-6 pt-16">
			<h1 className="mb-2 text-3xl font-bold">{message}</h1>
			<p className="mb-6 text-muted-foreground">{details}</p>
			<nav className="flex gap-4 text-sm">
				<Link to="/" className="text-blue-600 underline">
					登録画面へ
				</Link>
				<Link to="/admin" className="text-blue-600 underline">
					問い合わせ一覧へ
				</Link>
			</nav>
			{stack && (
				<pre className="mt-6 w-full overflow-x-auto p-4">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
