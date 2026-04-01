export interface AssetPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  estimatedValue: number;
  category: string;
  locationType: "precise" | "city" | "country";
  city?: string;
  stateProvince?: string;
  country?: string;
}

export interface UnlocatedAsset {
  id: string;
  name: string;
  category: string;
  estimatedValue: number;
}

export interface DrillDownData {
  asset: {
    id: string;
    name: string;
    category: string;
    estimated_value: number;
    city?: string;
    state_province?: string;
    country?: string;
    location_type?: string;
  };
  messages: Array<{
    id: string;
    type: string;
    priority: string;
    title: string;
    created_at: string;
  }>;
  bills: Array<{
    id: string;
    title: string;
    amount_cents: number;
    due_date: string;
    status: string;
    category?: string;
  }>;
  budget: {
    annual_total: number;
    topCategories: Array<{ name: string; amount: number }>;
  } | null;
  contacts: Array<{
    name: string;
    role: string;
    company?: string;
    contact_type: string;
  }>;
}
