import { getExamList } from "@/lib/csv";
import HomeClient from "@/components/HomeClient";

export default function HomePage() {
  const exams = getExamList();
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">資格試験 練習問題</h1>
          <p className="text-sm text-gray-500 mt-1">Salesforce / MuleSoft 認定試験の練習</p>
        </div>
        <HomeClient exams={exams} />
      </div>
    </main>
  );
}
