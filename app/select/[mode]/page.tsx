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
    <main className="min-h-screen bg-[#f8f9fb] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-10 transition-colors">
          <ArrowLeft size={14} /> 戻る
        </Link>

        <p className="text-sm text-gray-400 mb-8 text-center">言語を選択</p>

        <div className="grid grid-cols-2 gap-4">
          {[
            { href: `/select/${mode}/ja`, code: "JP", label: "日本語" },
            { href: `/select/${mode}/en`, code: "EN", label: "English" },
          ].map(({ href, code, label }) => (
            <Link key={code} href={href} className="group block">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center text-center gap-3 hover:border-blue-400 hover:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all duration-150 h-full">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-base font-bold text-slate-600">
                  {code}
                </div>
                <p className="font-semibold text-gray-900">{label}</p>
                <ChevronRight size={15} className="text-gray-300 group-hover:text-blue-400 transition-colors mt-auto" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
