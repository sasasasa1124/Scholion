# GCP Migration Guide

Cloudflare（Pages + Workers + D1）から GCP へ移行するための設計ドキュメント。

---

## 現在の Cloudflare 構成

| 役割 | サービス |
|------|---------|
| ホスティング | Cloudflare Pages |
| API / SSR ランタイム | Cloudflare Workers（edge runtime） |
| データベース | Cloudflare D1（SQLite） |
| シークレット管理 | Cloudflare Pages 環境変数 |
| CI/CD | GitHub Actions → `wrangler pages deploy` |

**移行後も継続利用するもの**: Clerk（認証）、Google Gemini API（AI機能）

---

## GCP リソース一覧

| GCP リソース | 代替する CF サービス | 用途 |
|------------|-------------------|------|
| **Cloud Run** | Pages + Workers | Next.js アプリホスティング（SSR + API） |
| **Cloud SQL (PostgreSQL 16)** | D1（SQLite） | データベース |
| **Artifact Registry** | — | Docker イメージ保管 |
| **Secret Manager** | Pages 環境変数 | API キー・DB 認証情報 |
| **Cloud Load Balancing** | Cloudflare Proxy | HTTPS 終端・カスタムドメイン |
| **Cloud CDN** | Cloudflare CDN | 静的アセットキャッシュ |
| **Workload Identity Federation** | — | GitHub Actions → GCP keyless 認証 |
| **Cloud DNS**（任意） | Cloudflare DNS | DNS 管理 |

---

## デプロイブランチ戦略

Cloudflare と GCP の両方に対応できるよう、デプロイ先ごとにブランチを分ける。

```
main ──────────────────────────────► 開発の source of truth（直接デプロイしない）
  │
  ├─ git push origin main:deploy/cloudflare ──► CF デプロイワークフロー起動
  └─ git push origin main:deploy/gcp         ──► GCP デプロイワークフロー起動
```

`deploy/cloudflare` / `deploy/gcp` ブランチは「最後にデプロイした main の snapshot」として機能する。
ワークフロー内で `git log origin/deploy/cloudflare..HEAD` を取れば前回デプロイからの差分が自動的に得られる。

### デプロイ操作

```bash
# Cloudflare にデプロイ
git push origin main:deploy/cloudflare

# GCP にデプロイ
git push origin main:deploy/gcp

# 両方同時
git push origin main:deploy/cloudflare main:deploy/gcp
```

### ワークフローファイル構成

```
.github/workflows/
├── deploy-cloudflare.yml   # deploy/cloudflare ブランチへの push でトリガー
└── deploy-gcp.yml          # deploy/gcp ブランチへの push でトリガー
```

---

## CI/CD — Cloudflare（`deploy-cloudflare.yml`）

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [deploy/cloudflare]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Show diff from previous deployment
        run: git log origin/deploy/cloudflare..HEAD --oneline || true

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Build for Cloudflare Pages
        run: npm run build:cf
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}

      - name: Deploy to Cloudflare Pages
        run: npx wrangler pages deploy .vercel/output/static --project-name quiz --branch main
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

必要な GitHub Secrets:

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
GEMINI_API_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

---

## CI/CD — GCP（`deploy-gcp.yml`）

```yaml
name: Deploy to GCP Cloud Run

on:
  push:
    branches: [deploy/gcp]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Show diff from previous deployment
        run: git log origin/deploy/gcp..HEAD --oneline || true

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Build and push Docker image
        run: |
          IMAGE=asia-northeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/quiz-app/quiz:${{ github.sha }}
          gcloud builds submit --tag $IMAGE .

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy quiz \
            --image asia-northeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/quiz-app/quiz:${{ github.sha }} \
            --region asia-northeast1 \
            --platform managed \
            --allow-unauthenticated \
            --set-secrets=CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest \
            --set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest \
            --set-secrets=DATABASE_URL=DATABASE_URL:latest \
            --set-secrets=ADMIN_EMAILS=ADMIN_EMAILS:latest \
            --set-secrets=GITHUB_TOKEN=GITHUB_TOKEN:latest \
            --set-secrets=GITHUB_OWNER=GITHUB_OWNER:latest \
            --set-secrets=GITHUB_REPO=GITHUB_REPO:latest
```

必要な GitHub Secrets:

```
WIF_PROVIDER
WIF_SA
GCP_PROJECT_ID
GEMINI_API_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

---

## 必要なコード変更

### 1. `lib/db.ts` — D1 → PostgreSQL

**変更前**:
```typescript
import { getRequestContext } from "@cloudflare/next-on-pages";
import { drizzle } from "drizzle-orm/d1";

function getDrizzle() {
  const d1 = getRequestContext().env.DB;
  return drizzle(d1, { schema });
}
```

**変更後**:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

追加パッケージ: `npm install postgres`

### 2. `lib/env.ts` — Workers env → `process.env`

`getRequestContext()` を削除し `process.env[key]` に統一する。Cloud Run では環境変数が `process.env` に直接注入される。

### 3. 全 API ルート（32 本）— `runtime = "edge"` 削除

```bash
grep -rl 'runtime = "edge"' app/api/
```

全ファイルから `export const runtime = "edge"` を削除する（Node.js ランタイムがデフォルト）。

### 4. `next.config.ts` — webpack fallback 削除

```typescript
// このブロックを削除
webpack(config) {
  config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
  return config;
}
```

### 5. `drizzle.config.ts` — D1 ドライバ → PostgreSQL

```typescript
export default {
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  schema: "./lib/schema.ts",
  out: "./migrations",
} satisfies Config;
```

### 6. `wrangler.jsonc` — 廃止

GCP では不要なため削除する。

### 7. `Dockerfile` を追加

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
```

