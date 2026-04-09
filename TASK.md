# TASK.md

## 機能要件: AWS バッチジョブ完全修正 + UI修正

---

## 根本原因 (実ログ確定)

### AWS 環境

| # | 問題 | 証拠 |
|---|------|------|
| 1 | **`batch_jobs` テーブル不在** | CloudWatch: `relation "batch_jobs" does not exist (42P01)` 連発 |
| 2 | **現行インスタンスは古いイメージ** | migration ログに `0021_batch_jobs.sql` が現れず `All migrations applied` で終了 |
| 3 | **新デプロイが全て exit code 1 で失敗** | Service log: Health check failed × 5回。IAM権限不足（修正済み） |
| 4 | **`ensureTable()` が status route から未呼び出し** | `getBatchJob()` / `getActiveJob()` が直接クエリ → 毎回 42P01 |
| 5 | **`void task` が Next.js 15 で非推奨** | `after()` API を使うべき (Next.js 15.1+) |

### Cloudflare 環境
- `ensureTable()` の問題は同様
- D1 migration 未適用時も同じ失敗パターン

### UI 問題
| # | 問題 | 場所 |
|---|------|------|
| 6 | Alternative採用後にQuiz表示が更新されない | `SuggestPanel.tsx` の `handleAdopt` が `router.refresh()` を呼ばない |
| 7 | Suggest入力欄でEnterキーが送信されない | textarea/input に `onKeyDown` ハンドラーなし |

---

## SQS アーキテクチャ

SQSキュー: `https://sqs.us-west-2.amazonaws.com/435788423370/Scholion`

```
POST /api/admin/exams/[id]/fill
  → createBatchJob (batch_jobs: status=pending)
  → SQS.SendMessage (jobId, examId, type, params)
  → after(runFillJob) ← Next.js 15 の after() で即時バックグラウンド実行

Client → GET /batch-status?jobId=xxx → batch_jobs から done/total を返す
```

- `batch_jobs` テーブルはProgress追跡のために維持（SQSはDispatch担当）
- CF環境ではSQS送信スキップ（isAWSフラグで制御）

---

## 実装 Todo (ブランチ: `fix/batch-sqs-and-ui-fixes`)

### Phase 1: batch-job.ts 修正
- [ ] `getBatchJob()` に `ensureTable()` 追加
- [ ] `getActiveJob()` に `ensureTable()` 追加

### Phase 2: SQS 統合 (AWS専用)
- [ ] `lib/sqs.ts` 新規作成 (`@aws-sdk/client-sqs` 使用)
- [ ] `package.json` に `@aws-sdk/client-sqs` 追加

### Phase 3: バッチルート修正
- [ ] `app/api/admin/exams/[id]/fill/route.ts`: `void task` → `after(task)` + SQS enqueue
- [ ] `app/api/admin/exams/[id]/refine/route.ts`: 同上
- [ ] `app/api/admin/exams/[id]/factcheck/route.ts`: 同上
- [ ] `app/api/admin/questions/[id]/fill/route.ts`: 同上 (個別問題fill)
- [ ] `app/api/admin/questions/[id]/refine/route.ts`: 同上
- [ ] `app/api/admin/questions/[id]/factcheck/route.ts`: 同上

### Phase 4: UI修正
- [ ] `components/SuggestPanel.tsx`: adopt後 `router.refresh()` 追加
- [ ] `components/SuggestPanel.tsx`: textarea/input に Enter keyDown handler 追加

### Phase 5: デプロイ・確認
- [ ] TASK.md コミット (このファイル)
- [ ] コード修正コミット
- [ ] `main` → `deploy/aws` push (GitHub Actions 起動)
- [ ] App Runner 新イメージ起動確認 (`0021_batch_jobs.sql` 適用)
- [ ] CloudWatch で `42P01` エラー消滅確認
- [ ] fill/refine/factcheck が jobId を返し進捗が更新されること確認

---

## 完了済みタスク

- [x] `scripts/migrate-pg.js` 冪等化 (`c7b147d`)
- [x] `lib/batch-job.ts` D1 auto-create ensureTable (`c7b147d`)
- [x] batch-status try-catch (`db76701`)
- [x] ゾンビジョブ自動クリーン (`5ac6a2c`)
- [x] Admin route から edge runtime 削除 - AWS 修正 (`5da210b`)
- [x] AWS Polly TTS + Gemini フォールバック (`79f599a`)
- [x] IAM権限修正 (ユーザー対応済み)
