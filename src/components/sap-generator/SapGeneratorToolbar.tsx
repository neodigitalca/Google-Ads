import { Loader2, Trash2, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import {
  GENERATOR_EXPORT_BTN,
  GENERATOR_FIELD_COUNT,
  GENERATOR_FIELD_KEYWORD,
  GENERATOR_FIELD_URL,
  GENERATOR_SELECT,
} from "@/components/blog-generator/generator-toolbar-theme";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_HEADER_UPLOAD_READY_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  entityTypeShortLabel,
  entityTypesForLevel,
  type EntityGeographicLevel,
} from "@/lib/entity-geographic-level";
import { normalizeEntityCountInputChange } from "@/lib/local-analysis/entity-ad-group-budget";
import { cn } from "@/lib/utils";

export type SapGeneratorToolbarProps = {
  workspaceBusy: boolean;
  csvParsing: boolean;
  uploadLabel: string;
  entityTotalCountInput: string;
  onEntityTotalCountInputChange: (v: string) => void;
  suggestFocusKeyword: string;
  onSuggestFocusKeywordChange: (v: string) => void;
  suggestFocusLocation: string;
  onSuggestFocusLocationChange: (v: string) => void;
  runLoading: boolean;
  onPickFile: (file: File | null) => void;
  onRunClusters: () => void;
  onClear: () => void;
  entityGeographicLevel: EntityGeographicLevel;
  entityTypeFocus: string[];
  onEntityTypeFocusChange: (focus: string[]) => void;
  hasSapRowsForCsv: boolean;
  onDownloadTargetsCsv: () => void;
  showTempUrl?: boolean;
  tempSeedUrl?: string;
  onTempSeedUrlChange?: (v: string) => void;
  showBlindMagicKeywords?: boolean;
  useBlindMagicKeywords?: boolean;
  onUseBlindMagicKeywordsChange?: (v: boolean) => void;
  onApplyRemainingEntityCount: () => void;
};

export function SapGeneratorToolbar({
  workspaceBusy,
  csvParsing,
  uploadLabel,
  entityTotalCountInput,
  onEntityTotalCountInputChange,
  suggestFocusKeyword,
  onSuggestFocusKeywordChange,
  suggestFocusLocation,
  onSuggestFocusLocationChange,
  runLoading,
  onPickFile,
  onRunClusters,
  onClear,
  entityGeographicLevel,
  entityTypeFocus,
  onEntityTypeFocusChange,
  hasSapRowsForCsv,
  onDownloadTargetsCsv,
  showTempUrl = false,
  tempSeedUrl = "",
  onTempSeedUrlChange,
  showBlindMagicKeywords = false,
  useBlindMagicKeywords = false,
  onUseBlindMagicKeywordsChange,
  onApplyRemainingEntityCount,
}: SapGeneratorToolbarProps) {
  const focusSelectValue =
    entityTypeFocus.find((t) => entityTypesForLevel(entityGeographicLevel).includes(t)) ?? "__none__";

  return (
    <GeneratorToolbarFrame
      primary={
        <>
          <input
            id="sap-grid-csv-upload"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              onPickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {showTempUrl && onTempSeedUrlChange ? (
            <Input
              type="url"
              className={GENERATOR_FIELD_URL}
              placeholder="https://example.com"
              value={tempSeedUrl}
              onChange={(e) => onTempSeedUrlChange(e.target.value)}
              disabled={workspaceBusy}
              aria-label="Website URL"
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              uploadLabel.trim() ? BULK_HEADER_UPLOAD_READY_BTN : BULK_HEADER_TOOL_BTN,
            )}
            disabled={csvParsing}
            onClick={() => document.getElementById("sap-grid-csv-upload")?.click()}
          >
            {csvParsing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
            )}
            Grid
          </Button>
          <Input
            type="text"
            placeholder="Keyword"
            value={suggestFocusKeyword}
            onChange={(e) => onSuggestFocusKeywordChange(e.target.value)}
            className={GENERATOR_FIELD_KEYWORD}
            disabled={runLoading}
            autoComplete="off"
            aria-label="Keyword"
          />
          <Input
            type="text"
            placeholder="Location"
            value={suggestFocusLocation}
            onChange={(e) => onSuggestFocusLocationChange(e.target.value)}
            className={GENERATOR_FIELD_KEYWORD}
            disabled={runLoading}
            autoComplete="off"
            aria-label="Location"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(BULK_HEADER_TOOL_BTN, "h-8 w-8 shrink-0 p-0")}
            disabled={workspaceBusy || runLoading}
            aria-label="Apply remaining entity count for this period"
            title="No grid: fills Location from site city if empty. Sets entity count to 15 minus published this period (manual, no AI)."
            onClick={onApplyRemainingEntityCount}
          >
            <Wand2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          </Button>
          <Input
            type="text"
            inputMode="numeric"
            placeholder=""
            value={entityTotalCountInput}
            onChange={(e) =>
              onEntityTotalCountInputChange(normalizeEntityCountInputChange(e.target.value))
            }
            className={GENERATOR_FIELD_COUNT}
            disabled={runLoading}
            autoComplete="off"
            aria-label="Entity count"
            maxLength={3}
          />
        </>
      }
      options={
        <>
        {showBlindMagicKeywords && onUseBlindMagicKeywordsChange ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              useBlindMagicKeywords ? BULK_HEADER_UPLOAD_READY_BTN : BULK_HEADER_TOOL_BTN,
            )}
            disabled={workspaceBusy}
            aria-pressed={useBlindMagicKeywords}
            aria-label="Use Blind Magic keywords"
            title="Use Blind Magic GSC keywords"
            onClick={() => onUseBlindMagicKeywordsChange(!useBlindMagicKeywords)}
          >
            Blind Magic
          </Button>
        ) : null}
        <Select
          value={focusSelectValue}
          onValueChange={(v) => {
            if (v === "__none__") {
              onEntityTypeFocusChange([]);
              return;
            }
            onEntityTypeFocusChange([v]);
          }}
        >
          <SelectTrigger className={GENERATOR_SELECT} aria-label="Entity type focus">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-[min(24rem,70vh)]">
            <SelectItem className="text-base" value="__none__">
              None
            </SelectItem>
            {entityTypesForLevel(entityGeographicLevel).map((label) => (
              <SelectItem key={label} className="text-base" value={label}>
                {entityTypeShortLabel(entityGeographicLevel, label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </>
      }
      actions={
        <>
          <Button
            type="button"
            size="sm"
            className={BULK_HEADER_RUN_BTN}
            disabled={workspaceBusy}
            aria-label="Run clusters"
            title="Run clusters"
            onClick={() => void onRunClusters()}
          >
            {runLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            )}
            Clusters
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={GENERATOR_EXPORT_BTN}
            disabled={!hasSapRowsForCsv || workspaceBusy}
            aria-label="Download bulk CSV"
            title="Download bulk CSV (bulk-auto-generate-template columns)"
            onClick={onDownloadTargetsCsv}
          >
            Bulk CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 border border-red-600/70 bg-black p-0 text-red-500 hover:bg-red-950/50 hover:text-red-400"
            disabled={workspaceBusy}
            aria-label="Clear"
            title="Clear"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </>
      }
    />
  );
}
