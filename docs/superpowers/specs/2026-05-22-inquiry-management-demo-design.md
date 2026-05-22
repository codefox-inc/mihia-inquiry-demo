# 小規模な社内向け問い合わせ管理ツール（デモ）設計

- 作成日: 2026-05-22
- 題材: MiHiA バイブコーディング研究分科会 第1回 デモ
- 目的: 短時間で「画面／データ／ステータス／権限／ローカル確認／デプロイ」の流れを見せられる、小さなアプリ

## 1. 概要

社内向けの問い合わせ管理ツール。社員が問い合わせを登録し、担当者が一覧・詳細を確認してステータスを更新する。ログイン機能・通知機能は実装しない（権限はパスで分離して表現する）。

### スコープ
- 含む: 問い合わせの登録／一覧／詳細／ステータス更新
- 含まない: ログイン認証、通知、社員側からの状況確認、優先度・担当者割当などの拡張項目

## 2. 技術構成

| 領域 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Vite + React Router v7（フレームワークモード） | 画面・loader/action を1コードベースで完結 |
| 実行基盤 | Cloudflare Workers + Cloudflare Vite プラグイン | ローカルでも workerd で動かし本番と挙動を一致 |
| データベース | Cloudflare D1（SQLite） | ローカルは Wrangler がエミュレート、本番は D1 |
| ORM | Drizzle ORM（`drizzle-orm/d1`） | スキーマを TypeScript で定義し型安全にクエリ |
| マイグレーション | drizzle-kit + `wrangler d1 migrations apply` | `drizzle-kit generate` で SQL を生成し適用 |
| 型生成 | `wrangler types`（`cf-typegen` スクリプト） | `wrangler.jsonc` のバインディングから `Env` 型を生成 |
| UI | Tailwind CSS v4 + shadcn/ui | Tailwind は CSS-first 設定。shadcn は React Router 用 init |
| ローカルツールチェーン | Bun | `bun install` / `bun run dev` |
| デプロイ | Wrangler | `wrangler deploy` |

### 技術選定の前提（外部情報で確認済み）
- React Router v7 は Cloudflare の Vite プラグイン（v1.0）で公式サポート。loader/action から `context.cloudflare.env` でバインディングにアクセスできる。
- Cloudflare Workers の本番ランタイムは `workerd`（V8 ベース）であり Bun ではない。Bun はローカルのパッケージ管理・スクリプト実行に用いる。Vite プラグインによりローカルでも workerd で動くため本番と挙動が揃う。
- D1 は SQLite ベースのマネージド DB。Drizzle ORM・shadcn/ui ともこの構成でそのまま動作する。
- `env.DB` を型付きで使うには、`wrangler.jsonc` に D1 バインディングを追加したあと `wrangler types`（C3 テンプレートでは `bun run cf-typegen`）で `worker-configuration.d.ts`（`Env` 型）を再生成する必要がある。
- shadcn/ui のパスエイリアスはフレームワークで異なる（React Router 用は `~/*`、Vite 単体用は `@/*`）。本構成は React Router フレームワークモードなので **React Router 用の `shadcn init`（import は `~/components/ui/*`）** を使う。
- Tailwind は v4（CSS-first、`tailwind.config.js` 不要。`app/app.css` で `@import "tailwindcss";`）。C3 の React Router テンプレートは Tailwind を同梱する。

## 3. 画面・ルート構成（パスで権限を分離）

| パス | 役割 | 内容 |
|---|---|---|
| `/` | 社員 | 問い合わせ登録フォーム。送信 → `action` で保存 → 完了画面へ redirect |
| `/admin` | 担当者 | 問い合わせ一覧（`loader` で取得、ステータス絞り込み） |
| `/admin/:id` | 担当者 | 詳細表示 ＋ ステータス更新（`action`） |

