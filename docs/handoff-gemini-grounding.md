# Handoff: Gemini Google Search Grounding — Unresolved Issue

**Date:** 2026-03-19
**Status:** UNRESOLVED — needs fresh investigation
**Branch investigated:** `fix/wrong-mode-crash` (already reverted — `route.ts` is back to original)

---

## 症状

- `app/api/ai/explain` エンドポイントで Google Search グラウンディングが発火しない
- 時事情報（今日の日付など）を含む質問でも、モデルが学習データのみで回答する
- ユーザー確認: 「今日の天気などを聞いても正確な回答を出せなかった」

## 現状コード

```ts
// app/api/ai/explain/route.ts
const response = await ai.models.generateContent({
  model,
  contents: prompt,
  config: {
    tools: [{ googleSearch: {} }],
  },
});
raw = response.text ?? "";
const chunks = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
```

---

## 試みた（すべて却下または効果なし）

| アプローチ | 結果 |
|-----------|------|
| `systemInstruction` で「必ずGoogle Searchを使え」 | ユーザーが「本質的な問題でない」と却下 |
| `googleSearch` に `dynamicRetrievalConfig.dynamicThreshold: 1` を追加 | SDK の `googleSearchToMldev()` がこのフィールドを無視するため無効 |
| `googleSearchRetrieval` + `dynamicThreshold: 1` に切り替え | ユーザーが「意味ない」と却下・リバート |

---

## SDK 調査で判明した事実（@google/genai v1.45.0）

1. **`googleSearch` ツール**: SDK が `googleSearchToMldev()` で変換。`dynamicRetrievalConfig` は未対応（無視される）。モデルが検索するかどうかは自律判断。
2. **`googleSearchRetrieval` ツール**: SDK がそのままパススルー。`dynamicRetrievalConfig.dynamicThreshold` は API に届く。ただし Gemini 2.x 向けには非推奨（ドキュメント: 「古いモデル向け」）。
3. **`response.candidates`**: `GenerateContentResponse` クラスの public property として宣言済み。`Object.assign` で設定されるため `(response as any).candidates` のアクセスは正しく動作する（TypeScript キャストは不要だが機能上は問題なし）。
4. **Cloudflare Workers 互換性**: SDK は `dist/web/index.mjs` を使用。既知の非互換は確認されていない。

---

## 未調査の仮説（次の担当者へ）

以下を優先度順に検証してほしい：

### 仮説 1: グラウンディングは発火しているが、JSON解析が失敗している
- Google Search が使われると、モデルが引用付きテキストを返してJSON.parseが壊れる可能性
- 確認方法: `catch` ブロックおよび `{ error: "AI returned invalid JSON", raw }` レスポンスのログを確認
- 修正案: `raw` から JSON オブジェクトを正規表現で抽出 (`raw.match(/\{[\s\S]*\}/)`) してから parse

### 仮説 2: DB に古いモデルID が残っている
- `getSetting("gemini_model")` が `gemini-2.5-flash-preview-04-17`（非推奨、404）を返す
- 確認方法: D1 DB の `settings` テーブルで `gemini_model` の値を確認
- 修正案: DB の値をリセット、またはコード側でフォールバックに有効なモデルを設定

### 仮説 3: `gemini-2.5-flash` + `googleSearch` の組み合わせで API エラー
- `tools: [{ googleSearch: {} }]` が特定のモデルでサポートされていない
- 確認方法: `curl` で直接 API を叩いてエラーを確認（下記参照）
- 修正案: `gemini-2.0-flash` または `gemini-1.5-flash` に切り替えて grounding を確認

### 仮説 4: グラウンディングと JSON プロンプトの根本的な非互換
- モデルが JSON 出力を要求されると Google Search を使わない（二律背反）
- 修正案: グラウンディング用クエリ（自由文）と JSON フォーマット化を 2 ステップに分割

---

## デバッグ手順

### ステップ 1: API を直接叩いて何が起きているか確認

```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "今日の日付は何ですか？JSONで返してください: {\"date\": \"YYYY-MM-DD\"}"}]}],
    "tools": [{"google_search": {}}]
  }' | jq '.candidates[0]'
```

`groundingMetadata` が返ってくるか確認。エラーが出ればその内容を確認。

### ステップ 2: 現在のプロダクション DB のモデル設定を確認

```bash
wrangler d1 execute quiz-db --command "SELECT * FROM settings WHERE key = 'gemini_model';" --remote
```

### ステップ 3: route.ts にデバッグレスポンスを一時追加

```ts
// デバッグ用: raw と candidates 構造を返す
return NextResponse.json({
  raw: raw.slice(0, 500),
  hasGrounding: chunks.length > 0,
  chunks: chunks.slice(0, 2),
  ...result.data,
});
```

---

## 関連ファイル

- `app/api/ai/explain/route.ts` — Gemini 呼び出し・グラウンディングメタデータ取得
- `app/api/app-settings/route.ts` — デフォルトモデル設定 (`gemini-2.5-flash`)
- `components/AnswerRevealModal.tsx` / `ExplainPanel.tsx` — フロントエンドの explain 呼び出し箇所
