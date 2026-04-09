"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Customized,
} from "recharts";
import type { ExamSnapshot } from "@/lib/types";

interface Props {
  snapshots: ExamSnapshot[];
}

const RECENT_SESSIONS = 10;

export default function ExamTrendChart({ snapshots }: Props) {
  const sliced = snapshots.slice(-30);
  const recentStart = Math.max(0, sliced.length - RECENT_SESSIONS);
  const data = sliced.map((s, i) => ({
    label: new Date(s.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    accuracy: s.accuracy,
    recent: i >= recentStart,
  }));

  if (data.length === 0) {
    return (
      <p className="text-xs text-gray-300 py-4 text-center">
        No history yet — answer some questions to see your trend
      </p>
    );
  }

  const boundary = data.length > 1 ? `${(recentStart / (data.length - 1)) * 100}%` : "100%";

  return (
    <ResponsiveContainer width="100%" height={110}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
        <Customized component={() => (
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset={boundary} stopColor="#7c3aed" stopOpacity={0.3} />
              <stop offset={boundary} stopColor="#7c3aed" stopOpacity={1} />
            </linearGradient>
          </defs>
        )} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, "Accuracy"]}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb", padding: "4px 10px" }}
          labelStyle={{ color: "#6b7280", fontSize: 10 }}
        />
        <ReferenceLine y={80} stroke="#d1fae5" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="url(#lineGrad)"
          strokeWidth={2}
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const { cx, cy, index } = props;
            if (cx == null || cy == null || index == null) return <></>;
            const isRecent = data[index]?.recent;
            return (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={2.5}
                fill="#7c3aed"
                opacity={isRecent ? 1 : 0.3}
                stroke="none"
              />
            );
          }}
          activeDot={{ r: 4, fill: "#7c3aed" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
