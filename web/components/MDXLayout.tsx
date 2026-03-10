import React from "react";
import Link from "next/link";

interface MDXLayoutProps {
  children: React.ReactNode;
}

export default function MDXLayout({ children }: MDXLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link
            href="/"
            className="text-primary hover:text-primary-hover inline-flex items-center gap-2"
          >
            <span>←</span>
            <span>Начало</span>
          </Link>
        </div>
        <article className="bg-white rounded-lg shadow-md p-6 md:p-8 border border-neutral-border prose prose-gray max-w-none">
          {children}
        </article>
      </div>
    </div>
  );
}
