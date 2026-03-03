interface UserSilhouetteIconProps {
  readonly className?: string;
}

export default function UserSilhouetteIcon({
  className = "w-5 h-5",
}: UserSilhouetteIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a3.25 3.25 0 110 6.5A3.25 3.25 0 0112 6zm0 14a7.96 7.96 0 01-5.38-2.08A5.74 5.74 0 0112 14c2.2 0 4.18 1.24 5.38 3.92A7.96 7.96 0 0112 20z" />
    </svg>
  );
}
