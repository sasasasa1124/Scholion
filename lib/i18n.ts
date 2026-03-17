export type Locale = "en" | "ja" | "zh" | "ko";

export type TranslationKey =
  | "settings"
  | "language"
  | "languageLabel"
  | "aiPrompt"
  | "aiPromptPlaceholder"
  | "save"
  | "saved"
  | "back"
  | "home"
  | "submit"
  | "next"
  | "prev"
  | "all"
  | "wrong"
  | "explain"
  | "adopt"
  | "dismiss"
  | "aiExplaining"
  | "aiSuggestedAnswer"
  | "aiExplanation"
  | "aiReasoning"
  | "adoptSuccess";

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    settings: "Settings",
    language: "Language",
    languageLabel: "Display Language",
    aiPrompt: "AI Prompt",
    aiPromptPlaceholder: "Additional instructions for AI explanations (e.g. explain in simple terms, focus on practical use cases...)",
    save: "Save",
    saved: "Saved",
    back: "Back",
    home: "Home",
    submit: "Submit",
    next: "Next",
    prev: "Prev",
    all: "All",
    wrong: "Wrong",
    explain: "AI Explain",
    adopt: "Adopt",
    dismiss: "Dismiss",
    aiExplaining: "Analyzing...",
    aiSuggestedAnswer: "Suggested Answer",
    aiExplanation: "Explanation",
    aiReasoning: "Reasoning",
    adoptSuccess: "Adopted",
  },
  ja: {
    settings: "設定",
    language: "言語",
    languageLabel: "表示言語",
    aiPrompt: "AIプロンプト",
    aiPromptPlaceholder: "AI解説への追加指示（例：簡潔に説明する、実務での使われ方を重視する...）",
    save: "保存",
    saved: "保存済み",
    back: "戻る",
    home: "ホーム",
    submit: "回答する",
    next: "次へ",
    prev: "前へ",
    all: "全問",
    wrong: "不正解",
    explain: "AI解説",
    adopt: "採用する",
    dismiss: "閉じる",
    aiExplaining: "解析中...",
    aiSuggestedAnswer: "AI推奨の正解",
    aiExplanation: "解説",
    aiReasoning: "根拠",
    adoptSuccess: "採用しました",
  },
  zh: {
    settings: "设置",
    language: "语言",
    languageLabel: "显示语言",
    aiPrompt: "AI提示词",
    aiPromptPlaceholder: "AI解释的额外指示（例如：用简单的语言解释、重点说明实际用例...）",
    save: "保存",
    saved: "已保存",
    back: "返回",
    home: "首页",
    submit: "提交",
    next: "下一题",
    prev: "上一题",
    all: "全部",
    wrong: "错误",
    explain: "AI解释",
    adopt: "采用",
    dismiss: "关闭",
    aiExplaining: "分析中...",
    aiSuggestedAnswer: "AI建议答案",
    aiExplanation: "解释",
    aiReasoning: "推理",
    adoptSuccess: "已采用",
  },
  ko: {
    settings: "설정",
    language: "언어",
    languageLabel: "표시 언어",
    aiPrompt: "AI 프롬프트",
    aiPromptPlaceholder: "AI 해설에 대한 추가 지시 (예: 간단히 설명, 실무 사용 사례 위주...)",
    save: "저장",
    saved: "저장됨",
    back: "뒤로",
    home: "홈",
    submit: "제출",
    next: "다음",
    prev: "이전",
    all: "전체",
    wrong: "오답",
    explain: "AI 해설",
    adopt: "채택",
    dismiss: "닫기",
    aiExplaining: "분석 중...",
    aiSuggestedAnswer: "AI 추천 답",
    aiExplanation: "해설",
    aiReasoning: "근거",
    adoptSuccess: "채택됨",
  },
};

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations["en"][key];
}
