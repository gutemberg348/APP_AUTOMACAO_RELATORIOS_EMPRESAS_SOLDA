export const reportStatuses = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'FINISHED'] as const;
export const recordStatuses = ['ACTIVE', 'ARCHIVED'] as const;
export const reportTypeCodes = ['EVS', 'EVD', 'LP', 'TH', 'ME', 'RDO'] as const;
export const isVisualWeldReport = (code: string) => code === 'EVS' || code === 'EVD';
export type ReportStatus = (typeof reportStatuses)[number];
export type ReportTypeCode = (typeof reportTypeCodes)[number];
