import { create } from "zustand";
import { translateUiText } from "../lib/chineseUi";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const localizedMessage = translateUiText(message);
    // Deduplicate: skip if an identical message is already visible
    const existing = useToastStore.getState().toasts;
    if (existing.some((t) => t.message === localizedMessage && t.type === type)) return;

    const id = crypto.randomUUID();
    const toast: Toast = { id, message: localizedMessage, type, createdAt: Date.now() };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

/**
 * Show a toast notification from anywhere (does not require React context).
 */
export function showToast(message: string, type: ToastType = "info") {
  useToastStore.getState().addToast(message, type);
}
