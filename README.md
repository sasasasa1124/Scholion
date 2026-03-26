# Quiz

**CSV を置くだけで動く、AI 搭載の資格試験練習アプリ。**

スペースド・リピティション（SM-2）で効率よく記憶を定着させ、AI が解説・ファクトチェック・スタディガイドを生成する。管理者は問題の追加・編集・翻訳をブラウザ上で完結できる。

---

## 設計思想

> "Understand deeply, not just pass."

**シンプルに、速く、深く。** 画面遷移を減らし、キーボードだけで完結する操作性を追求した。アニメーションやモーダルを最小限に抑え、問題と向き合う時間を最大化する。

AI は「答えを教える道具」ではなく「理解を深める道具」として使う。解説・ファクトチェック・スタディガイドはすべてオプション機能であり、まず自分で考えることを促す UI になっている。

---

## 機能

### 学習モード

| モード | 説明 |
|--------|------|
| **Quiz** | 回答 → 正誤確認 → Know / Don't Know を評価してスペースド・リピティションに反映 |
| **Review** | 問題と解答・解説をフラッシュカード形式で確認 |
| **Mock Exam** | 制限時間付きの模擬試験。終了後にスコアを表示 |
| **Answers** | 全問題の解答・解説をカテゴリ別に一覧表示 |
| **Study Guide** | AI がカテゴリ別の重要ポイント・落とし穴・学習アドバイスを Markdown でまとめる |

### スマートフィルター

出題範囲を細かく絞り込める。複数条件の組み合わせが可能。

- 未回答のみ
- SM-2 復習期日が到来した問題
- 正答率 N% 以下
- 直近 N 日間で解いていない問題
- 前回の続きから再開

### スペースド・リピティション（SM-2）

「Know」「Don't Know」の評価で次回復習日を自動計算。記憶が薄れるタイミングで復習問題が浮上する。

### AI 機能（Google Gemini）

| 機能 | 説明 |
|------|------|
| **解説生成** | 選択肢ごとの正誤理由・公式ソース URL 付きで解説を生成。重要フレーズをハイライト |
| **ファクトチェック** | 記録されている正解を公式ドキュメントで検証。誤りがあれば修正案を提示 |
| **Refine** | 問題文の誤字・表現を修正し、判断に重要なワードを太字でマーク |
| **スタディガイド** | 試験全体のカテゴリ別重要概念・頻出パターン・落とし穴を網羅したガイドを生成 |
| **AI チャット** | 問題について自由に深掘りできる会話アシスタント |
| **音声読み上げ（TTS）** | 問題と選択肢を読み上げ。速度・先読みチャンク数を設定可能 |

AI プロンプトはユーザーが自由にカスタマイズ・バージョン管理できる。

### 管理者機能

`ADMIN_EMAILS` で指定したユーザーのみアクセス可能。

- 試験・問題の作成 / 編集 / 削除
- CSV インポートで問題を一括登録
- AI による答え・解説・カテゴリの自動補完（Fill）
- 問題の自動翻訳（多言語対応）
- 改善提案（Suggestion）の管理・採用

---

## 技術スタック

```
Next.js 15 (App Router)   — フレームワーク
React 19                  — UI ランタイム
TypeScript                — 言語
Tailwind CSS v4           — スタイリング
Drizzle ORM               — データベース ORM
Cloudflare D1 (SQLite)    — データベース（本番）
Clerk                     — 認証
Google Gemini API         — AI 機能
Cloudflare Pages + Workers — ホスティング（エッジ）
```

外部 UI ライブラリは使用しない。アイコンは Lucide React のみ。

---

## ローカル開発

### セットアップ

```bash
cd quiz
npm install

# ローカル D1 DB を作成してマイグレーション適用
npm run cf:setup
npm run db:migrate:local

# CSV から問題をインポート（../  以下の *.csv を読み込む）
npm run db:seed:local

# 開発サーバー起動
npm run dev
```

### 環境変数（`.env.local`）

```bash
DEPLOY_TARGET=local

# 認証（Clerk）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# AI
GEMINI_API_KEY=AIza...

# 管理者（カンマ区切り）
ADMIN_EMAILS=you@example.com

# フィードバック（GitHub Issue 自動作成）
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo

NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### コマンド

```bash
npm run dev                # 開発サーバー（Turbopack）
npm run build              # プロダクションビルド
npm start                  # プロダクションサーバー

npm run db:migrate:local   # ローカル DB にマイグレーション適用
npm run db:seed:local      # ローカル DB に CSV を投入
npm run db:migrate         # 本番 D1 にマイグレーション適用

npm run build:cf           # Cloudflare Pages 向けビルド
```

---

## 問題データの追加

CSV ファイルをリポジトリルート（`quiz/` の親）に置くだけで試験が追加される。管理画面からのインポートも可能。

### CSV フォーマット

```
id, question, optionA, optionB, optionC, optionD, optionE, answer, explanation, source
```

---

## デプロイ

**Cloudflare Pages**（現行）と **GCP Cloud Run** の両方に対応。

### デプロイブランチ戦略

```
main ──────────────────────────────► 開発の source of truth
  │
  ├─ git push origin main:deploy/cloudflare ──► Cloudflare Pages
  └─ git push origin main:deploy/gcp         ──► GCP Cloud Run
```

各 `deploy/*` ブランチへの push が GitHub Actions を起動し、対応プラットフォームへ自動デプロイする。前回デプロイからの差分は Actions ログで確認できる。

GCP 移行の詳細（必要リソース・コード変更・CLI 手順）は **[GCP-Project.md](./GCP-Project.md)** を参照。

---

## ルート一覧

```
/                              試験一覧・モード選択
/quiz/[exam]?mode=&filter=     クイズ画面（quiz / review / mock / answers / study-guide）
/exam/[id]                     試験詳細・回答履歴
/profile                       進捗グラフ・セッション履歴
/settings                      AI プロンプト・音声・表示設定
```

---

## ライセンス

Private repository.
