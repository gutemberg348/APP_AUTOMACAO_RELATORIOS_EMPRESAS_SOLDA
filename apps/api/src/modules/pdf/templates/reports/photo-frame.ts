// Evidence uses the same frame regardless of the original image orientation or
// whether the second slot is empty. Pagination adjusts the shared height to fit
// three pairs while preserving metadata/readings. Fill never crops the photo.
export const photoFrameStyles = `
.report-photo-frame{position:relative;width:100%;height:var(--report-photo-height,auto);aspect-ratio:4/3;flex:none;min-width:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff}
.report-photo-frame img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:fill;object-position:center}
`;
