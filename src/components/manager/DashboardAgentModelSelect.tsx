import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";

type Preset = { value: string; label: string };

export function DashboardAgentModelSelect({
  label,
  description,
  value,
  presets,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  presets: Preset[];
  onChange: (modelId: string) => void;
}) {
  const id = React.useId();
  const options = presets.some((p) => p.value === value)
    ? presets
    : [...presets, { value, label: value }];

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-semibold text-white">
        {label}
      </Label>
      <p className="text-sm text-white/80">{description}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className={`${DASHBOARD_SETTINGS_FIELD_CLASS} h-12 w-full shadow-none md:max-w-md`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-white/[0.08] bg-zinc-900 text-base text-white">
          {options.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
