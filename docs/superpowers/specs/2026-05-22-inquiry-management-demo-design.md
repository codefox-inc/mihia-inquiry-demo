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
| UI | Tailwind CSS + shadcn/ui | コンポーネントをリポジトリにコピーして使用 |
| ローカルツールチェーン | Bun | `bun install` / `bun run dev` |
| デプロイ | Wrangler | `wrangler deploy` |

### 技術選定の前提（外部情報で確認済み）
- React Router v7 は Cloudflare の Vite プラグイン（v1.0）で公式サポート。loader/action から `context.cloudflare.env` でバインディングにアクセスできる。
- Cloudflare Workers の本番ランタイムは `workerd`（V8 ベース）であり Bun ではない。Bun はローカルのパッケージ管理・スクリプト実行に用いる。Vite プラグインによりローカルでも workerd で動くため本番と挙動が揃う。
- D1 は SQLite ベースのマネージド DB。Drizzle ORM・shadcn/ui ともこの構成でそのまま動作する。

## 3. 画面・ルート構成（パスで権限を分離）

| パス | 役割 | 内容 |
|---|---|---|
| `/` | 社員 | 問い合わせ登録フォーム。送信 → `action` で保存 → 受付完了表示 |
| `/admin` | 担当者 | 問い合わせ一覧（`loader` で取得、ステータス絞り込み） |
| `/admin/:id` | 担当者 | 詳細表示 ＋ ステータス更新（`action`） |

- 社員側は登録専用（自分の問い合わせの状況確認はしない）。
- 担当者側のみ一覧・詳細・ステータス更新ができる。
- ログインは無いため、パス（ページ）の分離で役割を表現する。将来ログインを足す布石にもなる。

## 4. データモデル

D1 テーブル `inquiries`（Drizzle スキーマで定義）

| カラム | 型 | 制約 / 既定値 | 意味 |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 主キー |
| `subject` | TEXT | NOT NULL | 件名 |
| `body` | TEXT | NOT NULL | 本文 |
| `category` | TEXT | NOT NULL | カテゴリ（総務／IT／人事） |
| `reporter_name` | TEXT | NOT NULL | 登録者名（手入力） |
| `status` | TEXT | NOT NULL DEFAULT '未対応' | ステータス（未対応／対応中／完了） |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | 登録日時 |

- カテゴリは固定の選択肢（総務／IT／人事）。
- ステータスは「未対応 → 対応中 → 完了」の3種。遷移ルールは設けず、担当者が任意に変更可能。

## 5. データアクセス

- loader/action から `context.cloudflare.env.DB`（D1 バインディング）を Drizzle 経由で操作する。
- 主な操作:
  - 登録: `INSERT`（`/` の action）
  - 一覧: `SELECT`（`/admin` の loader、ステータス絞り込み対応）
  - 詳細: `SELECT ... WHERE id = ?`（`/admin/:id` の loader）
  - ステータス更新: `UPDATE`（`/admin/:id` の action）
- スキーマ変更時は `drizzle-kit generate` でマイグレーション SQL を生成し、`wrangler d1 migrations apply` でローカル／本番に適用。

## 6. UI 方針

- Tailwind CSS + shadcn/ui のコンポーネントで最小手数で構築。
- 使用コンポーネント例: Button / Input / Textarea / Select / Table / Badge / Card。
- ステータスは Badge で色分け（未対応＝グレー／対応中＝青／完了＝緑）。
- 一覧は Table、登録フォームは Input/Textarea/Select で構成。

## 7. エラーハンドリング

- フォーム未入力: action でバリデーションし、エラーメッセージを画面に返して再表示（React Router の仕組み）。
- 存在しない ID: `/admin/:id` で 404。
- D1 エラー: ルートのエラーバウンダリで簡易表示。

## 8. テスト方針

- デモ題材のため軽量に。
- action/loader のバリデーションなど主要ロジックに最小限のユニットテスト（Vitest）。
- E2E は導入しない。

## 9. ローカル確認・デプロイの流れ（デモの見どころ）

1. `bun install`
2. `bun run db:migrate`（ローカル D1 にスキーマ適用）
3. `bun run dev`（workerd で起動、`/` と `/admin` を確認）
4. `wrangler d1 create <name>` → `wrangler.jsonc` に D1 バインディングを設定
5. `bun run db:migrate:prod`（本番 D1 へ適用）→ `wrangler deploy`

## 参考

- React Router · Cloudflare Workers docs: https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- react-router-templates / cloudflare-d1: https://deepwiki.com/remix-run/react-router-templates/4.2-cloudflare-d1
