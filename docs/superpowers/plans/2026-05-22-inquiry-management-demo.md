# 社内向け問い合わせ管理ツール（デモ）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 社員が問い合わせを登録し、担当者が一覧・詳細・ステータス更新を行える小規模な社内向けツールを、Cloudflare Workers へデプロイできる形で実装する。

**Architecture:** Vite + React Router v7（フレームワークモード）の単一コードベース。画面は `app/routes/`、サーバー処理は各ルートの loader/action、データは Cloudflare D1 に Drizzle ORM 経由でアクセス。権限はパス（`/` 社員、`/admin` 担当者）で分離し、フォームは Post/Redirect/Get で扱う。

**Tech Stack:** Vite, React Router v7, Cloudflare Workers + Vite plugin, Cloudflare D1, Drizzle ORM, Tailwind CSS v4 + shadcn/ui, Bun（ローカル）, Wrangler（デプロイ）, Vitest（純粋関数テスト）。

**設計ドキュメント:** `docs/superpowers/specs/2026-05-22-inquiry-management-demo-design.md`

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `wrangler.jsonc` | Workers 設定。D1 バインディングを追加（生成物を編集） |
| `react-router.config.ts` | React Router 設定（生成物） |
| `vite.config.ts` | Vite + Cloudflare プラグイン（生成物） |
| `vitest.config.ts` | 純粋関数のユニットテスト設定（新規） |
| `drizzle.config.ts` | drizzle-kit 設定（新規） |
| `worker-configuration.d.ts` | `wrangler types` で生成される `Env` 型（生成物） |
| `app/components/ui/*.tsx` | shadcn コンポーネント（`shadcn add` で生成） |
| `app/lib/utils.ts` | shadcn の `cn` ヘルパー（`shadcn init` で生成） |
| `app/lib/constants.ts` | カテゴリ／ステータスの固定値・Badge 色マップ（新規） |
| `app/lib/validation.ts` | `validateInquiry` / `isValidStatus` 純粋関数（新規） |
| `app/lib/validation.test.ts` | バリデーションのユニットテスト（新規） |
| `app/db/schema.ts` | Drizzle スキーマ `inquiries`（新規） |
| `app/db/client.ts` | `getDb(env)` Drizzle クライアント生成（新規） |
| `app/routes.ts` | ルート定義（生成物を編集） |
| `app/routes/home.tsx` | `/` 登録フォーム + action（新規） |
| `app/routes/thanks.tsx` | `/thanks` 受付完了画面（新規） |
| `app/routes/admin.tsx` | `/admin` 一覧 + ステータス絞り込み loader（新規） |
| `app/routes/admin-detail.tsx` | `/admin/:id` 詳細 + ステータス更新 action（新規） |
| `app/root.tsx` | ErrorBoundary（生成物を確認・調整） |
| `drizzle/migrations/*.sql` | `drizzle-kit generate` の出力 |
| `seed.sql` | 冪等なシードデータ（新規） |
| `package.json` | スクリプト追加（生成物を編集） |

### 設計上の判断（実装者向けメモ）
- **カテゴリ／ステータスの `<select>` は native select を使う**（shadcn の Select は Radix の制御コンポーネントで、`<Form method="post">` の素のフォーム送信に値を載せるには hidden input 等の追加配線が必要。デモでは native select を Tailwind で整形する方が堅牢で短い）。Button / Input / Textarea / Table / Badge / Card は shadcn を使う。**設計 §6 の「Select コンポーネント」はこの native select 置換を指す**（`shadcn add select` は行わない）。
- **`id` は `integer().primaryKey()`（AUTOINCREMENT なし）**。SQLite の rowid エイリアスで自動採番される。
- **D1 依存の loader/action は薄く保ち**、検証ロジックは `app/lib/validation.ts` の純粋関数に寄せてテストする。
- **action の成功時は `throw redirect(...)`**（`return` ではなく throw）。`useActionData<typeof action>()` の型が `{ errors } | undefined` に綺麗に収まる。
- **CSRF／セッション対策は対象外**（設計 §7 の通り、認証なし・社内・デモ用途のため YAGNI）。
- **権限のパス分離は「見立て」であり実アクセス制御ではない**（設計 §3 の通り、`/admin` は URL を知れば誰でも入れる。本番は認証が必要）。デモではこの割り切りを口頭で補足する。

