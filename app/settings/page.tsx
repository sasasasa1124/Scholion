"use client";

import { useState, useEffect } from "react";
import { Check, Sparkles, Wand2 } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import PageHeader from "@/components/PageHeader";
import type { Locale } from "@/lib/i18n";

const LANGUAGES: { value: Locale; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "ja", label: "Japanese", native: "日本語" },
  { value: "zh", label: "Chinese (Simplified)", native: "中文（简体）" },
  { value: "ko", label: "Korean", native: "한국어" },
];

export default function SettingsPage() {
  const { settings, updateSettings, t } = useSettings();
  const [language, setLanguage] = useState<Locale>(settings.language);
  const [aiPrompt, setAiPrompt] = useState(settings.aiPrompt);
  const [aiRefinePrompt, setAiRefinePrompt] = useState(settings.aiRefinePrompt);
  const [saved, setSaved] = useState(false);

  // Sync local state when settings load from localStorage
  useEffect(() => {
    setLanguage(settings.language);
    setAiPrompt(settings.aiPrompt);
    setAiRefinePrompt(settings.aiRefinePrompt);
  }, [settings.language, settings.aiPrompt, settings.aiRefinePrompt]);

  function handleSave() {
    updateSettings({ language, aiPrompt, aiRefinePrompt });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      <PageHeader back={{ href: "/" }} title={t("settings")} />
      <main className="flex-1 px-4 sm:px-8 py-8 max-w-xl mx-auto w-full space-y-8">

        {/* Language */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {t("languageLabel")}
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">{lang.native}</span>
                  <span className="ml-2 text-xs text-gray-400">{lang.label}</span>
                </div>
                {language === lang.value && (
                  <Check size={15} className="text-blue-500 shrink-0" strokeWidth={2.5} />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* AI Explain Prompt */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <Sparkles size={11} className="text-violet-400" />
            {t("aiPrompt")}
          </h2>
          <p className="text-xs text-gray-400 mb-3">{t("aiPromptPlaceholder")}</p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none"
            placeholder={t("aiPromptPlaceholder")}
          />
        </section>

        {/* AI Refine Prompt */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <Wand2 size={11} className="text-amber-400" />
            {t("aiRefinePrompt")}
          </h2>
          <p className="text-xs text-gray-400 mb-3">{t("aiRefinePromptPlaceholder")}</p>
          <textarea
            value={aiRefinePrompt}
            onChange={(e) => setAiRefinePrompt(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
            placeholder={t("aiRefinePromptPlaceholder")}
          />
        </section>

        {/* Save */}
        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-gray-900 text-white hover:bg-gray-700"
          }`}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <Check size={15} strokeWidth={2.5} />
              {t("saved")}
            </span>
          ) : (
            t("save")
          )}
        </button>
      </main>
    </div>
  );
}
