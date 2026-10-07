import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, Save } from "lucide-react";
import { type WordPressSite } from "../types";
import { IMAGE_MODEL_PRESETS } from "@/lib/image-model-defaults";
import {
  DEFAULT_SETTINGS,
  type OptimizationSettings,
} from "@/lib/optimization-settings-defaults";
import { TEXT_AGENT_MODEL_PRESETS } from "@/lib/global-agent-models";

export type { OptimizationSettings } from "@/lib/optimization-settings-defaults";
export { DEFAULT_SETTINGS } from "@/lib/optimization-settings-defaults";

function buildModelOptions(
  presets: { value: string; label: string }[],
  customModels: string[],
  currentValue: string,
): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const p of presets) {
    map.set(p.value, p.label);
  }
  for (const id of customModels) {
    if (!map.has(id)) {
      map.set(id, id);
    }
  }
  if (currentValue && !map.has(currentValue)) {
    map.set(currentValue, currentValue);
  }
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
}

type ModelFieldKey =
  | "model"
  | "researchModel"
  | "imageModel"
  | "metaModel"
  | "reportModel"
  | "adsModel";

interface OptimizationModelSelectProps {
  label: string;
  description?: string;
  value: string;
  presets: { value: string; label: string }[];
  customModels: string[];
  onSelect: (value: string) => void;
  onSaveCustom: (modelId: string) => void;
  disabled?: boolean;
}