---

## Task 1: プロジェクト scaffold（C3）

**Files:**
- Create: リポジトリ全体（`app/`, `workers/`, `wrangler.jsonc`, `vite.config.ts`, `react-router.config.ts`, `package.json`, `tsconfig.json` 等）

このリポジトリには `docs/` と `.git` が既にあるため、一時ディレクトリに scaffold してから中身を移す。

- [ ] **Step 1: C3 のバージョンを確認**

Run: `bunx create-cloudflare@latest --version`
Expected: 2.x の十分新しいバージョン（古いと react-router テンプレートの取得に失敗する既知問題があるため、`@latest` で最新を使う）。

- [ ] **Step 2: 一時ディレクトリに C3 で雛形生成**

```bash
cd /Users/fshindo/work
bun create cloudflare@latest mihia-inquiry-tmp --framework=react-router --lang ts --no-git --no-deploy
```

`--lang ts`（TypeScript）/ `--no-git` / `--no-deploy` を明示しているので対話はほぼ出ない。万一 react-router テンプレート取得に失敗する場合のフォールバック:

```bash
bun create cloudflare@latest mihia-inquiry-tmp -- --template=cloudflare/templates/react-router-starter-template
```

生成完了後 `mihia-inquiry-tmp/` に React Router v7 + Cloudflare Vite プラグイン + Tailwind v4 同梱の雛形ができる。

- [ ] **Step 3: 雛形をリポジトリへ移動（docs/ と .git は維持）**

```bash
rsync -a --exclude='.git' --exclude='node_modules' /Users/fshindo/work/mihia-inquiry-tmp/ /Users/fshindo/work/mihia-inquiry-demo/
rm -rf /Users/fshindo/work/mihia-inquiry-tmp
cd /Users/fshindo/work/mihia-inquiry-demo
bun install
```

- [ ] **Step 4: scaffold 生成物がプランの前提と一致するか照合**

以降のタスクは生成物の構造を前提とする。ここで現物を確認し、ズレがあれば該当タスクのコードを調整する。

Run: `git status` と以下の確認:
- `.gitignore` が来ていること（`node_modules` / `.wrangler` が ignore されている。来ていないと次の `git add -A` で巻き込む）
- `git status` に想定外の上書き（既存 `docs/` への影響、不要な `README.md` 上書き等）が無いこと
- `cat package.json` の `scripts` に `dev` / `build` / `deploy` / `typecheck` / `cf-typegen` があるか（無いものは後続タスクで補う）
- `cat tsconfig.json` で paths に `"~/*": ["./app/*"]` があること（shadcn / import エイリアスの前提）
- `app/`（`root.tsx` / `routes.ts` / `app.css`）と `workers/app.ts` が存在すること
- `workers/app.ts` で `context.cloudflare.env` を提供する loadContext 定義があること

ズレがあれば、本タスクのこの Step にメモを残し、該当タスク（型エイリアス＝Task2/4、context＝Task7以降）で調整する。

- [ ] **Step 5: dev サーバーが起動することを確認**

Run: `bun run dev`
Expected: Vite/Cloudflare の dev サーバーが起動し、表示された URL（例 `http://localhost:5173`）でデフォルト画面が表示される。確認できたら Ctrl-C で停止。

- [ ] **Step 6: 型チェックが通ることを確認**

Run: `bun run typecheck`（無ければ `bunx tsc --noEmit`）
Expected: エラーなしで完了。

- [ ] **Step 7: コミット**

`.gitignore` が来ていること（Step 4）を確認した上で:

```bash
git add -A
git commit -m "chore: scaffold React Router v7 + Cloudflare Workers project"
```

---

## Task 2: shadcn/ui の初期化とコンポーネント追加

**Files:**
- Create: `components.json`, `app/components/ui/*.tsx`
- Modify: `app/app.css`（shadcn が CSS 変数を追記）

- [ ] **Step 1: shadcn を初期化**

```bash
cd /Users/fshindo/work/mihia-inquiry-demo
bunx shadcn@latest init
```

