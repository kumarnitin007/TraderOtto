import { APP_WORKSPACES, isAppWorkspace, type AppWorkspace } from "@/lib/appWorkspace";

export function normalizeEnabledSections(value: unknown): AppWorkspace[] {
  if (!Array.isArray(value)) return [...APP_WORKSPACES];
  const enabled = APP_WORKSPACES.filter((id) => value.includes(id));
  return enabled.length > 0 ? enabled : [...APP_WORKSPACES];
}

export function normalizeDefaultSection(
  value: unknown,
  enabled: readonly AppWorkspace[]
): AppWorkspace {
  if (isAppWorkspace(value) && enabled.includes(value)) return value;
  return enabled[0];
}

export function withSectionToggled(
  enabled: readonly AppWorkspace[],
  defaultSection: AppWorkspace,
  current: AppWorkspace,
  id: AppWorkspace
): {
  enabledSections: AppWorkspace[];
  defaultSection: AppWorkspace;
  appWorkspace: AppWorkspace;
} {
  const isOn = enabled.includes(id);
  if (isOn && enabled.length === 1) {
    return {
      enabledSections: [...enabled],
      defaultSection,
      appWorkspace: current,
    };
  }
  const enabledSections = isOn
    ? enabled.filter((item) => item !== id)
    : APP_WORKSPACES.filter((item) => item === id || enabled.includes(item));
  const nextDefault = enabledSections.includes(defaultSection)
    ? defaultSection
    : enabledSections[0];
  return {
    enabledSections,
    defaultSection: nextDefault,
    appWorkspace: enabledSections.includes(current) ? current : nextDefault,
  };
}
