import { useEffect, useState } from "react";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { GoogleAdsCampaignsSection } from "@/components/ppc/google/GoogleAdsCampaignsSection";
import { GoogleAdsOptimizerWorkspace } from "@/components/ppc/google/GoogleAdsOptimizerWorkspace";
import { GoogleAdsOptimizerWorkspaceHeader } from "@/components/ppc/google/GoogleAdsOptimizerWorkspaceHeader";
import { GoogleAdsWorkspaceHeader } from "@/components/ppc/google/GoogleAdsWorkspaceHeader";
import {
  readPpcGoogleWorkspaceMode,
  writePpcGoogleWorkspaceMode,
  type PpcGoogleWorkspaceMode,
} from "@/components/ppc/google/ppc-google-workspace-mode";
import {
  CONTENT_OPTIMIZER_BODY_INSET_CLASS,
  CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { usePpcGoogleWorkspace } from "@/hooks/ppc/use-ppc-google-workspace";
import type { WordPressSite } from "@/components/integrations/types";
import { cn } from "@/lib/utils";

export type GoogleAdsCampaignWorkspaceProps = {
  site: WordPressSite;
  apiKey: string;
  selectedModel: string;
  onPlatformChange: (tab: "ppc-google" | "ppc-meta") => void;
};

export function GoogleAdsCampaignWorkspace({
  site,
  apiKey,
  selectedModel,
  onPlatformChange,
}: GoogleAdsCampaignWorkspaceProps) {
  const ctrl = usePpcGoogleWorkspace({ site, apiKey, selectedModel });
  const [workspaceMode, setWorkspaceMode] = useState<PpcGoogleWorkspaceMode>(() => readPpcGoogleWorkspaceMode());

  useEffect(() => {
    writePpcGoogleWorkspaceMode(workspaceMode);
  }, [workspaceMode]);

  return (
    <div className={CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        {workspaceMode === "optimizer" ? (
          <GoogleAdsOptimizerWorkspaceHeader
            ctrl={ctrl}
            workspaceMode={workspaceMode}
            onWorkspaceModeChange={setWorkspaceMode}
            onPlatformChange={onPlatformChange}
          />
        ) : (
          <GoogleAdsWorkspaceHeader
            ctrl={ctrl}
            workspaceMode={workspaceMode}
            onWorkspaceModeChange={setWorkspaceMode}
            onPlatformChange={onPlatformChange}
          />
        )}
      </div>
      <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, CONTENT_OPTIMIZER_BODY_INSET_CLASS, "flex flex-col")}>
        {workspaceMode === "optimizer" ? (
          <GoogleAdsOptimizerWorkspace ctrl={ctrl} />
        ) : (
          <GoogleAdsCampaignsSection ctrl={ctrl} />
        )}
      </div>
    </div>
  );
}
