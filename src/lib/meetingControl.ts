import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useMeetingStore } from "../stores/meetingStore";

let ending: Promise<void> | null = null;
export function endMeetingOnce(): Promise<void> {
  if (!ending) {
    ending = useMeetingStore.getState().endMeetingFlow().finally(() => { ending = null; });
  }
  return ending;
}

/** The launcher owns persistence; don't save the overlay's incomplete copy. */
export async function requestMeetingEnd(): Promise<void> {
  if (getCurrentWebviewWindow().label === "launcher") return endMeetingOnce();
  const requestId = crypto.randomUUID();
  let unlisten: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("结束会议确认超时，请使用 Ctrl+M 或检查主窗口。")), 30000);
      listen<{ requestId: string; error?: string }>("nexq:end_result", (event) => {
        if (event.payload.requestId !== requestId) return;
        if (event.payload.error) reject(new Error(event.payload.error)); else resolve();
      }).then((stop) => {
        unlisten = stop;
        return emitTo("launcher", "nexq:request_end_meeting", { requestId });
      }).catch(reject);
    });
  } finally {
    if (timer) clearTimeout(timer);
    unlisten?.();
  }
}
