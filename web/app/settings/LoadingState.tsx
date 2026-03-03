export default function LoadingState() {
  return (
    <div
      className="min-h-screen bg-neutral-light flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="text-neutral">Зареждане...</div>
    </div>
  );
}
