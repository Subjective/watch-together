import { useCallback } from "react";
import { toast } from "./use-toast";
import { StorageManager } from "../background/storage";

type ToastProps = Parameters<typeof toast>[0];

interface ConditionalToastOptions {
  forceShow?: boolean; // Always show regardless of settings (for errors)
}

/**
 * Hook that wraps the toast function to respect user notification preferences
 */
export function useConditionalToast() {
  const conditionalToast = useCallback(
    async (props: ToastProps, options: ConditionalToastOptions = {}) => {
      try {
        // Always show errors regardless of notification settings
        if (options.forceShow || props.variant === "destructive") {
          return toast(props);
        }

        // Check notification preferences for non-error toasts
        const preferences = await StorageManager.getUserPreferences();
        if (preferences.notificationsEnabled) {
          return toast(props);
        }

        // Notifications disabled, don't show toast
        console.log("[ConditionalToast] Notification suppressed:", props.title);
        return { id: "", dismiss: () => {}, update: () => {} };
      } catch (error) {
        console.error("[ConditionalToast] Failed to check preferences:", error);
        // Fallback to showing the toast if we can't check preferences
        return toast(props);
      }
    },
    [],
  );

  return conditionalToast;
}
