import Link from "next/link";
import { Interest } from "@/lib/types";

interface ZoneCardProps {
  readonly interest: Interest;
}

export default function ZoneCard({ interest }: ZoneCardProps) {
  const createdDate = new Date(interest.createdAt).toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      href={`/?lat=${interest.coordinates.lat}&lng=${interest.coordinates.lng}`}
      className="block border border-neutral-border rounded-lg p-4 hover:bg-neutral-light hover:border-info-border transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">
            {interest.coordinates.lat.toFixed(5)},{" "}
            {interest.coordinates.lng.toFixed(5)}
          </p>
          <p className="text-sm text-neutral">
            Радиус: {interest.radius}м • Добавена: {createdDate}
          </p>
        </div>
        <div className="text-primary">→</div>
      </div>
    </Link>
  );
}