---

## CLI によるインフラ構築手順

**手動 UI が必要なのは課金設定のみ。**

### 1. プロジェクト初期設定

```bash
gcloud projects create quiz-app-prod
gcloud config set project quiz-app-prod

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

### 2. Artifact Registry

```bash
gcloud artifacts repositories create quiz-app \
  --repository-format=docker \
  --location=asia-northeast1
```

### 3. Cloud SQL (PostgreSQL)

```bash
gcloud sql instances create quiz-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-northeast1

gcloud sql databases create quiz --instance=quiz-db
gcloud sql users create app --instance=quiz-db --password=<password>
```

### 4. Secret Manager

```bash
echo -n "sk_live_xxx"  | gcloud secrets create CLERK_SECRET_KEY --data-file=-
echo -n "pk_live_xxx"  | gcloud secrets create NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --data-file=-
echo -n "AIza..."      | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "postgres://app:<password>@<host>/quiz" | gcloud secrets create DATABASE_URL --data-file=-
echo -n "admin@example.com" | gcloud secrets create ADMIN_EMAILS --data-file=-
echo -n "ghp_..."      | gcloud secrets create GITHUB_TOKEN --data-file=-
echo -n "your-org"     | gcloud secrets create GITHUB_OWNER --data-file=-
echo -n "your-repo"    | gcloud secrets create GITHUB_REPO --data-file=-
```

> `NEXT_PUBLIC_*` 変数はビルド時に埋め込まれる。GitHub Secrets にも追加し、ビルドステップで `env:` として渡すこと。

### 5. Workload Identity Federation

```bash
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"

gcloud iam service-accounts add-iam-policy-binding \
  github-sa@quiz-app-prod.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/OWNER/REPO" \
  --role=roles/iam.workloadIdentityUser
```

### 6. 初回デプロイ

```bash
gcloud builds submit \
  --tag asia-northeast1-docker.pkg.dev/quiz-app-prod/quiz-app/quiz:latest .

gcloud run deploy quiz \
  --image asia-northeast1-docker.pkg.dev/quiz-app-prod/quiz-app/quiz:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated
```

### 7. D1 → Cloud SQL データ移行

```bash
npx wrangler d1 export quiz-db --output=quiz-db-dump.sql
# PostgreSQL 用に SQL 方言を手動修正後
psql $DATABASE_URL < quiz-db-dump.sql
npm run db:migrate
```

---

## 環境変数一覧

### Cloud Run ランタイム変数（Secret Manager 経由）

| 変数名 | 説明 |
|--------|------|
| `CLERK_SECRET_KEY` | Clerk 認証シークレット |
| `GEMINI_API_KEY` | Google Gemini API キー |
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `ADMIN_EMAILS` | 管理者メールアドレス（カンマ区切り） |
| `GITHUB_TOKEN` | フィードバック Issue 投稿用 GitHub トークン |
| `GITHUB_OWNER` | Issue 投稿先リポジトリオーナー |
| `GITHUB_REPO` | Issue 投稿先リポジトリ名 |

### ビルド時変数（GitHub Secrets）

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 公開キー（ビルド時埋め込み必須） |
| `NEXT_PUBLIC_BASE_URL` | アプリの公開 URL |

### ローカル開発専用

| 変数名 | 説明 |
|--------|------|
| `DEPLOY_TARGET=local` | `/api/local-exams` を有効化するフラグ |

---

## 移行時の注意点

### SQLite → PostgreSQL の非互換

| SQLite | PostgreSQL |
|--------|-----------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `BOOLEAN` は 0/1 | ネイティブ `BOOLEAN` |
| JSON を `TEXT` で保管 | `JSONB` を推奨 |
| 識別子は大文字小文字不問 | 小文字に正規化される |

17 本のマイグレーションファイル（`migrations/`）を PostgreSQL 方言で再生成する必要がある。

### CSV ファイルの扱い

1. **不要化**（推奨）: D1 への import 完了済みのため `/api/local-exams` を dev 専用のまま無効化
2. **コンテナに含める**: Dockerfile で `COPY ../*.csv ./` を追加
3. **Cloud Storage**: CSV を GCS に置き import 時にダウンロード

### コールドスタート対策

```bash
gcloud run services update quiz --min-instances=1 --region=asia-northeast1
```

---

## コスト概算（月額）

| リソース | 概算 |
|---------|------|
| Cloud Run（最小 1 インスタンス） | $10–20 |
| Cloud SQL db-f1-micro | $7–10 |
| Artifact Registry | ~$0.10 |
| Secret Manager | ~$0 |
| Cloud CDN | トラフィック次第 |
| **合計** | **~$20–35/月** |

> Cloudflare Pages + D1 は現在ほぼ無料枠で運用しているため、移行後はコストが増加する。
