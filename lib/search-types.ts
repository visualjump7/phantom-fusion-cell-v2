export interface SearchRequest {
  query: string;
  organizationId: string;
}

export interface SearchBreakdownItem {
  label: string;
  value: number | null;
  formattedValue: string | null;
  assetId: string | null;
  assetName: string | null;
  detail: string;
}

export interface SearchResult {
  answer: string;
  total: number | null;
  formattedTotal: string | null;
  breakdown: SearchBreakdownItem[];
  sources: string[];
  followUp: string | null;
}

export interface SearchResponse {
  success: boolean;
  result?: SearchResult;
  error?: string;
  durationMs?: number;
}
