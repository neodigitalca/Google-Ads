import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { PpcGoogleWorkspaceMode } from "@/components/ppc/google/ppc-google-workspace-mode";

export type PpcGoogleWorkspaceModePillsProps = {
  active: PpcGoogleWorkspaceMode;
  onSelect: (mode: PpcGoogleWorkspaceMode) => void;
  disabled?: boolean;
};

export function PpcGoogleWorkspaceModePills({
  active,
  onSelect,
  disabled = false,
}: PpcGoogleWorkspaceModePillsProps) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" role="group" aria-label="PPC Google workspace mode">
      <WorkspacePill
        label="Campaigns"
        active={active === "campaigns"}
        square
        disabled={disabled}
        onClick={() => onSelect("campaigns")}
      />
      <WorkspacePill
        label="Optimizer"
        active={active === "optimizer"}
        square
        disabled={disabled}
        onClick={() => onSelect("optimizer")}
      />
    </div>
  );
}