プロンプトでは base color など既定のまま進める。React Router を自動検出し、エイリアス `~/*`（`~/components`, `~/lib/utils`）で `components.json` が作られる。

- [ ] **Step 2: 使用するコンポーネントを追加**

```bash
bunx shadcn@latest add button input textarea table badge card
```

Expected: `app/components/ui/` に `button.tsx` / `input.tsx` / `textarea.tsx` / `table.tsx` / `badge.tsx` / `card.tsx` と `app/lib/utils.ts` が生成される。

- [ ] **Step 3: dev サーバーで崩れがないことを確認**

Run: `bun run dev`
Expected: 起動し、既存画面が CSS エラーなく表示される。確認後 Ctrl-C。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "chore: init shadcn/ui and add base components"
```

---

## Task 3: Vitest セットアップ

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: テスト依存を追加**

```bash
bun add -D vitest vite-tsconfig-paths
```

- [ ] **Step 2: `vitest.config.ts` を作成**

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
});
```

`vite-tsconfig-paths` が `tsconfig.json` の `~/*` → `./app/*` を解決する。

- [ ] **Step 3: `package.json` に test スクリプトを追加**

`scripts` に以下を追記（`--passWithNoTests` を付けないと、テスト 0 件のとき vitest が exit code 1 になり失敗扱いになる）:

```json
"test": "vitest run --passWithNoTests"
```

- [ ] **Step 4: テストランナーが動くことを確認**

Run: `bun run test`
Expected: 「No test files found」だが `--passWithNoTests` により exit code 0 で正常終了（テスト未作成のため）。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "chore: set up vitest for unit tests"
```

---

## Task 4: 定数とバリデーション（TDD）

**Files:**
- Create: `app/lib/constants.ts`
- Create: `app/lib/validation.ts`
- Test: `app/lib/validation.test.ts`

- [ ] **Step 1: 定数ファイルを作成**

`app/lib/constants.ts`:

```typescript
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
```

- [ ] **Step 2: 失敗するテストを書く**

`app/lib/validation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { isValidStatus, validateInquiry } from "~/lib/validation";

