interface ErrorBannerProps {
  readonly message: string;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="mb-6 bg-error-light border border-error-border rounded-lg p-4 text-error">
      {message}
    </div>
  );
}
