"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ChevronLeft, ChevronRight } from "lucide-react";
import type { Question } from "@/lib/types";

interface Props {
  questions: Question[];
  examName: string;
}

export default function AnswersClient({ questions, examName }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
      else if (e.key === "ArrowLeft" || e.key === "Backspace") setCurrentIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [questions.length]);

  const q = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const sliderPct = questions.length > 1
    ? `${(currentIndex / (questions.length - 1)) * 100}%`
    : "0%";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f8f9fb]">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 h-12 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/select/answers" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            <ArrowLeft size={14} /> 戻る
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
            <BookOpenCheck size={13} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{examName}</span>
          </div>
        </div>
        <span className="text-xs tabular-nums text-gray-400 shrink-0">
          {currentIndex + 1} / {questions.length}
        </span>
      </header>

      {/* Main */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {/* Question */}
          <div className="bg-gray-50 rounded-xl px-5 py-4">
            <p className="text-[11px] text-gray-400 mb-2">
              問 {currentIndex + 1}
              {q.isMultiple && <span className="ml-2 text-violet-500 font-semibold">複数選択</span>}
            </p>
            <div
              className="text-sm leading-relaxed text-gray-900 font-medium whitespace-pre-wrap [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mt-2"
              dangerouslySetInnerHTML={{ __html: q.question }}
            />
          </div>

          {/* Choices */}
          <div className="flex flex-col gap-2">
            {q.choices.map((c) => {
              const isAnswer = q.answers.includes(c.label);
              return (
                <div
                  key={c.label}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                    isAnswer
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <span className={`shrink-0 w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center mt-0.5 ${
                    isAnswer ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"
                  }`}>
                    {q.choices.indexOf(c) + 1}
                  </span>
                  <span className={`text-sm leading-snug pt-0.5 whitespace-pre-wrap ${
                    isAnswer ? "text-emerald-900 font-medium" : "text-gray-500"
                  }`}>
                    {c.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {q.explanation && (
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">解説</p>
              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">{q.explanation}</p>
              {q.source && <p className="text-xs text-gray-300 mt-3">出典: {q.source}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-gray-200 bg-white px-4 sm:px-6 pt-3 pb-2.5">
        {/* Question map */}
        <div className="flex items-end gap-px mb-2.5">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`flex-1 rounded-full transition-all duration-150 ${
                i === currentIndex ? "h-3 bg-gray-800" : "h-2 bg-gray-200 hover:bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Slider + nav */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
            disabled={isFirst}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={15} />
          </button>
          <input
            type="range"
            min={0}
            max={questions.length - 1}
            value={currentIndex}
            onChange={(e) => setCurrentIndex(Number(e.target.value))}
            className="quiz-slider flex-1"
            style={{ "--fill": sliderPct } as React.CSSProperties}
          />
          <button
            onClick={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))}
            disabled={isLast}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-20 transition-all"
          >
            <ChevronRight size={15} />
          </button>
          <span className="text-xs text-gray-300 ml-1 shrink-0 hidden lg:block">Enter 次へ  ⌫ 前へ</span>
        </div>
      </footer>
    </div>
  );
}
