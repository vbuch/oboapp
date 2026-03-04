import NotFoundLayout from "@/components/NotFoundLayout";

export default function NotFound() {
  return (
    <NotFoundLayout
      title="Източникът не е намерен"
      description="Източникът, който търсите, не съществува."
      actions={[
        { href: "/sources", label: "Всички източници", variant: "primary" },
        { href: "/", label: "Начало", variant: "secondary" },
      ]}
    />
  );
}
