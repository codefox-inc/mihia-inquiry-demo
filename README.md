# 社内向け問い合わせ管理ツール（デモ）

MiHiA バイブコーディング研究分科会 第1回のデモ題材。小規模な社内向け問い合わせ管理ツールです。

- **社員**：問い合わせを登録（`/`）→ 受付完了（`/thanks`）
- **担当者**：一覧（`/admin`、ステータス絞り込み）／詳細・ステータス更新（`/admin/:id`）
- ログイン・通知はなし。権限はパスで分離（デモ用の割り切りで、実アクセス制御ではありません）

## 技術構成

| 領域 | 採用技術 |
|---|---|
| フレームワーク | Vite + React Router v7（フレームワークモード） |
| 実行基盤 | Cloudflare Workers + Cloudflare Vite プラグイン |
| データベース | Cloudflare D1（SQLite） |
| ORM | Drizzle ORM |
| UI | Tailwind CSS v4 + shadcn/ui |
| ローカルツールチェーン | Bun |
| デプロイ | Wrangler |
| テスト | Vitest（純粋関数のユニットテスト） |

## セットアップ

```bash
bun install
```

## ローカル開発

```bash
bun run db:migrate   # ローカル D1 にマイグレーション適用
bun run db:seed      # 初期データ投入（冪等：毎回同じ4件にリセット）
bun run dev          # http://localhost:5173
```

- `/` … 問い合わせ登録（社員用）
- `/admin` … 一覧（担当者用）
- `/admin/:id` … 詳細・ステータス更新（担当者用）

## よく使うコマンド

```bash
bun run test         # ユニットテスト（Vitest）
bun run typecheck    # 型生成 + 型チェック
bun run build        # 本番ビルド
bun run check        # typecheck + build + wrangler dry-run（CI 相当の総合チェック）
```

### データベース関連

```bash
bun run db:generate     # スキーマ(app/db/schema.ts)からマイグレーション SQL を生成
bun run db:migrate      # ローカル D1 に適用（--local）
bun run db:seed         # ローカル D1 にシード投入
bun run db:migrate:prod # 本番 D1 に適用（--remote、要 wrangler login）
```

## デプロイ（Cloudflare Workers）

> **重要:** `wrangler.json` の `d1_databases[0].database_id` はローカル用のプレースホルダ
> （`00000000-0000-0000-0000-000000000000`）です。本番デプロイ前に実際の ID へ差し替えてください。

```bash
wrangler login
wrangler d1 create mihia-inquiry          # 出力された database_id を wrangler.json に設定
bun run db:migrate:prod                    # 本番 D1 にマイグレーション適用
# 必要なら本番にもシード:
# wrangler d1 execute mihia-inquiry --remote --file=./seed.sql
bun run deploy                             # ビルド + wrangler deploy
```

## データモデル（`inquiries`）

| カラム | 型 | 備考 |
|---|---|---|
| `id` | INTEGER PK | 自動採番 |
| `subject` | TEXT | 件名 |
| `body` | TEXT | 本文 |
| `category` | TEXT | 総務／IT／人事（CHECK 制約 + action 側 whitelist 検証） |
| `reporter_name` | TEXT | 登録者名 |
| `status` | TEXT | 未対応／対応中／完了（既定: 未対応） |
| `created_at` | TEXT | UTC で保存。表示時に JST(+9h) へ変換 |

## 設計・実装計画ドキュメント

- 設計: `docs/superpowers/specs/2026-05-22-inquiry-management-demo-design.md`
- 実装計画: `docs/superpowers/plans/2026-05-22-inquiry-management-demo.md`
