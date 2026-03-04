import Link from "next/link";
import { buttonStyles, buttonSizes, borderRadius } from "@/lib/theme";

interface NotFoundAction {
  readonly href: string;
  readonly label: string;
  readonly variant?: "primary" | "secondary";
}

interface NotFoundLayoutProps {
  readonly title: string;
  readonly description: string;
  readonly actions: ReadonlyArray<NotFoundAction>;
}

export default function NotFoundLayout({
  title,
  description,
  actions,
}: NotFoundLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">{title}</h2>
          <p className="text-gray-600 mb-8">{description}</p>
          <div className="flex gap-4 justify-center flex-wrap">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={`${buttonSizes.md} ${
                  action.variant === "secondary"
                    ? buttonStyles.secondary
                    : buttonStyles.primary
                } ${borderRadius.md}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}