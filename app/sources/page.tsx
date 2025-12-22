import { Metadata } from "next";
import sources from "@/lib/sources.json";
import SourceCard from "@/components/SourceCard";

export const metadata: Metadata = {
  title: "Източници - Карта Оборище",
  description: "Източници на данни за събития и уведомления в район Оборище",
};

export default function SourcesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Източници на данни
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </div>
    </div>
  );
}
