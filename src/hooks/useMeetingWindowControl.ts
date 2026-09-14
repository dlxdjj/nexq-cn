import { useEffect } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { endMeetingOnce } from "../lib/meetingControl";
import { useConfigStore } from "../stores/configStore";
import { useMeetingStore } from "../stores/meetingStore";
import { useTranscriptStore } from "../stores/transcriptStore";
import { useStreamStore } from "../stores/streamStore";
import { useTranslationStore } from "../stores/translationStore";
import { useSpeakerStore } from "../stores/speakerStore";

export function useMeetingWindowControl() {
  useEffect(() => {
    const subscriptions = [
      listen<{ you: boolean; them: boolean }>("nexq:mute_changed", ({ payload }) => {
        useConfigStore.setState({ mutedYou: payload.you, mutedThem: payload.them });
      }),
      listen<boolean>("nexq:translation_session", ({ payload }) => {
        useTranslationStore.setState({ autoTranslateActive: payload });
      }),
    ];
    if (getCurrentWebviewWindow().label === "launcher") {
      subscriptions.push(listen("nexq:show_launcher", () => {
        const store = useMeetingStore.getState();
        if (store.currentView !== "settings") store.setCurrentView("launcher");
      }));
      subscriptions.push(listen<{ requestId: string }>("nexq:request_end_meeting", async ({ payload }) => {
        let error: string | undefined;
        try { await endMeetingOnce(); } catch (cause) { error = String(cause); }
        await emitTo("overlay", "nexq:end_result", { requestId: payload.requestId, error });
      }));
    } else {
      subscriptions.push(listen("nexq:show_overlay", () => {
        const store = useMeetingStore.getState();
        if (store.activeMeeting) store.setCurrentView("overlay");
      }));
      subscriptions.push(listen("nexq:meeting_ended", () => {
        useSpeakerStore.getState().reset();
        useMeetingStore.getState().stopTimer();
        useMeetingStore.setState({ activeMeeting: null, currentView: "launcher", isRecording: false, elapsedMs: 0 });
        useTranscriptStore.getState().clearSegments();
        useStreamStore.getState().clearCurrent();
        useStreamStore.setState({ responseHistory: [], pinnedResponses: [] });
        useTranslationStore.getState().clearTranslations();
      }));
      subscriptions.push(listen<{ audioMode: string }>("nexq:meeting_started", ({ payload }) => {
        if (payload.audioMode === "online") useSpeakerStore.getState().initForOnline();
        else useSpeakerStore.getState().initForInPerson(useConfigStore.getState().diarizationEnabled);
        useTranscriptStore.getState().clearSegments();
        useStreamStore.getState().clearCurrent();
        useStreamStore.setState({ responseHistory: [], pinnedResponses: [] });
        useTranslationStore.getState().clearTranslations();
      }));
    }
    return () => { subscriptions.forEach((subscription) => subscription.then((stop) => stop())); };
  }, []);
}
