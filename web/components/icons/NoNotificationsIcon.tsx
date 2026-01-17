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
      {/* Bell icon path */}
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      {/* Diagonal strike line */}
      <path d="m3 3 18 18" />
    </svg>
  );
}
