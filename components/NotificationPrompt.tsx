"use client";

interface NotificationPromptProps {
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

export default function NotificationPrompt({
  onAccept,
  onDecline,
}: NotificationPromptProps) {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg
              className="w-12 h-12 text-blue-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Получавайте известия за събития в района
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Бихте ли искали да получавате известия, когато се публикуват нови
              съобщения в районите, които ви интересуват?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Можете да промените това по всяко време в настройките на браузъра.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onAccept}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Разреши известия
              </button>
              <button
                onClick={onDecline}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                Не сега
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
