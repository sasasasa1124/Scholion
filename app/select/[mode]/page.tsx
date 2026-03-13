import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ mode: string }>;
}

export default async function LangPage({ params }: Props) {
  const { mode } = await params;
  if (mode !== "quiz" && mode !== "review") notFound();

  return (
    <main className="min-h-screen bg-[#f8f9fb] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-10 transition-colors"
        >
          <ArrowLeft size={14} />
          戻る
        </Link>

        <p className="text-sm text-gray-400 mb-8 text-center">言語を選択</p>

        <div className="flex flex-col gap-3">
          <Link href={`/select/${mode}/ja`} className="group block">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-blue-400 hover:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all duration-150">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-semibold text-slate-700 shrink-0 leading-none">
                JP
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">日本語</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
            </div>
          </Link>

          <Link href={`/select/${mode}/en`} className="group block">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-blue-400 hover:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all duration-150">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-semibold text-slate-700 shrink-0 leading-none">
                EN
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">English</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
