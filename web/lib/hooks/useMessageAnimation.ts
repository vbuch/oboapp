import { useEffect, useReducer } from "react";
import { Message } from "@/lib/types";

/**
 * Custom hook to manage message detail view animation state.
 * Resets visibility when message changes and animates in smoothly.
 *
 * @param message - The current message to display
 * @returns isVisible - Whether the animation should show the content
 */
export function useMessageAnimation(message: Message | null): boolean {
  const [animationState, dispatch] = useReducer(
    (
      state: { messageId: string | null; isVisible: boolean },
      action: { type: "MESSAGE_CHANGED"; messageId: string | null } | { type: "SHOW" }
    ) => {
      switch (action.type) {
        case "MESSAGE_CHANGED":
          return { messageId: action.messageId, isVisible: false };
        case "SHOW":
          return { ...state, isVisible: true };
        default:
          return state;
      }
    },
    { messageId: null, isVisible: false }
  );

  const messageId = message?.id || null;

  // Dispatch message change action when message ID changes
  useEffect(() => {
    if (messageId !== animationState.messageId) {
      dispatch({ type: "MESSAGE_CHANGED", messageId });
    }
  }, [messageId, animationState.messageId]);

  // Trigger animation after message change
  useEffect(() => {
    if (message && !animationState.isVisible && messageId === animationState.messageId) {
      // Use requestAnimationFrame to ensure DOM is ready for animation
      const frame = requestAnimationFrame(() => dispatch({ type: "SHOW" }));
      return () => cancelAnimationFrame(frame);
    }
  }, [message, animationState.isVisible, messageId, animationState.messageId]);

  return animationState.isVisible;
}
