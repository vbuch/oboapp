import React from "react";

interface DetailItemProps {
  title: string;
  children: React.ReactNode;
}

export default function DetailItem({ title, children }: DetailItemProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-neutral mb-1">{title}</h3>
      <div>{children}</div>
    </div>
  );
}
