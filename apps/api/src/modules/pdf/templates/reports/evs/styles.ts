import { photoFrameStyles } from '../photo-frame';
import { reportPageMarginMm, reportSheetWidthMm, reportSheetHeightMm } from '../page-geometry';

export const evsStyles = `
@page{size:A4;margin:${reportPageMarginMm}mm}*{box-sizing:border-box}
body{margin:0;font:12px Arial,sans-serif;color:#111;text-transform:uppercase}p{margin:0}img{max-width:100%}
.evs-sheet{width:${reportSheetWidthMm}mm;height:${reportSheetHeightMm}mm;border:2px solid #111;display:flex;flex-direction:column;break-after:page;position:relative}
.evs-sheet:last-child{break-after:auto}
.evs-header{height:25mm;flex-shrink:0;display:grid;grid-template-columns:28% 42% 30%;border-bottom:1.5px solid #111}
.evs-logo{display:flex;align-items:center;justify-content:center;padding:8px;border-right:1.5px solid #111}
.evs-logo{min-height:0}.evs-logo img{width:100%;height:100%;object-fit:contain}
.evs-heading{display:flex;align-items:center;justify-content:center;text-align:center;font-size:23px;font-weight:bold;line-height:1.25;padding:6px;border-right:1.5px solid #111}
.evs-header table{width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-size:15px}
.evs-header td{border-bottom:1px solid #111;padding:3px 4px;overflow-wrap:anywhere}
.evs-header tr:last-child td{border-bottom:0}.evs-header td+td{border-left:1px solid #111;text-align:center;color:#245aa1}
.evs-flow{flex:1;min-height:0}
.evs-contact{flex-shrink:0;padding:5mm 2mm 4mm;border-top:1.5px solid #111;text-align:center;font:italic 11px Georgia,serif;line-height:1.35;color:#263b70}
.evs-cover-block{padding:42mm 18mm 26mm;font-size:24px;line-height:1.5;font-weight:bold;overflow-wrap:anywhere}
.evs-cover-block p{text-align:center;margin-top:10mm}.evs-cover-block+.evs-cover-block{padding-top:30mm}
.evs-data-title{text-align:center;font-size:28px;margin:0;padding:12mm 8mm 8mm;overflow-wrap:anywhere}
.evs-data-line{font-size:22px;line-height:1.45;margin:0;padding:0 8mm 6mm;white-space:pre-wrap;overflow-wrap:anywhere}
.evs-identification .evs-flow{display:flex;flex-direction:column;justify-content:flex-start;gap:2mm;padding:8mm 0 5mm}
.evs-identification .evs-flow>*{flex-shrink:0}.evs-identification .evs-data-title{padding:0 8mm 6mm}.evs-identification .evs-data-line{padding-bottom:4mm}
.evs-drawing{height:239mm;width:100%;display:flex;align-items:center;justify-content:center}
.evs-drawing-page{height:auto;aspect-ratio:196/239;flex-shrink:0}
.evs-drawing svg,.evs-drawing img{width:100%;height:100%;object-fit:contain}.evs-drawing-caption{padding:3mm;font-size:12px}
.evs-weld{break-inside:avoid;border-bottom:1px solid #111;display:flex;flex-direction:column}
.evs-weld-tab{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px;min-height:10mm;flex-shrink:0}
.evs-weld-tab td,.evs-weld-tab th{border:1px solid #111;width:25%;padding:1px 4px;text-align:left;font-weight:normal;overflow-wrap:anywhere}
.evs-weld-tab td{color:#1683ac}
.evs-photo-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.evs-photo-pair>div{min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.evs-photo-pair>div+div{box-shadow:inset 1px 0 #111}
.evs-photo-pair span{color:#666;font-size:12px}
.evs-annotation{padding:2mm 4mm;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;border-bottom:1px solid #111}
.evs-verdict{padding:8mm 7mm;min-height:62mm;white-space:pre-wrap;overflow-wrap:anywhere;font-size:17px;line-height:1.5}
.evs-verdict-continuation{min-height:0}.evs-legend{border-top:1.5px solid #111;min-height:114mm}
.evs-legend h2{text-align:center;border-bottom:1.5px solid #111;font-size:18px;margin:0;padding:2mm}
.evs-legend>div{display:grid;grid-template-columns:1fr 1fr;gap:6mm;padding:11mm 6mm;font-size:15px;line-height:1.6}
.evs-result{display:grid;grid-template-columns:1fr 1fr 1.3fr;border-top:1.5px solid #111;border-bottom:1.5px solid #111;text-align:center;font-size:13px}
.evs-result b{padding:3mm 1mm}.evs-result b+b{border-left:1.5px solid #111}
.evs-signoff{break-inside:avoid}.evs-signers{display:flex;padding:4mm 3mm;gap:6mm;min-height:58mm}
.evs-signer{flex:1;min-width:0;text-align:center;font-size:13px;overflow-wrap:anywhere;line-height:1.4}
.evs-signature-space{height:18mm;border-bottom:1px solid #111}.evs-signature-name{margin-top:2mm}.evs-signer p{margin-top:6mm}
.evs-direct-records{break-inside:avoid}.evs-direct-records h2{font-size:16px;text-align:center;margin:0;padding:3mm;border-bottom:1px solid #111}
.evs-direct-records table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px}.evs-direct-records th,.evs-direct-records td{border:1px solid #111;text-align:center;padding:1mm;overflow-wrap:anywhere;font-weight:normal}
.evs-direct-records th{height:12mm;font-size:11px}.evs-direct-records td div{height:7.5mm;display:flex;align-items:center;justify-content:center;overflow:hidden;line-height:1.05}.evs-direct-records>p{padding:2mm;font-size:12px}
${photoFrameStyles}
`;
