import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  normalizeProfileTags,
  PROPERTY_PROFILE_TAG_OPTIONS,
  toggleProfileTag,
} from "@/lib/wordpress-property-profile-tags";

export type PropertyProfileTagPillsProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  onCommit?: (tags: string[]) => void;
  disabled?: boolean;
};

export function PropertyProfileTagPills({
  value,
  onChange,
  onCommit,
  disabled = false,
}: PropertyProfileTagPillsProps) {
  const tags = normalizeProfileTags(value);

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Profile tags"
    >
      {PROPERTY_PROFILE_TAG_OPTIONS.map((opt) => (
        <WorkspacePill
          key={opt.id}
          label={opt.label}
          active={tags.includes(opt.id)}
          disabled={disabled}
          square
          onClick={() => {
            const next = toggleProfileTag(tags, opt.id);
            onChange(next);
            onCommit?.(next);
          }}
        />
      ))}
    </div>
  );
}
