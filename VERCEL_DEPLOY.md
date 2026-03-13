# Vercel デプロイ手順メモ

現在の実装はファイルシステム（`fs`）でCSVを読み書きしているため、
Vercelにデプロイする前に **Vercel Blob** へ切り替える必要がある。

---

## 変更が必要なファイル（2ファイル）

### 1. `lib/csv.ts`

**問題箇所：**
```ts
const CSV_DIR = path.join(process.cwd(), "..");
const files = fs.readdirSync(CSV_DIR).filter(...);   // ← NG
const content = fs.readFileSync(path.join(CSV_DIR, file), "utf-8");  // ← NG
```

**変更方針：**
- `getExamList()` → Vercel Blob の `list()` でblob一覧を取得し、CSVメタを構築
- `getQuestions()` → blob URLを `fetch()` でテキスト取得してパース

```ts
import { list } from "@vercel/blob";

export async function getExamList(): Promise<ExamMeta[]> {
  const { blobs } = await list({ prefix: "exams/" });
  return blobs
    .filter((b) => b.pathname.endsWith(".csv"))
    .map((b) => {
      const id = b.pathname.replace("exams/", "").replace(".csv", "");
      const isEn = id.endsWith("_en");
      const baseName = isEn ? id.slice(0, -3) : id;
      return {
        id,
        name: EXAM_NAMES[baseName] ?? baseName,
        language: isEn ? "en" : "ja",
        questionCount: 0, // 別途fetchが必要 or メタをblob名に埋め込む
      };
    });
}

export async function getQuestions(examId: string): Promise<Question[]> {
  const { blobs } = await list({ prefix: `exams/${examId}.csv` });
  if (!blobs[0]) return [];
  const text = await fetch(blobs[0].url).then((r) => r.text());
  // 以降は現在のパースロジックと同じ
}
```

### 2. `app/api/upload/route.ts`

**問題箇所：**
```ts
fs.writeFileSync(destPath, text, "utf-8");  // ← NG（Vercelのfsは読み取り専用）
```

**変更方針：**
- `fs.writeFileSync` を Vercel Blob の `put()` に置き換える

```ts
import { put } from "@vercel/blob";

// fs.writeFileSync(destPath, text, "utf-8"); を以下に差し替え
const { url } = await put(`exams/${name}`, text, {
  access: "public",
  contentType: "text/csv",
});
```

---

## セットアップ手順（デプロイ時）

### 1. パッケージ追加
```bash
cd quiz
npm install @vercel/blob
```

### 2. Vercel Blob ストアを作成
Vercel ダッシュボード → Storage → Create Database → Blob

### 3. 環境変数を設定
Vercel が自動で `BLOB_READ_WRITE_TOKEN` を設定してくれる。
ローカル開発用に `.env.local` に追加：
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxx...
```

### 4. 既存CSVを Blob にアップロード（初回のみ）
以下のワンショットスクリプトを作って実行：
```ts
// scripts/seed-blobs.ts
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";

const CSV_DIR = path.join(process.cwd(), "..");
const files = fs.readdirSync(CSV_DIR).filter((f) => f.endsWith(".csv"));

for (const file of files) {
  const content = fs.readFileSync(path.join(CSV_DIR, file), "utf-8");
  await put(`exams/${file}`, content, { access: "public", contentType: "text/csv" });
  console.log(`Uploaded: ${file}`);
}
```
```bash
npx ts-node scripts/seed-blobs.ts
```

---

## 変更しなくていいファイル

| ファイル | 理由 |
|---------|------|
| `app/page.tsx` | CSVに触れていない |
| `app/select/[mode]/page.tsx` | `getExamList()` を呼ぶだけ。関数の中身を変えれば済む |
| `app/quiz/[mode]/[exam]/page.tsx` | `getQuestions()` を呼ぶだけ。同上 |
| `components/HomeClient.tsx` | アップロードUIはそのまま。APIエンドポイントは変わらない |
| `components/QuizClient.tsx` | 変更不要 |
| `lib/types.ts` | 変更不要 |

---

## 注意点

- Vercel Blob の無料枠：**500MB ストレージ / 1GB 転送/月**
  - 現在のCSV 12本は合計数MB程度なので余裕あり
- `getExamList()` が async になるので、呼び出し元の Server Component も `await` が必要
  - `app/select/[mode]/page.tsx`: `const exams = await getExamList();`
  - `app/quiz/[mode]/[exam]/page.tsx`: `const exams = await getExamList();`
- ローカル開発は現在のまま（`fs`ベース）でも動く。
  環境変数 `BLOB_READ_WRITE_TOKEN` の有無で分岐させるとスムーズ：
  ```ts
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  ```
