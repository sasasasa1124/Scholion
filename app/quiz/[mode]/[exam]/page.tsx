import { getQuestions, getExamList } from "@/lib/db";
import { getUserEmail } from "@/lib/user";
import QuizClient from "@/components/QuizClient";
import AnswersClient from "@/components/AnswersClient";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ mode: string; exam: string }>;
}

export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: Props) {
  const { mode, exam } = await params;
  if (mode !== "quiz" && mode !== "review" && mode !== "answers") notFound();

  const examId = decodeURIComponent(exam);
  const exams = await getExamList();
  const meta = exams.find((e) => e.id === examId);
  if (!meta) notFound();

  const questions = await getQuestions(examId);
  const userEmail = await getUserEmail();

  if (mode === "answers") {
    return <AnswersClient questions={questions} examName={meta.name} userEmail={userEmail} />;
  }

  return (
    <QuizClient
      questions={questions}
      examId={examId}
      examName={meta.name}
      mode={mode as "quiz" | "review"}
      userEmail={userEmail}
    />
  );
}