### 成功後の遷移（PRG パターン）
- 登録成功時: 完了画面（例 `/thanks`）へ `redirect`。リロードでの二重送信・戻る操作での再送信を防ぐ。
- ステータス更新成功時: `/admin/:id` へ `redirect`（同一詳細を再表示）。
- いずれも action は成功時 `redirect` を返し、失敗時のみ `{ errors }` を返して `useActionData()` で再表示する。

- 社員側は登録専用（自分の問い合わせの状況確認はしない）。
- 担当者側のみ一覧・詳細・ステータス更新ができる。
- ログインは無いため、パス（ページ）の分離で役割を表現する。将来ログインを足す布石にもなる。
- ただしこれは権限の「見立て」であり実際のアクセス制御ではない（URL を知れば誰でも `/admin` に入れる）。デモ用途として割り切り、本番運用では認証が必要になる点を明示する。

## 4. データモデル

D1 テーブル `inquiries`（Drizzle スキーマで定義）

| カラム | 型 | 制約 / 既定値 | 意味 |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | 主キー（SQLite の rowid エイリアスで自動採番。`AUTOINCREMENT` は付けない） |
| `subject` | TEXT | NOT NULL | 件名 |
| `body` | TEXT | NOT NULL | 本文 |
| `category` | TEXT | NOT NULL | カテゴリ（総務／IT／人事） |
| `reporter_name` | TEXT | NOT NULL | 登録者名（手入力） |
| `status` | TEXT | NOT NULL DEFAULT '未対応' | ステータス（未対応／対応中／完了） |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | 登録日時 |

- カテゴリは固定の選択肢（総務／IT／人事）。
- ステータスは「未対応 → 対応中 → 完了」の3種。遷移ルールは設けず、担当者が任意に変更可能。
- `category` と `status` は固定値の集合。`action` で **whitelist 検証**（許可値以外は拒否）し、フォーム改変や直接 POST で任意文字列が入って一覧フィルタや Badge 色分けが壊れるのを防ぐ。あわせて DB 側にも `CHECK` 制約（`category IN (...)` / `status IN (...)`）を入れて二重に守る。

### シードデータ
- 一覧・ステータス色分け・絞り込みをデモ映えさせるため、初期データを投入する。
- 手段: `seed.sql` を用意し `wrangler d1 execute <DB> --local --file=./seed.sql` で投入（`bun run db:seed` スクリプト化）。各ステータス・各カテゴリが混在する数件を入れる。
- **冪等性**: デモ準備で繰り返し実行できるよう、`seed.sql` の先頭で `DELETE FROM inquiries;` してから固定 ID で `INSERT` する（毎回同じ状態に戻る）。

## 5. データアクセス

- loader/action から `context.cloudflare.env.DB`（D1 バインディング）を Drizzle 経由で操作する。
- 主な操作:
  - 登録: `INSERT`（`/` の action）
  - 一覧: `SELECT`（`/admin` の loader、ステータス絞り込み対応）
  - 詳細: `SELECT ... WHERE id = ?`（`/admin/:id` の loader）
  - ステータス更新: `UPDATE`（`/admin/:id` の action）
- `drizzle.config.ts` を用意し、`schema` / `dialect: 'sqlite'` を設定。`out`（マイグレーション出力先）は `wrangler.jsonc` の `migrations_dir` と一致させる。
- スキーマ変更時は `drizzle-kit generate` でマイグレーション SQL を生成し、`wrangler d1 migrations apply <DB> --local`（ローカル）／`--remote`（本番）で適用する。

## 6. UI 方針

- Tailwind CSS v4（CSS-first）+ shadcn/ui のコンポーネントで最小手数で構築。
- shadcn は React Router 用 init（import は `~/components/ui/*`）でセットアップする。
- 使用コンポーネント例: Button / Input / Textarea / Table / Badge / Card。
- カテゴリ／ステータスの選択は **native `<select>`**（Tailwind で Input と質感を揃える）で実装する。shadcn の Select は Radix の制御コンポーネントで `<Form method="post">` の素のフォーム送信に値が載りにくいため。
- ステータスは Badge で色分け（未対応＝グレー／対応中＝青／完了＝緑。`border-transparent` を付けて枠線が浮かないようにする）。
- 一覧は Table、登録フォームは Input/Textarea/native select で構成。

