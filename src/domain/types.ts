export const QUESTION_TYPES = ["TEXT", "NUMBER", "SINGLE_CHOICE", "MULTI_CHOICE", "YES_NO"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const CLASSIFICATIONS = ["HIGH", "MEDIUM", "LOW", "UNRATED"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];
export const CHANNELS = ["INSTAGRAM", "FACEBOOK", "GOOGLE", "QR_CODE", "DIRECT", "OTHER"] as const;
export type Channel = (typeof CHANNELS)[number];
export const LEAD_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "VISIT_SCHEDULED", "PROPOSAL", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const PROPERTY_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED", "SOLD", "RENTED"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export const PROPERTY_TYPES = ["HOUSE", "APARTMENT", "TOWNHOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_PURPOSES = ["SALE", "RENT"] as const;
export type PropertyPurpose = (typeof PROPERTY_PURPOSES)[number];
export type ShowIf = { questionId: string; optionIds: string[] };
export interface QuestionOptionDef { id: string; label: string; weight: number }
export interface QuestionDef {
  id: string; label: string; type: QuestionType; required: boolean;
  isVisitIntent: boolean; showIf: ShowIf | null; options: QuestionOptionDef[];
}
export interface AnswerValue { optionIds?: string[]; text?: string; number?: number }
export type AnswerMap = Record<string, AnswerValue>;
