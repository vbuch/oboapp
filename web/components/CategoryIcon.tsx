import { CATEGORY_STYLES } from "@/lib/category-styles";
import { Category, UNCATEGORIZED } from "@oboapp/shared";

interface CategoryIconProps {
  readonly category: Category | typeof UNCATEGORIZED;
  readonly size?: number;
  readonly className?: string;
  readonly showBackground?: boolean;
}

/**
 * Renders a category icon with consistent styling
 * Icons from Lucide React library at 20px with 2px stroke width by default
 */
export default function CategoryIcon({
  category,
  size = 20,
  className = "",
  showBackground = false,
}: CategoryIconProps) {
  const style = CATEGORY_STYLES[category];
  const Icon = style.icon;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full p-1 ${className}`}
      style={{
        backgroundColor: showBackground ? style.bgColor : "transparent",
      }}
    >
      <Icon size={size} strokeWidth={2} style={{ color: style.color }} />
    </div>
  );
}
