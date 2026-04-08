# TASK.md

## 機能要件: バッチジョブシステム修正

### 背景・要件
管理画面の Fill / Wording Fix (Refine) / Fact Check 機能が AWS・Cloudflare 両環境で動作しない。
ユーザーがボタンを押すと POST エンドポイントが 500 を返し、ジョブが作成できない。

**期待する動作:**
1. POST `/api/admin/exams/{id}/refine|fill|factcheck` → 200 `{ jobId: "job_..." }` を返す
2. バックグラウンドでジョブ処理が開始される
3. GET `/api/admin/exams/{id}/batch-status?latest=refine` → 200 でジョブ状態を返す
4. ジョブが完了または失敗したら UI に反映される
5. ゾンビジョブ（60分以上 pending/running のまま）は自動クリーンされる

**環境:**
- AWS App Runner: https://bngmzhtypy.us-west-2.awsapprunner.com
  - DB: PostgreSQL (RDS)、`DATABASE_URL` 環境変数
  - バックグラウンド処理: Node.js の unawaited async
- Cloudflare Pages: https://quiz-aad.pages.dev/
  - DB: D1 (SQLite)
  - バックグラウンド処理: `ctx.waitUntil()` via `getRequestContext()`

---

## 根本原因

### AWS (PostgreSQL)
- `batch_jobs` テーブルが存在しない
- `scripts/migrate-pg.js` が `ALTER TABLE ... ADD COLUMN` の重複エラー(42701) で例外をスローし中断
- `0021_batch_jobs.sql` に到達する前にプロセスが終了している
- CloudWatch ログで確認済み: `"relation batch_jobs does not exist"`

### Cloudflare (D1)
- D1 に migration 0021 が未適用
- `wrangler d1 execute --remote` がプロキシエラーで失敗していた
- `createBatchJob()` が `batch_jobs` テーブルへの INSERT で失敗し 500

---

## 実装 Todo

### ブランチ: `fix/migrate-pg-idempotent` (現在のブランチ)

#### AWS 修正
- [x] `scripts/migrate-pg.js` — ステートメント単位の try-catch 追加
  - PostgreSQL エラーコード 42701(duplicate_column)、42P07(duplicate_table)、42710(duplicate_object) をスキップ
  - これにより全ての SQL ファイルを最後まで実行し `0021_batch_jobs.sql` に到達する
  - **未コミット** — git diff HEAD で変更確認済み

#### CF 修正
- [ ] `lib/batch-job.ts` — `createBatchJob()` 冒頭に D1 用テーブル自動作成追加
  - `!isPg()` の場合のみ実行（CF/D1 環境のみ）
  - `CREATE TABLE IF NOT EXISTS batch_jobs (...)` — 完全なスキーマを定義
  - `CREATE INDEX IF NOT EXISTS idx_batch_jobs_exam_id ON batch_jobs(exam_id)`
  - モジュールレベルの `let d1TableEnsured = false` フラグでガード（毎回 DDL 実行を防ぐ）
  - D1 Migration の wrangler 手動実行が不要になる安全ネット

#### 共通
- [ ] `TASK.md` 更新 (本ファイル)

#### コミット・デプロイ
- [ ] `git add scripts/migrate-pg.js lib/batch-job.ts TASK.md`
- [ ] `git commit -m "fix: make batch_jobs table creation idempotent on AWS and CF"` (※ ASCII のみ)
- [ ] `git checkout main && git merge fix/migrate-pg-idempotent`
- [ ] `git push origin main deploy/aws` → AWS App Runner 再デプロイトリガー
- [ ] `git push origin main deploy/cloudflare` → CF Pages 再デプロイトリガー

---

## テスト・検証

### AWS 検証
CloudWatch Logs で起動ログを確認:
```
[migrate]   skipped (already applied): column "refined_at" of relation "questions" already exists
[migrate] 0021_batch_jobs.sql done
[migrate] All migrations applied successfully
```

### API スモークテスト (両環境)
```bash
# AWS
BASE=https://bngmzhtypy.us-west-2.awsapprunner.com
EXAM_ID=experience_cloud_consultant_exam_en

# CF
BASE=https://quiz-aad.pages.dev
EXAM_ID=experience_cloud_consultant_exam_en

# テスト1: ジョブ作成 → 200 + jobId
curl -X POST $BASE/api/admin/exams/$EXAM_ID/refine \
  -H "Content-Type: application/json" -d '{}'

# テスト2: ステータス確認 → 200 (null or job object)
curl "$BASE/api/admin/exams/$EXAM_ID/batch-status?latest=refine"

# テスト3: jobId でステータス確認
curl "$BASE/api/admin/exams/$EXAM_ID/batch-status?jobId=<jobId from test1>"
```

期待値:
- テスト1: `{"jobId":"job_..."}`
- テスト2: `null` または `{"id":"...","status":"pending"|"running","done":0,...}`
- テスト3: `{"id":"...","status":"pending"|"running"|"done",...}`

---

## 完了済みタスク

- [x] AWS Polly TTS 実装 + Gemini フォールバック (`79f599a`)
- [x] TTS ルートに edge runtime 宣言追加 (`a99fac5`)
- [x] Admin ルートから edge runtime 削除（AWS PostgreSQL 互換性）(`5da210b`)
- [x] batch-status の try-catch 追加（テーブル不在時に null 返す）(`db76701`)
- [x] ゾンビジョブ自動クリーン（60分以上経過した pending/running を error に）(`5ac6a2c`)
- [x] Cmd/Ctrl+Enter で Refine 提案を適用するショートカット追加 (`cf1a56a`)
