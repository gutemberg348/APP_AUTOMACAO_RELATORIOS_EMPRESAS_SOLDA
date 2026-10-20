export const referenceStyles = `
.reference-band{margin:0;padding:3mm 2mm;text-align:center;font-size:15px;font-weight:normal;border-top:1px solid #111;border-bottom:1px solid #111}
.reference-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px}
.reference-table th,.reference-table td{border:1px solid #111;padding:2mm 1mm;white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;font-weight:normal}
.reference-table th{font-size:10px}.reference-table-block{break-inside:avoid}
.reference-identification .evs-data-line{padding-bottom:5mm}
.reference-photo-row{height:81mm;display:flex;flex-direction:column;break-inside:avoid;border-bottom:1px solid #111}
.reference-photo-row>.reference-band{font-size:12px;padding:2mm}
.reference-photo-columns{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0}
.reference-single-photo{grid-template-columns:1fr}
.reference-photo-cell{display:flex;flex-direction:column;min-width:0;min-height:0}
.reference-photo-cell+.reference-photo-cell{border-left:1px solid #111}
.reference-photo-tab{border-bottom:1px solid #111;padding:1mm;font-size:10px;overflow-wrap:anywhere}
.reference-photo-tab span{color:#16789c}
.reference-photo-image{flex:1;min-height:0;overflow:hidden;display:flex;justify-content:center;align-items:center;color:#666}
.reference-photo-image img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}
.lp-technical .reference-table-block{margin-top:4mm}.lp-technical .reference-table td{height:7mm}
.th-technical .reference-table-block{margin-top:7mm}.th-technical .reference-table td{height:17mm}
.th-technical .reference-band{padding:8mm 2mm}
.reference-final .evs-flow{display:flex;flex-direction:column}
.reference-final .evs-flow>*{flex-shrink:0}.reference-final .evs-signoff{margin-top:auto}
.reference-conclusion{padding:8mm 5mm;min-height:140mm;font-size:15px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
.reference-conclusion.continuation{min-height:0}
.reference-final:has(.evs-contact) .reference-conclusion{min-height:140mm}
.reference-final .evs-signers{min-height:63mm;padding-top:8mm}
.measurement-columns{display:grid;grid-template-columns:1fr 1fr}
.measurement-cell{min-width:0}.measurement-cell+.measurement-cell{border-left:1px solid #111}
.measurement-photo{height:64mm;overflow:hidden;display:flex;align-items:center;justify-content:center}
.measurement-photo img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}
.measurement-reading{padding:2mm 1mm;border-bottom:1px solid #111;min-height:8mm;font-size:11px;overflow-wrap:anywhere}
.measurement-reading span{color:#16789c}.measurement-block{break-inside:avoid;border-bottom:1px solid #111}
.rdo-sheet .evs-header{height:19mm;grid-template-columns:22% 48% 30%}.rdo-sheet .evs-heading{font-size:17px}
.rdo-sheet .evs-header table{font-size:10px}.rdo-repeated{flex-shrink:0}
.rdo-repeated th{font-size:8px;text-align:left;width:12%}.rdo-repeated td{font-size:10px;color:#245aa1;padding:1mm}
.rdo-drawing{height:135mm;width:100%}.rdo-drawing svg,.rdo-drawing img{height:100%;width:100%;object-fit:contain}
.rdo-observation{font-style:italic;font-size:13px;font-weight:bold;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;padding:5mm 3mm}
.rdo-sheet .reference-photo-row{height:95mm}
`;
