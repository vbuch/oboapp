import { buttonStyles } from "@/lib/theme";

interface UnsubscribeAllButtonProps {
  readonly onUnsubscribeAll: () => void;
}

export default function UnsubscribeAllButton({
  onUnsubscribeAll,
}: UnsubscribeAllButtonProps) {
  return (
    <button
      onClick={onUnsubscribeAll}
      className={`text-sm ${buttonStyles.linkDestructive}`}
    >
      Отписване от всички устройства
    </button>
  );
}
