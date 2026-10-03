import { toast } from "sonner";
import { hapticError } from "@/lib/haptics";

/**
 * Error message for a failed save or action, with the matching error haptic
 * (see haptics.ts). Same arguments as sonner's toast.error.
 */
export const toastError: typeof toast.error = (message, data) => {
  hapticError();
  return toast.error(message, data);
};
