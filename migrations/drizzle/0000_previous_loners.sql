CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lang" text NOT NULL,
	"tags" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "question_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"question_text" text NOT NULL,
	"options" text NOT NULL,
	"answers" text NOT NULL,
	"explanation" text DEFAULT '',
	"version" integer NOT NULL,
	"changed_at" text,
	"changed_by" text,
	"change_reason" text
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"exam_id" text NOT NULL,
	"num" integer NOT NULL,
	"question_text" text NOT NULL,
	"options" text NOT NULL,
	"answers" text NOT NULL,
	"explanation" text DEFAULT '',
	"source" text DEFAULT '',
	"explanation_sources" text,
	"is_duplicate" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"category" text,
	"created_by" text,
	"created_at" text,
	"added_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"user_email" text NOT NULL,
	"question_id" text NOT NULL,
	"last_correct" integer NOT NULL,
	"attempts" integer DEFAULT 1,
	"correct_count" integer DEFAULT 0,
	"interval_days" integer DEFAULT 1,
	"ease_factor" real DEFAULT 2.5,
	"next_review_at" text,
	"updated_at" text,
	CONSTRAINT "scores_user_email_question_id_pk" PRIMARY KEY("user_email","question_id")
);
--> statement-breakpoint
CREATE TABLE "session_answers" (
	"session_id" text NOT NULL,
	"question_id" text NOT NULL,
	"is_correct" integer NOT NULL,
	"answered_at" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"exam_id" text NOT NULL,
	"mode" text,
	"filter" text,
	"started_at" text,
	"completed_at" text,
	"question_count" integer,
	"correct_count" integer
);
--> statement-breakpoint
CREATE TABLE "study_guides" (
	"exam_id" text PRIMARY KEY NOT NULL,
	"markdown" text NOT NULL,
	"generated_at" text
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"type" text NOT NULL,
	"suggested_answers" text,
	"suggested_explanation" text,
	"ai_model" text,
	"comment" text,
	"created_by" text NOT NULL,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "user_invalidated_questions" (
	"user_email" text NOT NULL,
	"question_id" text NOT NULL,
	CONSTRAINT "user_invalidated_questions_user_email_question_id_pk" PRIMARY KEY("user_email","question_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_email" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" text,
	CONSTRAINT "user_settings_user_email_key_pk" PRIMARY KEY("user_email","key")
);
--> statement-breakpoint
CREATE TABLE "user_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"exam_id" text NOT NULL,
	"ts" integer NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"accuracy" real NOT NULL,
	"created_at" text
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;