"use client";

import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";

interface Props {
  back?: { href: string; label?: string };
  title?: string;
  right?: React.ReactNode;
}

export default function PageHeader({ back, title, right }: Props) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 shrink-0 flex items-center px-4 sm:px-8">
      <div className="flex items-center gap-3 w-full">
        {back ? (
          <Link
            href={back.href}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
        ) : (
          <span className="text-sm font-semibold text-gray-900">Cert Practice</span>
        )}
        {title && (
          <>
            <span className="text-gray-200 select-none">·</span>
            <span className="text-sm text-gray-500 font-medium">{title}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {right}
          <Link
            href="/settings"
            className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Settings"
          >
            <Settings size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
