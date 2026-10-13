export const reportStatuses = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'FINISHED'] as const;
export const recordStatuses = ['ACTIVE', 'ARCHIVED'] as const;
export const reportTypeCodes = ['EVS', 'LP', 'TH', 'ME', 'RDO'] as const;
export type ReportStatus = (typeof reportStatuses)[number];
export type ReportTypeCode = (typeof reportTypeCodes)[number];
