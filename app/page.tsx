import Link from "next/link";
import { Brain, BookOpen, ChevronRight } from "lucide-react";

export default function ModePage() {
  return (
    <main className="min-h-screen bg-[#f8f9fb] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">資格試験 練習</h1>
          <p className="text-sm text-gray-400 mt-1">モードを選択</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/select/quiz" className="group block">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-blue-400 hover:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all duration-150">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Brain size={22} className="text-blue-600" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">クイズ</p>
                <p className="text-xs text-gray-400 mt-0.5">選択肢を選んで正誤判定</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
            </div>
          </Link>

          <Link href="/select/review" className="group block">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-violet-400 hover:shadow-[0_0_0_3px_rgba(139,92,246,0.08)] transition-all duration-150">
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <BookOpen size={22} className="text-violet-600" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">フラッシュカード</p>
                <p className="text-xs text-gray-400 mt-0.5">答えを見ながら確認</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-violet-400 transition-colors" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