const OptimizationModelSelect: React.FC<OptimizationModelSelectProps> = ({
  label,
  description,
  value,
  presets,
  customModels,
  onSelect,
  onSaveCustom,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const options = useMemo(
    () => buildModelOptions(presets, customModels, value),
    [presets, customModels, value],
  );

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setDraft("");
    }
  }, []);

  const commitDraft = useCallback(() => {
    const id = draft.trim();
    if (!id) return;
    onSaveCustom(id);
    setDraft("");
    setOpen(false);
  }, [draft, onSaveCustom]);

  const inputClasses =
    "h-8 min-h-8 flex-1 min-w-0 font-mono text-xs";

  return (
    <div className="space-y-2">
      <Label className="block text-xs font-medium text-muted-foreground">{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      <Select
        open={open}
        onOpenChange={handleOpenChange}
        value={value}
        onValueChange={(v) => {
          onSelect(v);
          setOpen(false);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select model…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
          <SelectSeparator />
          <div className="p-1.5" onPointerDown={(e) => e.preventDefault()}>
            <div className="flex items-center gap-1.5">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
                placeholder="openai/gpt-4o…"
                disabled={disabled}
                className={inputClasses}
                aria-label="Custom OpenRouter model id"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || !draft.trim()}
                className="h-8 w-8 shrink-0"
                title="Save custom model"
                onClick={commitDraft}
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
};

interface OptimizationSettingsPanelProps {
  site: WordPressSite;
  settings: OptimizationSettings;
  onSettingsChange: (settings: OptimizationSettings) => void;
  disabled?: boolean;
}

export const OptimizationSettingsPanel: React.FC<OptimizationSettingsPanelProps> = ({
  site: _site,
  settings,
  onSettingsChange,
  disabled = false,
}) => {
  const customModels = settings.customModels ?? [];

  const saveCustomModelForField = (field: ModelFieldKey, rawId: string) => {
    const id = rawId.trim();
    if (!id) return;
    const nextCustom = customModels.includes(id) ? customModels : [...customModels, id];
    onSettingsChange({
      ...settings,
      customModels: nextCustom,
      [field]: id,
    });
  };

  const handleSliderChange = (setter: (v: number) => void) => (values: number[]) => {
    setter(values[0]);
  };

  const handleInputChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setter(value);
    }
  };

  const handleMaxTokensInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      onSettingsChange({ ...settings, maxTokens: value });
    }
  };

  const handleReset = () => {
    onSettingsChange(DEFAULT_SETTINGS);
  };

  const isDefault =
    settings.model === DEFAULT_SETTINGS.model &&
    settings.researchModel === DEFAULT_SETTINGS.researchModel &&
    settings.imageModel === DEFAULT_SETTINGS.imageModel &&
    settings.metaModel === DEFAULT_SETTINGS.metaModel &&
    settings.reportModel === DEFAULT_SETTINGS.reportModel &&
    settings.adsModel === DEFAULT_SETTINGS.adsModel &&
    customModels.length === 0 &&
    settings.temperature === DEFAULT_SETTINGS.temperature &&
    settings.maxTokens === DEFAULT_SETTINGS.maxTokens &&
    settings.topP === DEFAULT_SETTINGS.topP;

  return (
    <Card className="mt-2 w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">
          Optimization Settings
          {!isDefault && (
            <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">(Custom)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <OptimizationModelSelect
          label="Research agent"
          description="Checklist, blueprint, briefs, and featured-image planning."
          value={settings.researchModel}
          presets={TEXT_AGENT_MODEL_PRESETS}
          customModels={customModels}
          onSelect={(v) => onSettingsChange({ ...settings, researchModel: v })}
          onSaveCustom={(id) => saveCustomModelForField("researchModel", id)}
          disabled={disabled}
        />

        <OptimizationModelSelect
          label="Blog agent"
          description="Harness sections, WordPress title, and meta description."
          value={settings.model}
          presets={TEXT_AGENT_MODEL_PRESETS}
          customModels={customModels}
          onSelect={(v) => onSettingsChange({ ...settings, model: v })}
          onSaveCustom={(id) => saveCustomModelForField("model", id)}
          disabled={disabled}
        />

        <OptimizationModelSelect
          label="Image agent"
          description="Generated featured and in-content images."
          value={settings.imageModel}
          presets={IMAGE_MODEL_PRESETS}
          customModels={customModels}
          onSelect={(v) => onSettingsChange({ ...settings, imageModel: v })}
          onSaveCustom={(id) => saveCustomModelForField("imageModel", id)}
          disabled={disabled}
        />

        <OptimizationModelSelect
          label="Meta agent"
          description="Overview SAP meta descriptions, titles, and FAQ copy."
          value={settings.metaModel}
          presets={TEXT_AGENT_MODEL_PRESETS}
          customModels={customModels}
          onSelect={(v) => onSettingsChange({ ...settings, metaModel: v })}
          onSaveCustom={(id) => saveCustomModelForField("metaModel", id)}
          disabled={disabled}
        />

        <OptimizationModelSelect
          label="Report agent"
          description="GSC reporting outline and section writers."
          value={settings.reportModel}
          presets={TEXT_AGENT_MODEL_PRESETS}
          customModels={customModels}
          onSelect={(v) => onSettingsChange({ ...settings, reportModel: v })}
          onSaveCustom={(id) => saveCustomModelForField("reportModel", id)}
          disabled={disabled}
        />

        <OptimizationModelSelect
          label="Ads agent"
          description="Google Ads and PPC reporting LLM steps."
          value={settings.adsModel}
          presets={TEXT_AGENT_MODEL_PRESETS}
          customModels={customModels}
          onSelect={(v) => onSettingsChange({ ...settings, adsModel: v })}
          onSaveCustom={(id) => saveCustomModelForField("adsModel", id)}
          disabled={disabled}
        />

        <div className="space-y-2">
          <Label className="block text-xs font-medium text-muted-foreground">
            Temperature: {settings.temperature.toFixed(2)}
          </Label>
          <Slider
            min={0.0}
            max={2.0}
            step={0.01}
            value={[settings.temperature]}
            onValueChange={handleSliderChange((value) =>
              onSettingsChange({ ...settings, temperature: value })
            )}
            disabled={disabled}
            className="w-full"
          />
          <Input
            type="number"
            step="0.01"
            min="0.0"
            max="2.0"
            value={settings.temperature}
            onChange={handleInputChange((value) =>
              onSettingsChange({ ...settings, temperature: value })
            )}
            disabled={disabled}
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Controls randomness. Lower = more deterministic, Higher = more creative. (0.0 - 2.0)
          </p>
        </div>

        <div className="space-y-2">
          <Label className="block text-xs font-medium text-muted-foreground">
            Top P: {settings.topP.toFixed(2)}
          </Label>
          <Slider
            min={0.0}
            max={1.0}
            step={0.01}
            value={[settings.topP]}
            onValueChange={handleSliderChange((value) =>
              onSettingsChange({ ...settings, topP: value })
            )}
            disabled={disabled}
            className="w-full"
          />
          <Input
            type="number"
            step="0.01"
            min="0.0"
            max="1.0"
            value={settings.topP}
            onChange={handleInputChange((value) =>
              onSettingsChange({ ...settings, topP: value })
            )}
            disabled={disabled}
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Controls diversity via nucleus sampling. Lower = more focused. (0.0 - 1.0)
          </p>
        </div>

        <div className="space-y-2">
          <Label className="block text-xs font-medium text-muted-foreground">
            Max Tokens: {settings.maxTokens}
          </Label>
          <Input
            type="number"
            step="1"
            min="1"
            value={settings.maxTokens}
            onChange={handleMaxTokensInputChange}
            disabled={disabled}
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of tokens to generate. Controls response length.
          </p>
        </div>

        {!isDefault && (
          <Button variant="outline" size="sm" onClick={handleReset} disabled={disabled} className="h-7 w-full text-xs">
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset to Defaults
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
