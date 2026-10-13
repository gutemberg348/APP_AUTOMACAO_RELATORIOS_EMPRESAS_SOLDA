export function shouldApplyReportSnapshot(
  loadedVersion: string | undefined,
  incomingVersion: string,
  hasChanges: boolean,
  acceptedSaveVersion?: string,
) {
  if (loadedVersion === incomingVersion) return false;
  return !loadedVersion || !hasChanges || acceptedSaveVersion === incomingVersion;
}
