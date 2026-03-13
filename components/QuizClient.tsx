"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, BookOpen, Brain, Layers, AlertCircle,
  CheckCircle2, XCircle, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Question, QuizStats } from "@/lib/types";
import QuizQuestion from "./QuizQuestion";

interface Props {
  questions: Question[];
  examId: string;
  examName: string;
  initialFilter: "all" | "wrong";
  mode: "quiz" | "review";
  lang: "ja" | "en";
}

const statsKey = (id: string) => `quiz-stats-${id}`;

function loadStats(examId: string): QuizStats {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(statsKey(examId)) ?? "{}");
    const migrated: QuizStats = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === 0 || v === 1) migrated[k] = v as 0 | 1;
    }
    return migrated;
  } catch { return {}; }
}

function saveStats(examId: string, stats: QuizStats) {
  localStorage.setItem(statsKey(examId), JSON.stringify(stats));
}

export default function QuizClient({ questions, examId, examName, initialFilter, mode, lang }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState<QuizStats>({});
  const [filter, setFilter] = useState<"all" | "wrong">(initialFilter);

  // Per-question UI state (lifted from QuizQuestion)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(mode === "review");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const backHref = `/select/${mode}/${lang}`;

  useEffect(() => { setStats(loadStats(examId)); }, [examId]);

  // Reset question state on navigation or filter change
  useEffect(() => {
    setSelected(new Set());
    setSubmitted(mode === "review");
    setIsCorrect(null);
  }, [currentIndex, filter, mode]);

  const filteredQuestions = questions.filter((q) => {
    if (filter === "wrong") return stats[String(q.id)] === 0;
    return true;
  });

  const totalAnswered = questions.filter((q) => stats[String(q.id)] !== undefined).length;
  const totalCorrect = questions.filter((q) => stats[String(q.id)] === 1).length;
  const overallRate = totalAnswered > 0 ? Math.round((totalCorrect / questions.length) * 100) : null;
  const wrongCount = questions.filter((q) => stats[String(q.id)] === 0).length;

  const recordAnswer = useCallback((questionId: number, correct: boolean) => {
    setStats((prev) => {
      const next = { ...prev, [String(questionId)]: correct ? 1 : 0 } as QuizStats;
      saveStats(examId, next);
      return next;
    });
  }, [examId]);

  const handleToggle = useCallback((label: string) => {
    if (submitted) return;
    const q = filteredQuestions[currentIndex];
    if (!q) return;
    setSelected((prev) => {
      if (q.isMultiple) {
        const next = new Set(prev);
        next.has(label) ? next.delete(label) : next.add(label);
        return next;
      }
      return new Set([label]);
    });
  }, [submitted, filteredQuestions, currentIndex]);

  const handleSubmit = useCallback(() => {
    const q = filteredQuestions[currentIndex];
    if (!q || selected.size === 0) return;
    if (q.isMultiple && selected.size !== q.answers.length) {
      alert(`${q.answers.length}つ選択してください`);
      return;
    }
    const correct = q.answers.length === selected.size && q.answers.every((a) => selected.has(a));
    setIsCorrect(correct);
    setSubmitted(true);
    recordAnswer(q.id, correct);
  }, [filteredQuestions, currentIndex, selected, recordAnswer]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, filteredQuestions.length - 1));
  }, [filteredQuestions.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard
  useEffect(() => {
    const q = filteredQuestions[currentIndex];
    if (!q) return;
    const labels = q.choices.map((c) => c.label);

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // don't intercept slider

      if (mode === "review") {
        if (e.key === "ArrowRight" || e.key === "Enter") { recordAnswer(q.id, true);  goNext(); }
        else if (e.key === "ArrowLeft")                   { recordAnswer(q.id, false); goNext(); }
        else if (e.key === "Backspace")                   { goPrev(); }
        return;
      }
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= labels.length) { handleToggle(labels[num - 1]); return; }
      if (e.key === "Enter")      { submitted ? goNext() : handleSubmit(); }
      if (e.key === "ArrowRight" && submitted) goNext();
      if (e.key === "ArrowLeft"  && submitted) goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredQuestions, currentIndex, submitted, mode, handleToggle, handleSubmit, goNext, goPrev, recordAnswer]);

  const ModeIcon = mode === "quiz" ? Brain : BookOpen;
  const isLast = currentIndex === filteredQuestions.length - 1;

  if (filteredQuestions.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle size={32} className="text-gray-300" />
        <p className="font-semibold text-gray-700">
          {filter === "wrong" ? "誤答問題がありません" : "問題がありません"}
        </p>
        {filter === "wrong" && (
          <button onClick={() => setFilter("all")} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors">
            全問に切り替え
          </button>
        )}
        <Link href={backHref} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1.5">
          <ArrowLeft size={14} /> 戻る
        </Link>
      </div>
    );
  }

  const q = filteredQuestions[currentIndex];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f8f9fb]">
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between px-6 h-12 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <Link href={backHref} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={14} /> 戻る
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <ModeIcon size={13} strokeWidth={1.75} />
            <span>{examName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {overallRate !== null && (
            <span className={`text-xs font-semibold tabular-nums ${overallRate >= 80 ? "text-emerald-600" : overallRate >= 60 ? "text-amber-500" : "text-rose-500"}`}>
              {totalCorrect}/{questions.length} 正解
              <span className="font-normal text-gray-400 ml-1">({overallRate}%)</span>
            </span>
          )}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setFilter("all")} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${filter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Layers size={11} /> 全問 {questions.length}
            </button>
            <button onClick={() => setFilter("wrong")} disabled={wrongCount === 0} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${filter === "wrong" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <AlertCircle size={11} /> 誤答 {wrongCount}
            </button>
          </div>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="h-0.5 bg-gray-100 shrink-0">
        <div className="h-full bg-gray-900 transition-all duration-300" style={{ width: `${((currentIndex + 1) / filteredQuestions.length) * 100}%` }} />
      </div>

      {/* ── Main: two columns ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left panel: question + choices + action */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 bg-white">
          {/* Position indicator */}
          <div className="shrink-0 px-8 pt-5 pb-3 flex items-center justify-between">
            <span className="text-xs tabular-nums text-gray-400">問 {currentIndex + 1} / {filteredQuestions.length}</span>
          </div>

          {/* Question + choices (scrollable) */}
          <div className="flex-1 overflow-y-auto px-8 pb-4">
            <QuizQuestion
              question={q}
              selected={selected}
              onToggle={handleToggle}
              submitted={submitted}
              stat={stats[String(q.id)]}
              reviewMode={mode === "review"}
            />
          </div>

          {/* Action buttons (fixed at bottom of left panel) */}
          <div className="shrink-0 px-8 py-4 border-t border-gray-100">
            {mode === "quiz" && !submitted && (
              <button
                onClick={handleSubmit}
                disabled={selected.size === 0}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-25 hover:bg-gray-700 transition-colors"
              >
                回答する
                <span className="ml-2 text-xs font-normal opacity-40">Enter</span>
              </button>
            )}
            {mode === "review" && (
              <div className="flex gap-2">
                <button onClick={() => { recordAnswer(q.id, false); goNext(); }} disabled={isLast} className="flex-1 h-10 rounded-xl border-2 border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-30">
                  <ThumbsDown size={14} strokeWidth={2} /> 知らない <span className="text-xs opacity-50">←</span>
                </button>
                <button onClick={() => { recordAnswer(q.id, true); goNext(); }} disabled={isLast} className="flex-1 h-10 rounded-xl border-2 border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-30">
                  <ThumbsUp size={14} strokeWidth={2} /> 知っている <span className="text-xs opacity-50">→</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: explanation */}
        <div className="w-[420px] shrink-0 flex flex-col overflow-hidden bg-white">
          {submitted ? (
            <>
              {/* Result header */}
              <div className="shrink-0 px-8 pt-5 pb-3 border-b border-gray-100">
                {mode === "quiz" && isCorrect !== null && (
                  <div className="flex items-center gap-2">
                    {isCorrect
                      ? <><CheckCircle2 size={17} className="text-emerald-500" /><span className="font-semibold text-emerald-700 text-sm">正解</span></>
                      : <><XCircle size={17} className="text-rose-500" /><span className="font-semibold text-rose-600 text-sm">不正解</span><span className="text-xs text-gray-400 ml-2">正答: {q.answers.join(", ")}</span></>
                    }
                  </div>
                )}
                {mode === "review" && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">正答: {q.answers.join(", ")}</p>
                )}
              </div>

              {/* Explanation (scrollable) */}
              <div className="flex-1 overflow-y-auto px-8 py-4">
                {q.explanation ? (
                  <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{q.explanation}</p>
                ) : (
                  <p className="text-sm text-gray-300">解説なし</p>
                )}
                {q.source && <p className="text-xs text-gray-300 mt-4">出典: {q.source}</p>}
              </div>

              {/* Nav buttons */}
              {mode === "quiz" && (
                <div className="shrink-0 px-8 py-4 border-t border-gray-100 flex gap-2">
                  <button onClick={goPrev} disabled={currentIndex === 0} className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-20 transition-all">
                    <ChevronLeft size={17} />
                  </button>
                  <button onClick={goNext} disabled={isLast} className="flex-1 h-10 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-20 hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5">
                    {isLast ? "完了" : <>次へ <ChevronRight size={15} /> <span className="text-xs opacity-40">Enter</span></>}
                  </button>
                </div>
              )}
              {mode === "review" && (
                <div className="shrink-0 px-8 py-4 border-t border-gray-100">
                  <button onClick={goPrev} disabled={!currentIndex} className="w-full h-9 rounded-xl border border-gray-200 text-gray-400 text-xs hover:border-gray-300 hover:bg-gray-50 disabled:opacity-20 transition-all flex items-center justify-center gap-1.5">
                    <ChevronLeft size={13} /> 前の問題に戻る <span className="opacity-50 ml-0.5">⌫</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-300">回答すると解説が表示されます</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer: slider + hint ── */}
      <footer className="shrink-0 border-t border-gray-200 bg-white px-6 py-2.5 flex items-center gap-4">
        <span className="text-xs text-gray-300 tabular-nums shrink-0">1</span>
        <input
          type="range"
          min={0}
          max={filteredQuestions.length - 1}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(Number(e.target.value))}
          className="flex-1 h-1 accent-gray-900 cursor-pointer"
        />
        <span className="text-xs text-gray-300 tabular-nums shrink-0">{filteredQuestions.length}</span>
        <span className="text-xs text-gray-300 ml-4 shrink-0">
          {mode === "review" ? "← 知らない  → 知っている  ⌫ 前へ" : "1–9 選択  Enter 回答/次へ  ←→ 前後"}
        </span>
      </footer>
    </div>
  );
}
