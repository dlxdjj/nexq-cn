/**
 * Window switching helpers for the two-window Tauri layout.
 *
 * Keeping show/hide/focus in one place prevents the React view state from
 * drifting away from the actual native windows.
 */
export async function showLauncherWindow(): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const launcher = await WebviewWindow.getByLabel("launcher");
  const overlay = await WebviewWindow.getByLabel("overlay");
  const { emitTo } = await import("@tauri-apps/api/event");
  await emitTo("launcher", "nexq:show_launcher", {}).catch(() => {});

  if (launcher) {
    await launcher.show().catch(() => {});
    await launcher.unminimize().catch(() => {});
    await launcher.setFocus().catch(() => {});
  }

  await overlay?.hide().catch(() => {});
}

export async function showOverlayWindow(): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const overlay = await WebviewWindow.getByLabel("overlay");
  const launcher = await WebviewWindow.getByLabel("launcher");
  const { emitTo } = await import("@tauri-apps/api/event");
  await emitTo("overlay", "nexq:show_overlay", {}).catch(() => {});

  if (overlay) {
    await overlay.show().catch(() => {});
    await overlay.unminimize().catch(() => {});
    await overlay.setFocus().catch(() => {});
  }

  await launcher?.hide().catch(() => {});
}
