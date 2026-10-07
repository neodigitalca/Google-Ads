import React, { useEffect, useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import { DashboardAgentModelSelect } from "@/components/manager/DashboardAgentModelSelect";
import {
  IMAGE_MODEL_PRESETS,
  TEXT_AGENT_MODEL_PRESETS,
} from "@/lib/global-agent-models";
import type { OpenRouterModelCatalogEntry } from "@/lib/openrouter-app-api";
import { fetchOpenRouterModelsCatalog } from "@/lib/openrouter-models-catalog";
import {
  estimateAgentRunCostUsd,
  formatBlogTokenWorkloadHint,
  formatResearchTokenWorkloadHint,
} from "@/lib/agent-pipeline-cost-estimates";

export interface LLMSettingsTabContentProps {
  researchModel: string;
  onResearchModelChange: (model: string) => void;
  blogModel: string;
  onBlogModelChange: (model: string) => void;
  imageModel: string;
  onImageModelChange: (model: string) => void;
  metaModel: string;
  onMetaModelChange: (model: string) => void;
  reportModel: string;
  onReportModelChange: (model: string) => void;
  adsModel: string;
  onAdsModelChange: (model: string) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
}

export const LLMParameterControls: React.FC<{
  temperature: number;
  onTemperatureChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
}> = (props) => {
  const tempId = React.useId();
  const topPId = React.useId();
  const maxTokId = React.useId();

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
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      props.onMaxTokensChange(value);
    }
  };

  const tileClass = "flex min-w-0 flex-col gap-2 bg-zinc-900 p-2";
  const fieldClass = `${DASHBOARD_SETTINGS_FIELD_CLASS} h-10 w-full tabular-nums shadow-none focus-visible:ring-2 focus-visible:ring-white/35`;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className={tileClass}>
        <Label htmlFor={tempId} className="text-base font-semibold text-white">
          Temperature
        </Label>
        <Slider
          min={0.0}
          max={2.0}
          step={0.01}
          value={[props.temperature]}
          onValueChange={handleSliderChange(props.onTemperatureChange)}
          className="w-full"
        />
        <Input
          id={tempId}
          type="number"
          step="0.01"
          min="0.0"
          max="2.0"
          value={String(props.temperature)}
          onChange={handleInputChange(props.onTemperatureChange)}
          className={fieldClass}
          aria-label="Temperature"
        />
      </div>

      <div className={tileClass}>
        <Label htmlFor={topPId} className="text-base font-semibold text-white">
          Top P
        </Label>
        <Slider
          min={0.0}
          max={1.0}
          step={0.01}
          value={[props.topP]}
          onValueChange={handleSliderChange(props.onTopPChange)}
          className="w-full"
        />
        <Input
          id={topPId}
          type="number"
          step="0.01"
          min="0.0"
          max="1.0"
          value={String(props.topP)}
          onChange={handleInputChange(props.onTopPChange)}
          className={fieldClass}
          aria-label="Top P"
        />
      </div>

      <div className={tileClass}>
        <Label htmlFor={maxTokId} className="text-base font-semibold text-white">
          Max tokens
        </Label>
        <Input
          id={maxTokId}
          type="number"
          step="1"
          min="1"
          placeholder="Max tokens"
          value={String(props.maxTokens)}
          onChange={handleMaxTokensInputChange}
          className={fieldClass}
          aria-label="Max tokens"
        />
      </div>
    </div>
  );
};

