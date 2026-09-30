export type PpcGoogleWorkspaceMode = "campaigns" | "optimizer";

export const PPC_GOOGLE_WORKSPACE_MODE_KEY = "neo-pulse-ppc-google-workspace-mode";

export function readPpcGoogleWorkspaceMode(): PpcGoogleWorkspaceMode {
  try {
    const v = sessionStorage.getItem(PPC_GOOGLE_WORKSPACE_MODE_KEY);
    if (v === "optimizer") return "optimizer";
  } catch {
    /* ignore */
  }
  return "campaigns";
}

export function writePpcGoogleWorkspaceMode(mode: PpcGoogleWorkspaceMode): void {
  try {
    sessionStorage.setItem(PPC_GOOGLE_WORKSPACE_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