describe("validateInquiry", () => {
  const valid = {
    subject: "PCが起動しない",
    body: "電源が入りません",
    category: "IT",
    reporterName: "山田太郎",
  };

  it("有効な入力を受け付ける", () => {
    const result = validateInquiry(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.category).toBe("IT");
  });

  it("必須項目（件名）が空ならエラーを返す", () => {
    const result = validateInquiry({ ...valid, subject: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.subject).toBeDefined();
  });

  it("許可外カテゴリを拒否する", () => {
    const result = validateInquiry({ ...valid, category: "経理" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.category).toBeDefined();
  });
});

describe("isValidStatus", () => {
  it("許可ステータスを通す", () => {
    expect(isValidStatus("対応中")).toBe(true);
  });
  it("許可外ステータスを弾く", () => {
    expect(isValidStatus("却下")).toBe(false);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `bun run test`
Expected: FAIL（`~/lib/validation` が存在しない / import エラー）。

- [ ] **Step 4: バリデーションを実装**

`app/lib/validation.ts`:

```typescript
import { CATEGORIES, STATUSES, type Category, type Status } from "~/lib/constants";

export type ValidatedInquiry = {
  subject: string;
  body: string;
  category: Category;
  reporterName: string;
};

export type ValidationResult =
  | { ok: true; value: ValidatedInquiry }
  | { ok: false; errors: Record<string, string> };

type RawInput = Partial<Record<keyof ValidatedInquiry, FormDataEntryValue | null>>;

export function validateInquiry(input: RawInput): ValidationResult {
  const errors: Record<string, string> = {};

  const subject = String(input.subject ?? "").trim();
  const body = String(input.body ?? "").trim();
  const category = String(input.category ?? "").trim();
  const reporterName = String(input.reporterName ?? "").trim();

  if (!subject) errors.subject = "件名を入力してください";
  if (!body) errors.body = "本文を入力してください";
  if (!reporterName) errors.reporterName = "登録者名を入力してください";
  if (!CATEGORIES.includes(category as Category)) {
    errors.category = "カテゴリを選択してください";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { subject, body, category: category as Category, reporterName },
  };
}

export function isValidStatus(value: unknown): value is Status {
  return typeof value === "string" && STATUSES.includes(value as Status);
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `bun run test`
Expected: PASS（5件）。

- [ ] **Step 6: コミット**

```bash
git add app/lib/constants.ts app/lib/validation.ts app/lib/validation.test.ts
git commit -m "feat: add inquiry validation with whitelist checks"
```

---

## Task 5: D1 + Drizzle スキーマ・クライアント設定

**Files:**
- Create: `app/db/schema.ts`, `app/db/client.ts`, `drizzle.config.ts`
- Modify: `wrangler.jsonc`, `package.json`

- [ ] **Step 1: Drizzle 依存を追加**

```bash
bun add drizzle-orm
bun add -D drizzle-kit
```

- [ ] **Step 2: スキーマを作成**

`app/db/schema.ts`:

```typescript
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { CATEGORIES, STATUSES } from "~/lib/constants";

const categoryList = CATEGORIES.map((c) => `'${c}'`).join(", ");
const statusList = STATUSES.map((s) => `'${s}'`).join(", ");

export const inquiries = sqliteTable(
  "inquiries",
  {
    id: integer("id").primaryKey(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // { enum } で型を Category/Status の union に締める（$inferSelect.status が Status になり
    // 一覧/詳細でのキャストが不要になる）。enum は型のみでランタイム検証はしないため、
    // 下の check() 制約と action 側 validateInquiry の二重ガードは引き続き必要。
    category: text("category", { enum: CATEGORIES }).notNull(),
    reporterName: text("reporter_name").notNull(),
    status: text("status", { enum: STATUSES }).notNull().default("未対応"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    check("category_check", sql`${table.category} IN (${sql.raw(categoryList)})`),
    check("status_check", sql`${table.status} IN (${sql.raw(statusList)})`),
  ],
);

export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
```

- [ ] **Step 3: Drizzle クライアントを作成**

`app/db/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "~/db/schema";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}
```

`Env` は Step 7 の `wrangler types` で生成される global 型。**Step 3〜6 の間は `Env`/`env.DB` が未生成で型エラーが残る**（Step 5 で `wrangler.jsonc` に D1 を追加 → Step 7 の `cf-typegen` で解消する順序）。この区間で `tsc` を走らせない。

- [ ] **Step 4: drizzle.config.ts を作成**

`drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
});
```

`out` は Step 5 の `wrangler.jsonc` の `migrations_dir` と一致させること。

- [ ] **Step 5: D1 を作成し wrangler.jsonc に設定**

```bash
wrangler d1 create mihia-inquiry
```

出力に含まれる `database_id`（UUID）を控える。`wrangler.jsonc` のトップレベルに以下を追記（既に `d1_databases` があれば値を合わせる）:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "mihia-inquiry",
    "database_id": "ここに wrangler d1 create の出力 UUID を貼る",
    "migrations_dir": "drizzle/migrations"
  }
]
```

- [ ] **Step 6: db スクリプトを package.json に追加**

`scripts` に追記:

```json
"cf-typegen": "wrangler types",
"db:generate": "drizzle-kit generate",
"db:migrate": "wrangler d1 migrations apply mihia-inquiry --local",
"db:migrate:prod": "wrangler d1 migrations apply mihia-inquiry --remote",
"db:seed": "wrangler d1 execute mihia-inquiry --local --file=./seed.sql"
```

- [ ] **Step 7: 型を生成して `env.DB` を型付け**

Run: `bun run cf-typegen`
Expected: `worker-configuration.d.ts` が更新され、`Env` に `DB: D1Database` が含まれる。続けて `bunx tsc --noEmit` で `app/db/client.ts` が型エラーにならないことを確認。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add D1 binding, drizzle schema and client"
```

---

## Task 6: マイグレーション生成・適用・シード

**Files:**
- Create: `drizzle/migrations/*.sql`（生成）, `seed.sql`

- [ ] **Step 1: マイグレーション SQL を生成**

Run: `bun run db:generate`
Expected: `drizzle/migrations/` に `0000_*.sql`（`inquiries` テーブルの CREATE 文と CHECK 制約を含む）と、`drizzle/migrations/meta/`（`_journal.json` / `0000_snapshot.json`）が生成される。中身を開き、`CHECK (category IN ('総務', 'IT', '人事'))` 等が含まれることを確認。

補足:
- `wrangler d1 migrations apply` は `migrations_dir` 直下の `.sql` のみを連番順に適用し、`meta/` サブフォルダは無視する（両者は共存して問題なし）。
- マイグレーションの prefix はデフォルト（`index` = `0000_`連番）のままにする。`drizzle.config.ts` で `timestamp` 等に変えると wrangler の連番適用前提と齟齬が出る。
- `meta/` 配下もコミット対象に含める（Step 5 の `git add drizzle/migrations` でOK）。

- [ ] **Step 2: ローカル D1 に適用**

Run: `bun run db:migrate`
Expected: ローカル D1 にマイグレーションが適用され成功メッセージが出る。

- [ ] **Step 3: seed.sql を作成**

`seed.sql`（先頭で全削除 → 固定 ID で挿入し冪等に）:

```sql
DELETE FROM inquiries;
INSERT INTO inquiries (id, subject, body, category, reporter_name, status, created_at) VALUES
  (1, 'PCが起動しない', '朝から電源が入りません。確認をお願いします。', 'IT', '山田太郎', '未対応', '2026-05-20 09:00:00'),
  (2, '経費精算の方法を教えてほしい', '交通費の申請手順が分かりません。', '総務', '佐藤花子', '対応中', '2026-05-20 10:30:00'),
  (3, '有給休暇の残日数を確認したい', '今年度の残日数を教えてください。', '人事', '鈴木一郎', '完了', '2026-05-19 14:00:00'),
  (4, 'プリンタが紙詰まりする', '3階の複合機が頻繁に詰まります。', '総務', '田中美咲', '未対応', '2026-05-21 11:15:00');
```

- [ ] **Step 4: シードを投入**

Run: `bun run db:seed`
Expected: 4件挿入の成功メッセージ。再実行しても `DELETE` により同じ4件に戻る（冪等）。

- [ ] **Step 5: コミット**

```bash
git add drizzle/migrations seed.sql
git commit -m "feat: add initial migration and idempotent seed data"
```

---

## Task 7: ルート定義と登録画面 `/`

**Files:**
- Modify: `app/routes.ts`
- Create: `app/routes/home.tsx`

> **重要（順序）:** `routes.ts` には「その時点で実在するルートだけ」を登録する。未作成ルートを参照すると型生成・dev・typecheck が全滅するため、各ルートタスク（Task 8〜10）で対応する `route(...)` を1行ずつ追記していく。これで各タスク末尾は常にビルドが通る。

- [ ] **Step 1: ルート定義を home のみで書く**

`app/routes.ts`（既存内容を置き換え。この時点では home だけ参照）:

```typescript
import { type RouteConfig, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
] satisfies RouteConfig;
```

- [ ] **Step 2: 登録画面と action を作成**

`app/routes/home.tsx`:

```tsx
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
              <label htmlFor="subject" className="mb-1 block text-sm font-medium">件名</label>
              <Input id="subject" name="subject" />
              {errors.subject && (
                <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
              )}
            </div>
            <div>
              <label htmlFor="body" className="mb-1 block text-sm font-medium">本文</label>
              <Textarea id="body" name="body" rows={5} />
              {errors.body && (
                <p className="mt-1 text-sm text-red-600">{errors.body}</p>
              )}
            </div>
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium">カテゴリ</label>
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
              <label htmlFor="reporterName" className="mb-1 block text-sm font-medium">登録者名</label>
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
```

- [ ] **Step 3: コミット**

```bash
git add app/routes.ts app/routes/home.tsx
git commit -m "feat: add inquiry registration route"
```

---

## Task 8: 受付完了画面 `/thanks`

**Files:**
- Modify: `app/routes.ts`
- Create: `app/routes/thanks.tsx`

- [ ] **Step 1: `routes.ts` に thanks を追記**

`app/routes.ts`（`route` を import に追加し、配列に1行追記）:

```typescript
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("thanks", "routes/thanks.tsx"),
] satisfies RouteConfig;
```

- [ ] **Step 2: 完了画面を作成**

`app/routes/thanks.tsx`:

```tsx
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
```

- [ ] **Step 3: 登録〜完了の流れを確認**

Run: `bun run dev`
手順: `/` で全項目を入力して送信 → `/thanks` に遷移する。空のまま送信するとエラーメッセージが表示される。許可外カテゴリは select に無いので選べない。確認後 Ctrl-C。

- [ ] **Step 4: コミット**

```bash
git add app/routes.ts app/routes/thanks.tsx
git commit -m "feat: add submission complete screen"
```

---

## Task 9: 問い合わせ一覧 `/admin`

**Files:**
- Modify: `app/routes.ts`
- Create: `app/routes/admin.tsx`

- [ ] **Step 1: `routes.ts` に admin を追記**

`app/routes.ts` の配列に1行追記:

```typescript
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("thanks", "routes/thanks.tsx"),
  route("admin", "routes/admin.tsx"),
] satisfies RouteConfig;
```

- [ ] **Step 2: 一覧画面と loader を作成**

`app/routes/admin.tsx`:

```tsx
import { Form, Link, useLoaderData, useSearchParams } from "react-router";
import { desc, eq } from "drizzle-orm";
import type { Route } from "./+types/admin";
import { getDb } from "~/db/client";
import { inquiries } from "~/db/schema";
import { isValidStatus } from "~/lib/validation";
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
        <label htmlFor="status-filter" className="text-sm">ステータス絞り込み:</label>
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
                  <Badge className={STATUS_BADGE_CLASS[row.status]}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>{row.createdAt}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </main>
  );
}
```

- [ ] **Step 3: 一覧表示と絞り込みを確認**

Run: `bun run dev`
手順: `/admin` でシードの4件が表示される。ステータスで絞り込むと URL に `?status=...` が付き、該当行のみ表示される。Badge が色分けされる。確認後 Ctrl-C。

- [ ] **Step 4: コミット**

```bash
git add app/routes.ts app/routes/admin.tsx
git commit -m "feat: add admin inquiry list with status filter"
```

---

## Task 10: 詳細とステータス更新 `/admin/:id`

**Files:**
- Modify: `app/routes.ts`
- Create: `app/routes/admin-detail.tsx`

- [ ] **Step 1: `routes.ts` に admin/:id を追記**

`app/routes.ts` の配列に1行追記（これで4ルートすべて登録される）:

```typescript
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("thanks", "routes/thanks.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/:id", "routes/admin-detail.tsx"),
] satisfies RouteConfig;
```

- [ ] **Step 2: 詳細画面・loader・更新 action を作成**

`app/routes/admin-detail.tsx`:

```tsx
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
            <Badge className={STATUS_BADGE_CLASS[row.status]}>
              {row.status}
            </Badge>
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
            <label htmlFor="status" className="text-sm font-medium">ステータス変更:</label>
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
```

- [ ] **Step 3: 詳細表示・更新・404 を確認**

Run: `bun run dev`
手順: 一覧から件名をクリック → 詳細表示。ステータスを変更して「更新」→ 同じ詳細が更新後の状態で再表示され、一覧の Badge も変わる。存在しない ID（例 `/admin/9999`）で 404 になる。確認後 Ctrl-C。

- [ ] **Step 4: コミット**

```bash
git add app/routes.ts app/routes/admin-detail.tsx
git commit -m "feat: add inquiry detail and status update"
```

---

## Task 11: ErrorBoundary の確認・調整

**Files:**
- Modify: `app/root.tsx`

- [ ] **Step 1: 生成済み ErrorBoundary を Read して現コードを把握**

Run: `app/root.tsx` を Read する。
C3 テンプレートは末尾に `export function ErrorBoundary({ error })` を持ち、`isRouteErrorResponse(error)` で 404 とその他（500 等）を出し分け、`message` / `details`（変数名はテンプレ準拠）を組み立てて表示する。**この Step で 404 分岐の実際のコードブロックを引用しておく**（次の Edit の `old_string` にするため）。

- [ ] **Step 2: 引用したブロックを old_string にして文言だけ日本語化**

Step 1 で引用した `isRouteErrorResponse(error)` 分岐を、変数名はそのままに文言だけ日本語へ Edit する。テンプレが下記の典型形なら、これをそのまま置換:

```tsx
// before（テンプレの典型形。実物に合わせて old_string を取る）
if (isRouteErrorResponse(error)) {
  message = error.status === 404 ? "404" : "Error";
  details =
    error.status === 404
      ? "The requested page could not be found."
      : error.statusText || details;
}

// after
if (isRouteErrorResponse(error)) {
  message = error.status === 404 ? "404" : "エラー";
  details =
    error.status === 404
      ? "指定された問い合わせが見つかりませんでした。"
      : error.statusText || details;
}
```

実物の変数名・構造が異なる場合は、Step 1 で読んだ実コードを `old_string` にして「文言のみ」を差し替えること（構造は変えない）。

- [ ] **Step 3: 404 と 500 の表示を確認**

Run: `bun run dev`
手順:
- `/admin/9999` で日本語の 404 メッセージが表示される（`throw data(..., { status: 404 })` 経路）。
- 非 404 のエラー（500 系）も同じ ErrorBoundary に落ち、`else` 分岐の汎用メッセージが出ることをコード上で確認（D1 障害の意図的再現は不要。`isRouteErrorResponse` が false のときの分岐が存在することを目視確認すれば足りる）。
確認後 Ctrl-C。

- [ ] **Step 4: コミット**

```bash
git add app/root.tsx
git commit -m "feat: localize 404 message in error boundary"
```

---

## Task 12: 全体の通し確認（ローカル）

**Files:** なし（検証のみ）

- [ ] **Step 1: クリーンな状態から通す**

```bash
bun install
bun run db:migrate
bun run db:seed
bun run test
```

Expected: マイグレーション成功、シード4件、テスト全 PASS。

- [ ] **Step 2: 型チェック**

Run: `bunx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: dev で 6 論点を一通り確認**

Run: `bun run dev`
チェックリスト:
- 画面: `/`（登録）・`/admin`（一覧）・`/admin/:id`（詳細）が表示される
- データ: 登録した内容が一覧・詳細に反映される
- ステータス: 詳細で変更 → 一覧 Badge が更新される
- 権限: `/` は登録のみ、`/admin` は一覧/更新（パス分離）
- バリデーション: 空送信でエラー、許可外カテゴリ/ステータスは入らない
- 404: 不正 ID で 404

確認後 Ctrl-C。

- [ ] **Step 4: コミット（必要なら微修正のみ）**

```bash
git add -A
git commit -m "chore: local end-to-end verification" --allow-empty
```

---

## Task 13: 本番デプロイ（Cloudflare Workers）

**Files:** なし（デプロイ操作）

> このタスクは Cloudflare アカウントの認証が必要。`wrangler login` 済みであること。デモ当日に実演する場合はここを見せる。

- [ ] **Step 1: 本番 D1 にマイグレーション適用**

Run: `bun run db:migrate:prod`
Expected: リモート（本番）D1 にマイグレーションが適用される。

- [ ] **Step 2: （任意）本番にシード投入**

```bash
wrangler d1 execute mihia-inquiry --remote --file=./seed.sql
```

Expected: 本番 D1 に4件投入。デモ用に初期データを見せたい場合のみ実行。

- [ ] **Step 3: デプロイ**

Run: `bun run deploy`
Expected: `*.workers.dev` の URL が出力される。
注意: react-router テンプレートの `deploy` スクリプトは `react-router build && wrangler deploy` のようにビルドを含む。`deploy` スクリプトが無い場合は素の `wrangler deploy` だけだとビルド成果物が無いので、`bun run build && wrangler deploy` を実行すること。

- [ ] **Step 4: 本番動作確認**

出力 URL を開き、`/` と `/admin` が表示され、登録・一覧・ステータス更新が動くことを確認する。

- [ ] **Step 5: コミット（設定変更があれば）**

```bash
git add -A
git commit -m "chore: production deploy configuration" --allow-empty
```

---

## 完了の定義
- `bun run test` が全 PASS、`bunx tsc --noEmit` がエラーなし。
- ローカルで登録 → 一覧 → 詳細 → ステータス更新 → 404 が一通り動作。
- `wrangler deploy` で本番 URL が払い出され、同じ操作が本番でも動作。