/** Dashboard → AI & Models: six pipeline agents + sampling. */
export const LLMSettingsTabContent: React.FC<LLMSettingsTabContentProps> = ({
  researchModel,
  onResearchModelChange,
  blogModel,
  onBlogModelChange,
  imageModel,
  onImageModelChange,
  metaModel,
  onMetaModelChange,
  reportModel,
  onReportModelChange,
  adsModel,
  onAdsModelChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
  topP,
  onTopPChange,
}) => {
  const [catalog, setCatalog] = useState<OpenRouterModelCatalogEntry[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setCatalogLoading(true);
      const result = await fetchOpenRouterModelsCatalog();
      if (cancelled) return;
      setCatalog(result.models.length > 0 ? result.models : null);
      setCatalogError(result.error?.trim() || null);
      setCatalogLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const researchWorkloadHint = useMemo(
    () =>
      estimateAgentRunCostUsd({
        agent: "research",
        modelId: researchModel,
        catalog,
      }).label,
    [catalog, researchModel],
  );

  const blogWorkloadHint = useMemo(
    () =>
      `${formatBlogTokenWorkloadHint()} · ${estimateAgentRunCostUsd({
        agent: "blog",
        modelId: blogModel,
        catalog,
      }).label}`,
    [blogModel, catalog],
  );

  const imageWorkloadHint = useMemo(
    () =>
      estimateAgentRunCostUsd({
        agent: "image",
        modelId: imageModel,
        catalog,
      }).label,
    [catalog, imageModel],
  );

  const metaWorkloadHint = useMemo(
    () =>
      estimateAgentRunCostUsd({
        agent: "meta",
        modelId: metaModel,
        catalog,
      }).label,
    [catalog, metaModel],
  );

  const reportWorkloadHint = useMemo(
    () =>
      `${formatResearchTokenWorkloadHint()} · ${estimateAgentRunCostUsd({
        agent: "report",
        modelId: reportModel,
        catalog,
      }).label}`,
    [catalog, reportModel],
  );

  const adsWorkloadHint = useMemo(
    () =>
      estimateAgentRunCostUsd({
        agent: "ads",
        modelId: adsModel,
        catalog,
      }).label,
    [catalog, adsModel],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold text-white">Pipeline agents</p>
          <p className="mt-1 text-base text-white/90">
            Pick a different OpenRouter model for each agent. Per-site Optimization Settings override these when set.
          </p>
          {catalogError ? (
            <p className="mt-2 text-base text-amber-200/90">
              OpenRouter catalog unavailable ({catalogError}). Presets still work; add an API key or retry.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <DashboardAgentModelSelect
            tile
            label="Research agent"
            description="Checklist, blueprint, briefs, featured-image planning."
            value={researchModel}
            presets={TEXT_AGENT_MODEL_PRESETS}
            onChange={onResearchModelChange}
            agentKind="research"
            catalog={catalog}
            catalogLoading={catalogLoading}
            workloadHint={`${formatResearchTokenWorkloadHint()} · ${researchWorkloadHint}`}
          />
          <DashboardAgentModelSelect
            tile
            label="Blog agent"
            description="Harness sections, WordPress title, meta description."
            value={blogModel}
            presets={TEXT_AGENT_MODEL_PRESETS}
            onChange={onBlogModelChange}
            agentKind="blog"
            catalog={catalog}
            catalogLoading={catalogLoading}
            workloadHint={blogWorkloadHint}
          />
          <DashboardAgentModelSelect
            tile
            label="Image agent"
            description="Featured and in-content image generation."
            value={imageModel}
            presets={IMAGE_MODEL_PRESETS}
            onChange={onImageModelChange}
            agentKind="image"
            catalog={catalog}
            catalogLoading={catalogLoading}
            workloadHint={imageWorkloadHint}
          />
          <DashboardAgentModelSelect
            tile
            label="Meta agent"
            description="Overview SAP meta descriptions, titles, and FAQ copy."
            value={metaModel}
            presets={TEXT_AGENT_MODEL_PRESETS}
            onChange={onMetaModelChange}
            agentKind="meta"
            catalog={catalog}
            catalogLoading={catalogLoading}
            workloadHint={metaWorkloadHint}
          />
          <DashboardAgentModelSelect
            tile
            label="Report agent"
            description="GSC reporting outline and section writers."
            value={reportModel}
            presets={TEXT_AGENT_MODEL_PRESETS}
            onChange={onReportModelChange}
            agentKind="report"
            catalog={catalog}
            catalogLoading={catalogLoading}
            workloadHint={reportWorkloadHint}
          />
          <DashboardAgentModelSelect
            tile
            label="Ads agent"
            description="Google Ads and PPC reporting LLM steps."
            value={adsModel}
            presets={TEXT_AGENT_MODEL_PRESETS}
            onChange={onAdsModelChange}
            agentKind="ads"
            catalog={catalog}
            catalogLoading={catalogLoading}
            workloadHint={adsWorkloadHint}
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-white/10 pt-6">
        <div>
          <p className="text-base font-semibold text-white">Sampling defaults</p>
          <p className="mt-1 text-base text-white/90">Shared temperature, Top P, and max tokens.</p>
        </div>
        <LLMParameterControls
          temperature={temperature}
          onTemperatureChange={onTemperatureChange}
          maxTokens={maxTokens}
          onMaxTokensChange={onMaxTokensChange}
          topP={topP}
          onTopPChange={onTopPChange}
        />
      </div>
    </div>
  );
};
