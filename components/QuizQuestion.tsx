"use client";

import { useState, useEffect } from "react";
import type { Question, QuizStat } from "@/lib/types";

interface Props {
  question: Question;
  examId: string;
  onNext?: () => void;
  onPrev?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isLast?: boolean;
  currentIndex: number;
  total: number;
  stat?: QuizStat;
  onAnswer?: (correct: boolean) => void;
  reviewMode?: boolean; // フラッシュカードモード
}

export default function QuizQuestion({
  question,
  examId,
  onNext,
  onPrev,
  hasPrev,
  hasNext,
  isLast,
  currentIndex,
  total,
  stat,
  onAnswer,
  reviewMode = false,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(reviewMode);

  useEffect(() => {
    setSelected(new Set());
    setSubmitted(reviewMode);
  }, [question.id, examId, reviewMode]);

  const toggleChoice = (label: string) => {
    if (submitted) return;
    if (question.isMultiple) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(label) ? next.delete(label) : next.add(label);
        return next;
      });
    } else {
      setSelected(new Set([label]));
    }
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    if (question.isMultiple && selected.size !== question.answers.length) {
      alert(`${question.answers.length}つ選択してください`);
      return;
    }
    const correct =
      question.answers.length === selected.size &&
      question.answers.every((a) => selected.has(a));
    setSubmitted(true);
    onAnswer?.(correct);
  };

  const correctRate =
    stat && stat.attempts > 0
      ? Math.round((stat.correct / stat.attempts) * 100)
      : null;

  // In review mode, treat everything as "submitted" with no selection
  const showAnswer = submitted;

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">問 {currentIndex + 1} / {total}</span>
        {correctRate !== null && !reviewMode && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            correctRate >= 80 ? "bg-green-100 text-green-700" :
            correctRate >= 60 ? "bg-yellow-100 text-yellow-700" :
            "bg-red-100 text-red-600"
          }`}>
            この問題 {correctRate}% ({stat!.correct}/{stat!.attempts})
          </span>
        )}
      </div>

      <div className="h-1 bg-gray-100 rounded-full mb-5">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
        <div className="flex items-center gap-2 mb-2.5">
          {question.isMultiple && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              複数選択 ({question.answers.length}つ)
            </span>
          )}
          {question.isDuplicate && (
            <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">重複</span>
          )}
        </div>
        <p className="text-gray-900 font-medium leading-relaxed text-sm md:text-base whitespace-pre-wrap">
          {question.question}
        </p>
      </div>

      {/* Choices */}
      <div className="space-y-2 mb-4">
        {question.choices.map((choice) => {
          const isSelected = selected.has(choice.label);
          const isAnswer = question.answers.includes(choice.label);

          let containerStyle = "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50";
          let badgeStyle = "border-gray-300 text-gray-500";

          if (showAnswer) {
            if (isAnswer) {
              containerStyle = "border-green-400 bg-green-50";
              badgeStyle = "border-green-500 bg-green-500 text-white";
            } else if (isSelected && !isAnswer) {
              containerStyle = "border-red-400 bg-red-50";
              badgeStyle = "border-red-500 bg-red-500 text-white";
            } else {
              containerStyle = "border-gray-200 bg-gray-50 opacity-50";
            }
          } else if (isSelected) {
            containerStyle = "border-blue-500 bg-blue-50";
            badgeStyle = "border-blue-500 bg-blue-500 text-white";
          }

          return (
            <button
              key={choice.label}
              onClick={() => toggleChoice(choice.label)}
              className={`w-full text-left border-2 rounded-lg px-4 py-3 transition-all ${containerStyle} ${showAnswer ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${badgeStyle}`}>
                  {choice.label}
                </span>
                <span className="text-sm leading-relaxed pt-0.5 text-gray-800 whitespace-pre-wrap">
                  {choice.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Submit button (quiz mode only) */}
      {!showAnswer && !reviewMode && (
        <button
          onClick={handleSubmit}
          disabled={selected.size === 0}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors mb-4"
        >
          回答する
        </button>
      )}

      {/* Explanation */}
      {showAnswer && (
        <div className={`rounded-xl border-2 p-5 mb-4 ${
          reviewMode
            ? "border-blue-200 bg-blue-50"
            : selected.size > 0 && question.answers.every((a) => selected.has(a)) && question.answers.length === selected.size
              ? "border-green-400 bg-green-50"
              : "border-red-400 bg-red-50"
        }`}>
          {!reviewMode && (
            <div className="flex items-center gap-2 mb-3">
              {selected.size > 0 && question.answers.every((a) => selected.has(a)) && question.answers.length === selected.size ? (
                <span className="text-lg font-bold text-green-700">✓ 正解！</span>
              ) : (
                <>
                  <span className="text-lg font-bold text-red-600">✗ 不正解</span>
                  <span className="text-sm text-gray-600">正答: {question.answers.join(", ")}</span>
                </>
              )}
            </div>
          )}
          {reviewMode && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-blue-700">正答: {question.answers.join(", ")}</span>
            </div>
          )}
          {question.explanation && (
            <div className={`text-sm text-gray-700 leading-relaxed ${!reviewMode ? "border-t border-gray-200 pt-3 mt-2" : ""} whitespace-pre-wrap`}>
              {question.explanation}
            </div>
          )}
          {question.source && (
            <p className="text-xs text-gray-400 mt-2">出典: {question.source}</p>
          )}
        </div>
      )}

      {/* Navigation — always show in review mode, show after submit in quiz mode */}
      {(showAnswer || reviewMode) && (
        <div className="flex gap-3">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex-1 py-3 rounded-lg border-2 border-gray-200 text-gray-600 font-medium disabled:opacity-30 hover:border-gray-300 transition-colors"
          >
            ← 前へ
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              isLast
                ? "border-2 border-gray-200 text-gray-400 opacity-30 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-700"
            }`}
          >
            {isLast ? "終了" : "次へ →"}
          </button>
        </div>
      )}
    </div>
  );
}