## 7. エラーハンドリング

- フォーム未入力: `action` でバリデーションし、`{ errors }` を返す。コンポーネント側で `useActionData()` を読んでエラー表示・再入力させる。検証はデモ規模なので手書きで可（Zod は任意）。
- 存在しない ID: `/admin/:id` の loader で `throw data(..., { status: 404 })`。
- D1 エラー・404: `root.tsx` の `ErrorBoundary` で受け、`isRouteErrorResponse` で 404 と 500 を出し分けて簡易表示する。
- 認証なし・社内・デモ用途のため、CSRF／セッション対策は対象外（YAGNI）。

## 8. テスト方針

- デモ題材のため軽量に。
- **バリデーション等のロジックは純粋関数に切り出し**（例: `validateInquiry(input)` が `category`/`status` の whitelist 検証と必須チェックを行う）、それを Vitest でユニットテストする。
- D1 バインディングに依存する loader/action 本体は、純粋関数を呼ぶ薄いラッパに留めることでテスト対象を最小化する。Cloudflare Workers Vitest integration（bindings 付きテスト）は本デモでは**導入しない**。
- E2E は導入しない。

## 9. 初期セットアップ（空リポジトリからの scaffold）

このリポジトリは空なので、まず雛形を生成する。

1. **プロジェクト生成**: `bun create cloudflare@latest -- --framework=react-router`（C3。React Router v7 + Cloudflare Vite プラグイン + Tailwind 同梱の雛形が生成される。生成後、本リポジトリ構成に合わせて配置）
   - 主な生成物: `app/`（`root.tsx` / `routes/` / `app.css`）、`workers/app.ts`、`vite.config.ts`、`wrangler.jsonc`、`react-router.config.ts`、`tsconfig.json`、`package.json`
2. **shadcn/ui 初期化**: `bunx shadcn@latest init`（React Router を自動検出。`components.json` 生成、エイリアスは `~/*`）
3. **コンポーネント追加**: `bunx shadcn@latest add button input textarea select table badge card`
4. **Drizzle 導入**: `bun add drizzle-orm` / `bun add -D drizzle-kit` を入れ、`drizzle.config.ts` と `app/db/schema.ts`（`inquiries` テーブル定義）を追加

## 10. ローカル確認・デプロイの流れ（デモの見どころ）

1. `bun install`
2. `wrangler d1 create mihia-inquiry` → 出力された `database_id` を `wrangler.jsonc` の D1 バインディング（`binding` / `database_name` / `database_id` / `migrations_dir`）に設定
3. `bun run cf-typegen`（= `wrangler types`）で `Env` 型を生成し、`env.DB` を型付きで使えるようにする
4. `bun run db:generate`（= `drizzle-kit generate`）でスキーマからマイグレーション SQL を生成
5. `bun run db:migrate`（= `wrangler d1 migrations apply mihia-inquiry --local`）でローカル D1 に適用
6. `bun run db:seed`（= `wrangler d1 execute mihia-inquiry --local --file=./seed.sql`）で初期データ投入
7. `bun run dev`（workerd で起動、`/` と `/admin` を確認）
8. `bun run db:migrate:prod`（= `wrangler d1 migrations apply mihia-inquiry --remote`）で本番 D1 へ適用 → `wrangler deploy`

### npm/bun スクリプト（package.json）対応表
| スクリプト | コマンド |
|---|---|
| `cf-typegen` | `wrangler types` |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `wrangler d1 migrations apply mihia-inquiry --local` |
| `db:migrate:prod` | `wrangler d1 migrations apply mihia-inquiry --remote` |
| `db:seed` | `wrangler d1 execute mihia-inquiry --local --file=./seed.sql` |

## 参考

- React Router · Cloudflare Workers docs: https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- react-router-templates / cloudflare-d1: https://deepwiki.com/remix-run/react-router-templates/4.2-cloudflare-d1
