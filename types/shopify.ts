export interface ShopifyProductItem {
  id: string;
  title: string;
  orderCount?: number;
}

export interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

export interface ShopifyLineItemNode {
  title: string;
  quantity: number;
  originalUnitPriceSet?: {
    shopMoney: ShopifyMoney;
  };
  discountedUnitPriceSet?: {
    shopMoney: ShopifyMoney;
  };
  variant?: {
    id?: string;
    title?: string;
    product?: {
      id: string;
      title: string;
    } | null;
  } | null;
}

export interface ShopifyShippingAddress {
  province?: string | null;
  provinceCode?: string | null;
  countryCodeV2?: string | null;
  city?: string | null;
  zip?: string | null;
}

export interface ShopifyOrderAttribute {
  key: string;
  value?: string | null;
}

export interface ShopifyOrderNode {
  id: string;
  name: string;
  createdAt: string;
  processedAt?: string | null;
  cancelledAt?: string | null;
  totalPriceSet?: {
    shopMoney: ShopifyMoney;
  };
  shippingAddress?: ShopifyShippingAddress | null;
  customAttributes?: ShopifyOrderAttribute[] | null;
  lineItems: {
    nodes: ShopifyLineItemNode[];
  };
}

export interface ShopifyOrdersQueryResponse {
  orders: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: ShopifyOrderNode[];
  };
}

export interface ShopifyProductsQueryResponse {
  products: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: Array<{
      id: string;
      title: string;
    }>;
  };
}

export interface NormalizedOrderLine {
  orderId: string;
  orderName: string;
  date: string;
  state: string;
  stateCode?: string;
  countryCode?: string;
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  currency: string;
}

export interface StateProductBreakdown {
  productId: string;
  productName: string;
  units: number;
  revenue: number;
  orders: number;
}

export interface StateCityBreakdown {
  city: string;
  orders: number;
  units: number;
  revenue: number;
}

export interface StateAnalytics {
  state: string;
  stateCode?: string;
  orders: number;
  units: number;
  revenue: number;
  percentageOfRevenue?: number;
  percentageOfUnits?: number;
  products?: StateProductBreakdown[];
  cities?: StateCityBreakdown[];
}

export interface CampaignStateBreakdown {
  state: string;
  stateCode?: string;
  orders: number;
  units: number;
  revenue: number;
}

export interface CampaignAnalytics {
  campaign: string;
  orders: number;
  units: number;
  revenue: number;
  percentageOfRevenue?: number;
  percentageOfUnits?: number;
  states?: CampaignStateBreakdown[];
}

export interface AnalyticsSummary {
  totalOrders: number;
  attributedOrders?: number;
  totalUnits: number;
  totalRevenue: number;
  currency: string;
  topState: string;
  topStateUnits?: number;
  topStateRevenue?: number;
}

export interface RunningProductItem {
  id: string;
  title: string;
  orderCount: number;
  units: number;
  revenue: number;
}

export interface OrdersApiResponse {
  summary: AnalyticsSummary;
  states: StateAnalytics[];
  runningProducts?: RunningProductItem[];
  campaigns?: CampaignAnalytics[];
  isConfigured?: boolean;
  totalCount?: number;
  totalAvailable?: number;
  truncated?: boolean;
  maxOrders?: number;
  error?: string;
}

export interface ProductsApiResponse {
  products: ShopifyProductItem[];
  isConfigured?: boolean;
  error?: string;
}
