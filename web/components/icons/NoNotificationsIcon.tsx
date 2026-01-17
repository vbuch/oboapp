import { SVGProps } from "react";

interface NoNotificationsIconProps extends SVGProps<SVGSVGElement> {
  readonly className?: string;
}

export default function NoNotificationsIcon({
  className,
  ...props
}: NoNotificationsIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...props}
    >
      <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}
