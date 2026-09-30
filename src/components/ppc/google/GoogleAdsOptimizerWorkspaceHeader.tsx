import { Target } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { PpcPlatformPills } from "@/components/ppc/PpcPlatformPills";
import { PpcGoogleWorkspaceModePills } from "@/components/ppc/google/PpcGoogleWorkspaceModePills";
import type { PpcGoogleWorkspaceMode } from "@/components/ppc/google/ppc-google-workspace-mode";
import { GoogleAdsCampaignSetupFlyout } from "@/components/ppc/google/GoogleAdsCampaignSetupFlyout";
import type { PpcGoogleWorkspaceController } from "@/hooks/ppc/use-ppc-google-workspace";

export type GoogleAdsOptimizerWorkspaceHeaderProps = {
  ctrl: PpcGoogleWorkspaceController;
  workspaceMode: PpcGoogleWorkspaceMode;
  onWorkspaceModeChange: (mode: PpcGoogleWorkspaceMode) => void;
  onPlatformChange: (tab: "ppc-google" | "ppc-meta") => void;
};

export function GoogleAdsOptimizerWorkspaceHeader({
  ctrl,
  workspaceMode,
  onWorkspaceModeChange,
  onPlatformChange,
}: GoogleAdsOptimizerWorkspaceHeaderProps) {
  return (
    <UnifiedWorkspaceChrome
      icon={Target}
      title="PPC"
      titleRowMenu={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PpcGoogleWorkspaceModePills
            active={workspaceMode}
            disabled={ctrl.workspaceBusy}
            onSelect={onWorkspaceModeChange}
          />
          <PpcPlatformPills
            active="ppc-google"
            disabled={ctrl.workspaceBusy}
            onSelect={onPlatformChange}
          />
        </div>
      }
      titleRowEnd={
        <GoogleAdsCampaignSetupFlyout
          ctrl={ctrl}
          disabled={ctrl.workspaceBusy}
          align="end"
        />
      }
      toolbar={null}
      workspaceBusy={ctrl.workspaceBusy}
      progressBand="empty"
    />
  );
}
