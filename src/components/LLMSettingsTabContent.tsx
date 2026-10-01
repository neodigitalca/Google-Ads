import React from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import { DashboardAgentModelSelect } from "@/components/manager/DashboardAgentModelSelect";
import {
  IMAGE_MODEL_PRESETS,
  TEXT_AGENT_MODEL_PRESETS,
} from "@/lib/global-agent-models";

export interface LLMSettingsTabContentProps {
  researchModel: string;
  onResearchModelChange: (model: string) => void;
  blogModel: string;
  onBlogModelChange: (model: string) => void;
  imageModel: string;
  onImageModelChange: (model: string) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
}

const numberInputClassName = `${DASHBOARD_SETTINGS_FIELD_CLASS} max-w-[180px] h-12 shadow-none focus-visible:ring-2 focus-visible:ring-white/35`;

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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
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
          className={numberInputClassName}
        />
      </div>

      <div className="space-y-3">
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
          className={numberInputClassName}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor={maxTokId} className="text-base font-semibold text-white">
          Max tokens
        </Label>
        <Input
          id={maxTokId}
          type="number"
          step="1"
          min="1"
          value={String(props.maxTokens)}
          onChange={handleMaxTokensInputChange}
          className={numberInputClassName}
        />
      </div>
    </div>
  );
};

/** Dashboard → AI & Models: three pipeline agents + sampling. */
export const LLMSettingsTabContent: React.FC<LLMSettingsTabContentProps> = ({
  researchModel,
  onResearchModelChange,
  blogModel,
  onBlogModelChange,
  imageModel,
  onImageModelChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
  topP,
  onTopPChange,
}) => {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <p className="text-base font-semibold text-white">Pipeline agents</p>
          <p className="mt-1 text-base text-white/90">
            Pick a different OpenRouter model for each agent. Per-site Optimization Settings override these when set.
          </p>
        </div>
        <DashboardAgentModelSelect
          label="Research agent"
          description="Checklist, blueprint, briefs, featured-image planning."
          value={researchModel}
          presets={TEXT_AGENT_MODEL_PRESETS}
          onChange={onResearchModelChange}
        />
        <DashboardAgentModelSelect
          label="Blog agent"
          description="Harness sections, WordPress title, meta description."
          value={blogModel}
          presets={TEXT_AGENT_MODEL_PRESETS}
          onChange={onBlogModelChange}
        />
        <DashboardAgentModelSelect
          label="Image agent"
          description="Featured and in-content image generation."
          value={imageModel}
          presets={IMAGE_MODEL_PRESETS}
          onChange={onImageModelChange}
        />
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
