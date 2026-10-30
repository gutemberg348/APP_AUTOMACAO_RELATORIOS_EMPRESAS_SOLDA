// Evidence uses the same frame regardless of the original image orientation or
// whether the second slot is empty. Contain preserves every part of the photo.
export const photoFrameStyles = `
.report-photo-frame{position:relative;width:100%;aspect-ratio:4/3;flex:none;min-width:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff}
.report-photo-frame img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;object-position:center}
`;
