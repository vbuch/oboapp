/**
 * Reusable red dot indicator for showing unread/active states.
 * Used on notification bell and filter handle.
 */
interface UnreadIndicatorProps {
  readonly borderColor?: string;
}

export default function UnreadIndicator({
  borderColor = "border-white",
}: UnreadIndicatorProps) {
  return (
    <span
      className={`absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border-2 ${borderColor}`}
      aria-hidden="true"
    />
  );
}
