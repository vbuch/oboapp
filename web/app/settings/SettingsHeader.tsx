import BackButton from "@/components/BackButton";

export default function SettingsHeader() {
  return (
    <div className="mb-8">
      <BackButton href="/" label="Начало" />
      <h1 className="text-3xl font-bold text-gray-900 mt-4">Настройки</h1>
    </div>
  );
}
