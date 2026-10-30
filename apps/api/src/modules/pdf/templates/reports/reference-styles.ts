export const referenceStyles = `
.reference-band{margin:0;padding:3mm 2mm;text-align:center;font-size:17px;font-weight:normal;border-top:1px solid #111;border-bottom:1px solid #111}
.reference-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px}
.reference-table th,.reference-table td{border:1px solid #111;padding:2mm 1mm;white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;font-weight:normal}
.reference-table th{font-size:12px}.reference-table-block{break-inside:avoid}
.reference-photo-row{display:flex;flex-direction:column;break-inside:avoid;border-bottom:1px solid #111}
.reference-photo-row>.reference-band{font-size:14px;padding:2mm}
.reference-photo-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.reference-photo-cell{display:flex;flex-direction:column;min-width:0;min-height:0}
.reference-photo-cell+.reference-photo-cell{box-shadow:inset 1px 0 #111}
.reference-photo-tab{border-bottom:1px solid #111;padding:1mm;font-size:12px;overflow-wrap:anywhere}
.reference-photo-tab span{color:#16789c}
.reference-photo-image{color:#666}
.lp-general-page{height:250mm;display:flex;flex-direction:column;border-bottom:1px solid #111}
.lp-general-page>div{flex-shrink:0}.lp-general-conditions{padding-top:3mm;padding-bottom:3mm}
.lp-form-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;color:#111}
.lp-form-table th,.lp-form-table td{border:1px solid #111;padding:1mm;overflow-wrap:anywhere;font-weight:normal;text-align:center;line-height:1.25}
.lp-general-conditions th{height:10mm;font-size:11px}.lp-general-conditions td{height:8mm;color:#16789c}
.lp-general-page .reference-band{padding:2mm;font-size:16px}
.lp-choices th{height:7mm}.lp-choices td{height:8mm;font-size:11px}
.lp-check{display:inline-block;margin:0 2mm}.lp-custom-choice{color:#16789c;padding-top:1mm}
.lp-material-table thead th{height:10mm;font-size:11px}.lp-material-table tbody th,.lp-material-table tbody td{height:6.5mm}.lp-material-table tbody td{color:#16789c}
.lp-general-page .lp-indications{flex:1;min-height:88mm;display:flex;flex-direction:column;padding-top:3mm}
.lp-indications .lp-form-table{flex:1;height:100%}.lp-indications .lp-inspection-area{vertical-align:top;padding:6mm 3mm;text-align:left}.lp-indications td{height:6mm}
.lp-indication-description,.lp-indication-code{color:#16789c}.lp-indications-continuation{height:105mm;break-inside:avoid}
.lp-legend td{text-align:left;height:7mm;font-size:11px}.lp-legend{padding-top:3mm}
.th-technical .evs-flow{padding-top:14mm}
.th-fields{margin-top:6mm;break-inside:avoid}.th-fields-joined{margin-top:0}
.th-field-grid{display:grid;border-bottom:1.5px solid #111;border-top:1.5px solid #111}.th-fields-joined .th-field-grid{border-top:0}
.th-field{padding:3mm 2mm;min-height:20mm;white-space:pre-wrap;overflow-wrap:anywhere;color:#111;font-size:16px;line-height:1.35;text-align:left}
.th-field+.th-field{border-left:1.5px solid #111}.th-field b{display:block;font-size:14px;font-weight:700;margin-bottom:1mm}
.th-technical .reference-band{padding:6mm 2mm;font-size:22px;font-weight:700;color:#111;border-bottom:0}
.reference-final .evs-flow{display:flex;flex-direction:column}
.reference-final .evs-flow>*{flex-shrink:0}.reference-final .evs-signoff{margin-top:auto}
.reference-conclusion{padding:8mm 5mm;min-height:140mm;font-size:17px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
.reference-conclusion.continuation{min-height:0}
.reference-final:has(.evs-contact) .reference-conclusion{min-height:140mm}
.reference-final .evs-signers{min-height:63mm;padding-top:8mm}
.measurement-sheet .reference-photo-tab{font-size:14px;padding:1.5mm}
.measurement-sheet .reference-conclusion{font-size:20px}
.measurement-sheet .evs-signer,.measurement-sheet .evs-result{font-size:14px}
.measurement-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.measurement-cell{min-width:0}.measurement-cell+.measurement-cell{box-shadow:inset 1px 0 #111}
.measurement-reading{padding:2mm 1mm;border-bottom:1px solid #111;min-height:8mm;font-size:15px;overflow-wrap:anywhere}
.measurement-reading span{color:#16789c}.measurement-block{break-inside:avoid;border-bottom:1px solid #111}
.rdo-sheet .evs-header{height:22mm;grid-template-columns:22% 48% 30%}.rdo-sheet .evs-heading{font-size:19px}
.rdo-sheet .evs-header table{font-size:12px}.rdo-repeated{flex-shrink:0}
.rdo-repeated th{font-size:10px;text-align:left;width:12%}.rdo-repeated td{font-size:12px;color:#245aa1;padding:1mm}
.rdo-drawing{height:135mm;width:100%}.rdo-drawing svg,.rdo-drawing img{height:100%;width:100%;object-fit:contain}
.rdo-observation{font-style:italic;font-size:15px;font-weight:bold;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;padding:5mm 3mm}
`;
