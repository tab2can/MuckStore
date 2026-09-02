export function motionEnabled(settings?: { animations?: boolean; reducedMotion?: boolean } | null) {
  if (!settings) return true;
  return settings.animations !== false && !settings.reducedMotion;
}
