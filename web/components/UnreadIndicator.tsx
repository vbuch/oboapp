/**
 * Reusable red dot indicator for showing unread/active states.
 * Used on notification bell and filter handle.
 * Always uses white border as specified in design requirements.
 */
export default function UnreadIndicator() {
  return (
    <span
      className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-white"
      aria-hidden="true"
    />
  );
}
