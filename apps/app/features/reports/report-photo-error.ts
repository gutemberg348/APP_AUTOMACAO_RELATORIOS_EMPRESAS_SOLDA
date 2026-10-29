export class ReportPhotoSaveError extends Error {
  constructor(
    message: string,
    public location: { pointNumber?: string; drawing?: boolean; label: string },
  ) {
    super(message);
  }
}
