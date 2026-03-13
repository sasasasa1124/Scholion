"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RotateCcw, ChevronRight } from "lucide-react";
import type { ExamMeta, QuizStats } from "@/lib/types";

interface Props {
  exams: ExamMeta[];
  mode: "quiz" | "review";
  lang: "ja" | "en";
}

function loadStats(examId: string): QuizStats {
  try {
    const raw = JSON.parse(localStorage.getItem(`quiz-stats-${examId}`) ?? "{}");
    const out: QuizStats = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === 0 || v === 1) out[k] = v as 0 | 1;
    }
    return out;
  } catch { return {}; }
}

export default function ExamSelectClient({ exams, mode, lang }: Props) {
  const router = useRouter();
  const [statsMap, setStatsMap] = useState<Record<string, { pct: number | null; answered: number; total: number; wrongCount: number }>>({});

  useEffect(() => {
    const map: typeof statsMap = {};
    for (const exam of exams) {
      const stats = loadStats(exam.id);
      const keys = Object.keys(stats).filter((k) => stats[k] === 0 || stats[k] === 1);
      const correct = keys.filter((k) => stats[k] === 1).length;
      const wrongCount = keys.filter((k) => stats[k] === 0).length;
      map[exam.id] = {
        pct: keys.length > 0 ? Math.round((correct / exam.questionCount) * 100) : null,
        answered: keys.length,
        total: exam.questionCount,
        wrongCount,
      };
    }
    setStatsMap(map);
  }, [exams]);

  const go = (examId: string, filter: "all" | "wrong") =>
    router.push(`/quiz/${examId}?mode=${mode}&filter=${filter}`);

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-8 py-5 flex items-center gap-3 border-b border-gray-200 bg-white">
        <Link href={`/select/${mode}`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={14} /> 戻る
        </Link>
        <span className="text-gray-200">·</span>
        <span className="text-sm font-medium text-gray-600">
          {lang === "ja" ? "日本語" : "English"} — 試験を選択
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 px-8 py-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
          {exams.map((exam) => {
            const s = statsMap[exam.id];
            const pct = s?.pct ?? null;

            return (
              <div key={exam.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
                <button
                  onClick={() => go(exam.id, "all")}
                  className="flex-1 text-left px-5 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{exam.name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {exam.questionCount} 問
                      {s && s.answered > 0 && (
                        <span className="ml-2 text-gray-300">· {s.answered}/{s.total} 回答済</span>
                      )}
                    </p>
                    {s && s.answered > 0 && pct !== null && (
                      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {pct !== null && (
                      <span className={`text-base font-bold tabular-nums ${pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-500" : "text-rose-500"}`}>
                        {pct}%
                      </span>
                    )}
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                  </div>
                </button>

                {s && s.wrongCount > 0 && (
                  <button
                    onClick={() => go(exam.id, "wrong")}
                    className="px-5 py-2.5 flex items-center gap-2 border-t border-gray-100 hover:bg-rose-50 transition-colors"
                  >
                    <RotateCcw size={12} className="text-rose-400 shrink-0" />
                    <span className="text-xs text-rose-500 font-medium">誤答 {s.wrongCount} 問を復習</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
