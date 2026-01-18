import { SVGProps } from "react";

interface PlusIconProps extends SVGProps<SVGSVGElement> {
  readonly className?: string;
}

export default function PlusIcon({ className, ...props }: PlusIconProps) {
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
      <path d="M12 4v16m8-8H4"></path>
    </svg>
  );
}
