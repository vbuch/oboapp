import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Източникът не е намерен
          </h2>
          <p className="text-gray-600 mb-8">
            Източникът, който търсите, не съществува.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/sources"
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Всички източници
            </Link>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-neutral text-white rounded-lg hover:bg-neutral-hover transition-colors"
            >
              Начало
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
