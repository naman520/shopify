import {
  ShopifyOrderNode,
  StateAnalytics,
  AnalyticsSummary,
  RunningProductItem,
  CampaignAnalytics,
} from "@/types/shopify";

const NO_CAMPAIGN_LABEL = "Direct / No Campaign";

/**
 * Reads the first non-empty value among the given order attribute keys (case-insensitive).
 */
function getOrderAttribute(order: ShopifyOrderNode, keys: string[]): string | undefined {
  const attributes = order.customAttributes || [];
  for (const key of keys) {
    const match = attributes.find((a) => a.key?.trim().toLowerCase() === key);
    const value = match?.value?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Resolves the ad campaign ID for an order.
 *
 * Order-level custom attributes take priority: COD form apps (EasySell etc.) create orders
 * through the API, so Shopify records no storefront visit and customerJourneySummary stays
 * empty — the ad platform's UTM values are written onto the order as attributes instead.
 * Native web-checkout orders fall back to the customer journey's UTM parameters.
 */
function getOrderCampaignId(order: ShopifyOrderNode): string {
  const fromAttributes = getOrderAttribute(order, ["utm_campaign", "utm_id", "campaign_id"]);
  if (fromAttributes) return fromAttributes;

  const journey = order.customerJourneySummary;
  const visit = journey?.lastVisit?.utmParameters ? journey.lastVisit : journey?.firstVisit;
  const fromJourney = visit?.utmParameters?.campaign?.trim();

  return fromJourney || NO_CAMPAIGN_LABEL;
}

// Standard mapping of Indian State / UT codes and common spellings to canonical names
export const INDIAN_STATES_MAP: Record<string, string> = {
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CT: "Chhattisgarh",
  CG: "Chhattisgarh",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  DD: "Daman and Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JK: "Jammu and Kashmir",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OR: "Odisha",
  OD: "Odisha",
  PY: "Puducherry",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TS: "Telangana",
  TG: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttarakhand",
  UA: "Uttarakhand",
  WB: "West Bengal",
};

/**
 * Normalizes state name to standard Indian state name if possible
 */
export function normalizeIndianState(province?: string | null, provinceCode?: string | null): string {
  if (provinceCode && INDIAN_STATES_MAP[provinceCode.toUpperCase()]) {
    return INDIAN_STATES_MAP[provinceCode.toUpperCase()];
  }

  if (!province || province.trim() === "") {
    return "Unknown / Not Provided";
  }

  const cleanProvince = province.trim();
  const upper = cleanProvince.toUpperCase();

  if (INDIAN_STATES_MAP[upper]) {
    return INDIAN_STATES_MAP[upper];
  }

  // Case-insensitive match on state names
  for (const name of Object.values(INDIAN_STATES_MAP)) {
    if (name.toLowerCase() === cleanProvince.toLowerCase()) {
      return name;
    }
  }

  return cleanProvince;
}

/**
 * Calculates state-wise analytics from Shopify orders
 */
export function normalizeCity(city?: string | null): string {
  if (!city || city.trim() === "") {
    return "Unknown City";
  }
  return city
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Calculates state-wise and city-wise analytics from Shopify orders
 */
export function calculateStateAnalytics(
  orders: ShopifyOrderNode[],
  selectedProductId: string = "all"
): {
  summary: AnalyticsSummary;
  states: StateAnalytics[];
  runningProducts: RunningProductItem[];
  campaigns: CampaignAnalytics[];
} {
  const isAll = !selectedProductId || selectedProductId === "all";

  // Map to hold aggregated state data
  const stateMap: Record<
    string,
    {
      state: string;
      stateCode?: string;
      orderIds: Set<string>;
      units: number;
      revenue: number;
      productsMap: Record<
        string,
        {
          productId: string;
          productName: string;
          units: number;
          revenue: number;
          orderIds: Set<string>;
        }
      >;
      citiesMap: Record<
        string,
        {
          city: string;
          units: number;
          revenue: number;
          orderIds: Set<string>;
        }
      >;
    }
  > = {};

  // Map to aggregate running products across all valid orders
  const runningProductsMap: Record<
    string,
    {
      id: string;
      title: string;
      orderIds: Set<string>;
      units: number;
      revenue: number;
    }
  > = {};

  // Map to aggregate revenue/units by marketing campaign (from UTM attribution)
  const campaignMap: Record<
    string,
    {
      campaign: string;
      orderIds: Set<string>;
      units: number;
      revenue: number;
      statesMap: Record<
        string,
        {
          state: string;
          stateCode?: string;
          orderIds: Set<string>;
          units: number;
          revenue: number;
        }
      >;
    }
  > = {};

  let detectedCurrency = "INR";
  const overallOrderIds = new Set<string>();
  let overallUnits = 0;
  let overallRevenue = 0;

  for (const order of orders) {
    const shipping = order.shippingAddress;
    const countryCode = shipping?.countryCodeV2?.toUpperCase();

    // Determine if shipping address is within India
    const isIndia = !countryCode || countryCode === "IN";
    const stateName = isIndia
      ? normalizeIndianState(shipping?.province, shipping?.provinceCode)
      : "International / Other";
    const stateCode = isIndia ? (shipping?.provinceCode || undefined) : (countryCode || undefined);
    const cityName = isIndia
      ? normalizeCity(shipping?.city)
      : (shipping?.city ? normalizeCity(shipping?.city) : "International");

    // Collect all running products across every order in this period
    for (const item of order.lineItems?.nodes || []) {
      const pId = item.variant?.product?.id || item.title || "unknown";
      const pTitle = item.variant?.product?.title || item.title || "Unknown Product";
      const q = item.quantity || 0;
      const unitMoney =
        item.discountedUnitPriceSet?.shopMoney ||
        item.originalUnitPriceSet?.shopMoney ||
        order.totalPriceSet?.shopMoney;
      const uPrice = parseFloat(unitMoney?.amount || "0");
      const lRev = uPrice * q;

      if (!runningProductsMap[pId]) {
        runningProductsMap[pId] = {
          id: pId,
          title: pTitle,
          orderIds: new Set<string>(),
          units: 0,
          revenue: 0,
        };
      }
      runningProductsMap[pId].units += q;
      runningProductsMap[pId].revenue += lRev;
      runningProductsMap[pId].orderIds.add(order.id);
    }

    // Filter relevant line items for the selected product
    const relevantItems = (order.lineItems?.nodes || []).filter((item) => {
      if (isAll) return true;
      const prodId = item.variant?.product?.id;
      return prodId === selectedProductId || prodId?.endsWith(selectedProductId);
    });

    if (relevantItems.length === 0) {
      continue;
    }

    // Initialize State Map
    if (!stateMap[stateName]) {
      stateMap[stateName] = {
        state: stateName,
        stateCode,
        orderIds: new Set<string>(),
        units: 0,
        revenue: 0,
        productsMap: {},
        citiesMap: {},
      };
    }

    // Mark order as present
    stateMap[stateName].orderIds.add(order.id);
    overallOrderIds.add(order.id);

    // Initialize Campaign Map (UTM attribution is order-level, not per line item)
    // Keyed on campaign ID alone: one Meta campaign delivers across fb/ig placements, so
    // splitting by source would show the same campaign as several partial rows.
    const campaignKey = getOrderCampaignId(order);
    if (!campaignMap[campaignKey]) {
      campaignMap[campaignKey] = {
        campaign: campaignKey,
        orderIds: new Set<string>(),
        units: 0,
        revenue: 0,
        statesMap: {},
      };
    }
    campaignMap[campaignKey].orderIds.add(order.id);

    // Track which state this campaign's order shipped to
    if (!campaignMap[campaignKey].statesMap[stateName]) {
      campaignMap[campaignKey].statesMap[stateName] = {
        state: stateName,
        stateCode,
        orderIds: new Set<string>(),
        units: 0,
        revenue: 0,
      };
    }
    campaignMap[campaignKey].statesMap[stateName].orderIds.add(order.id);

    // Sum units and revenue for matching items
    for (const item of relevantItems) {
      const quantity = item.quantity || 0;
      overallUnits += quantity;

      // Calculate unit price
      const unitMoney =
        item.discountedUnitPriceSet?.shopMoney ||
        item.originalUnitPriceSet?.shopMoney ||
        order.totalPriceSet?.shopMoney;

      if (unitMoney?.currencyCode) {
        detectedCurrency = unitMoney.currencyCode;
      }

      const unitPrice = parseFloat(unitMoney?.amount || "0");
      const lineRevenue = unitPrice * quantity;

      overallRevenue += lineRevenue;

      // Aggregates for State
      stateMap[stateName].units += quantity;
      stateMap[stateName].revenue += lineRevenue;

      // Aggregates for Campaign
      campaignMap[campaignKey].units += quantity;
      campaignMap[campaignKey].revenue += lineRevenue;

      // Aggregates for Campaign's State split
      campaignMap[campaignKey].statesMap[stateName].units += quantity;
      campaignMap[campaignKey].statesMap[stateName].revenue += lineRevenue;

      // Product split aggregation
      const prodId = item.variant?.product?.id || "unknown";
      const prodName = item.variant?.product?.title || item.title || "Unknown Product";

      // State product split
      if (!stateMap[stateName].productsMap[prodId]) {
        stateMap[stateName].productsMap[prodId] = {
          productId: prodId,
          productName: prodName,
          units: 0,
          revenue: 0,
          orderIds: new Set<string>(),
        };
      }
      stateMap[stateName].productsMap[prodId].units += quantity;
      stateMap[stateName].productsMap[prodId].revenue += lineRevenue;
      stateMap[stateName].productsMap[prodId].orderIds.add(order.id);

      // City split inside the State
      if (!stateMap[stateName].citiesMap[cityName]) {
        stateMap[stateName].citiesMap[cityName] = {
          city: cityName,
          units: 0,
          revenue: 0,
          orderIds: new Set<string>(),
        };
      }
      stateMap[stateName].citiesMap[cityName].units += quantity;
      stateMap[stateName].citiesMap[cityName].revenue += lineRevenue;
      stateMap[stateName].citiesMap[cityName].orderIds.add(order.id);
    }
  }

  // Convert State Map to Array
  const states: StateAnalytics[] = Object.values(stateMap).map((entry) => {
    const ordersCount = entry.orderIds.size;
    const rev = Math.round(entry.revenue * 100) / 100;
    
    // Map products list
    const productsList = Object.values(entry.productsMap).map((p) => ({
      productId: p.productId,
      productName: p.productName,
      units: p.units,
      revenue: Math.round(p.revenue * 100) / 100,
      orders: p.orderIds.size,
    }));
    productsList.sort((a, b) => b.revenue - a.revenue || b.units - a.units);

    // Map cities list (order-wise)
    const citiesList = Object.values(entry.citiesMap).map((c) => ({
      city: c.city,
      orders: c.orderIds.size,
      units: c.units,
      revenue: Math.round(c.revenue * 100) / 100,
    }));
    citiesList.sort((a, b) => b.orders - a.orders || b.units - a.units || b.revenue - a.revenue);

    return {
      state: entry.state,
      stateCode: entry.stateCode,
      orders: ordersCount,
      units: entry.units,
      revenue: rev,
      percentageOfRevenue: overallRevenue > 0 ? (rev / overallRevenue) * 100 : 0,
      percentageOfUnits: overallUnits > 0 ? (entry.units / overallUnits) * 100 : 0,
      products: productsList,
      cities: citiesList,
    };
  });

  // Sort states descending by orders
  states.sort((a, b) => b.orders - a.orders || b.units - a.units);

  // Convert Campaign Map to Array
  const campaigns: CampaignAnalytics[] = Object.values(campaignMap).map((c) => {
    const rev = Math.round(c.revenue * 100) / 100;

    // Map this campaign's state split (which states its leads/orders shipped to)
    const campaignStatesList = Object.values(c.statesMap).map((s) => ({
      state: s.state,
      stateCode: s.stateCode,
      orders: s.orderIds.size,
      units: s.units,
      revenue: Math.round(s.revenue * 100) / 100,
    }));
    campaignStatesList.sort((a, b) => b.orders - a.orders || b.units - a.units);

    return {
      campaign: c.campaign,
      orders: c.orderIds.size,
      units: c.units,
      revenue: rev,
      percentageOfRevenue: overallRevenue > 0 ? (rev / overallRevenue) * 100 : 0,
      percentageOfUnits: overallUnits > 0 ? (c.units / overallUnits) * 100 : 0,
      states: campaignStatesList,
    };
  });
  campaigns.sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);

  // Convert running products map to sorted array
  const runningProducts: RunningProductItem[] = Object.values(runningProductsMap).map((p) => ({
    id: p.id,
    title: p.title,
    orderCount: p.orderIds.size,
    units: p.units,
    revenue: Math.round(p.revenue * 100) / 100,
  }));
  runningProducts.sort((a, b) => b.orderCount - a.orderCount || b.revenue - a.revenue);

  const topStateItem = states.length > 0 ? states[0] : null;

  const summary: AnalyticsSummary = {
    totalOrders: overallOrderIds.size,
    totalUnits: overallUnits,
    totalRevenue: Math.round(overallRevenue * 100) / 100,
    currency: detectedCurrency,
    topState: topStateItem ? topStateItem.state : "N/A",
    topStateUnits: topStateItem ? topStateItem.units : 0,
    topStateRevenue: topStateItem ? topStateItem.revenue : 0,
  };

  return { summary, states, runningProducts, campaigns };
}

/**
 * Realistic Indian state mock data for UI demo / when credentials aren't set
 */
export function getSampleAnalytics(selectedProductTitle: string = "All Products") {
  const sampleStates: StateAnalytics[] = [
    { 
      state: "Maharashtra", 
      stateCode: "MH", 
      orders: 245, 
      units: 312, 
      revenue: 145000, 
      percentageOfRevenue: 28.5, 
      percentageOfUnits: 27.2,
      products: [
        { productId: "sample-1", productName: "iPhone Case (Sample)", units: 180, revenue: 82000, orders: 140 },
        { productId: "sample-2", productName: "Wireless Charger (Sample)", units: 92, revenue: 43000, orders: 75 },
        { productId: "sample-3", productName: "Leather Wallet (Sample)", units: 40, revenue: 20000, orders: 30 },
      ],
      cities: [
        { city: "Mumbai", orders: 140, units: 180, revenue: 82000 },
        { city: "Pune", orders: 85, units: 105, revenue: 49000 },
        { city: "Nagpur", orders: 20, units: 27, revenue: 14000 },
      ]
    },
    { 
      state: "Delhi", 
      stateCode: "DL", 
      orders: 198, 
      units: 241, 
      revenue: 118500, 
      percentageOfRevenue: 23.3, 
      percentageOfUnits: 21.0,
      products: [
        { productId: "sample-1", productName: "iPhone Case (Sample)", units: 130, revenue: 60000, orders: 105 },
        { productId: "sample-2", productName: "Wireless Charger (Sample)", units: 80, revenue: 42000, orders: 68 },
        { productId: "sample-3", productName: "Leather Wallet (Sample)", units: 31, revenue: 16500, orders: 25 },
      ],
      cities: [
        { city: "New Delhi", orders: 98, units: 120, revenue: 58000 },
        { city: "Dwarka", orders: 60, units: 75, revenue: 35000 },
        { city: "Rohini", orders: 40, units: 46, revenue: 25500 },
      ]
    },
    { 
      state: "Karnataka", 
      stateCode: "KA", 
      orders: 176, 
      units: 203, 
      revenue: 98200, 
      percentageOfRevenue: 19.3, 
      percentageOfUnits: 17.7,
      products: [
        { productId: "sample-1", productName: "iPhone Case (Sample)", units: 105, revenue: 49000, orders: 90 },
        { productId: "sample-2", productName: "Wireless Charger (Sample)", units: 68, revenue: 34000, orders: 58 },
        { productId: "sample-3", productName: "Leather Wallet (Sample)", units: 30, revenue: 15200, orders: 28 },
      ],
      cities: [
        { city: "Bengaluru", orders: 115, units: 135, revenue: 65000 },
        { city: "Mysuru", orders: 41, units: 48, revenue: 22000 },
        { city: "Mangaluru", orders: 20, units: 20, revenue: 11200 },
      ]
    },
    { 
      state: "Uttar Pradesh", 
      stateCode: "UP", 
      orders: 143, 
      units: 188, 
      revenue: 91400, 
      percentageOfRevenue: 17.9, 
      percentageOfUnits: 16.4,
      products: [
        { productId: "sample-1", productName: "iPhone Case (Sample)", units: 98, revenue: 45000, orders: 74 },
        { productId: "sample-2", productName: "Wireless Charger (Sample)", units: 62, revenue: 31000, orders: 49 },
        { productId: "sample-3", productName: "Leather Wallet (Sample)", units: 28, revenue: 15400, orders: 20 },
      ],
      cities: [
        { city: "Noida", orders: 55, units: 70, revenue: 34000 },
        { city: "Lucknow", orders: 48, units: 68, revenue: 32400 },
        { city: "Kanpur", orders: 40, units: 50, revenue: 25000 },
      ]
    },
    { 
      state: "Rajasthan", 
      stateCode: "RJ", 
      orders: 121, 
      units: 152, 
      revenue: 72800, 
      percentageOfRevenue: 14.3, 
      percentageOfUnits: 13.2,
      products: [
        { productId: "sample-1", productName: "iPhone Case (Sample)", units: 82, revenue: 38000, orders: 65 },
        { productId: "sample-2", productName: "Wireless Charger (Sample)", units: 50, revenue: 25000, orders: 42 },
        { productId: "sample-3", productName: "Leather Wallet (Sample)", units: 20, revenue: 9800, orders: 14 },
      ],
      cities: [
        { city: "Jaipur", orders: 60, units: 75, revenue: 35000 },
        { city: "Jodhpur", orders: 38, units: 48, revenue: 22800 },
        { city: "Udaipur", orders: 23, units: 29, revenue: 15000 },
      ]
    },
    { 
      state: "Gujarat", 
      stateCode: "GJ", 
      orders: 98, 
      units: 119, 
      revenue: 61300, 
      percentageOfRevenue: 12.0, 
      percentageOfUnits: 10.4,
      products: [
        { productId: "sample-1", productName: "iPhone Case (Sample)", units: 65, revenue: 31000, orders: 52 },
        { productId: "sample-2", productName: "Wireless Charger (Sample)", units: 39, revenue: 20000, orders: 32 },
        { productId: "sample-3", productName: "Leather Wallet (Sample)", units: 15, revenue: 10300, orders: 14 },
      ],
      cities: [
        { city: "Ahmedabad", orders: 50, units: 62, revenue: 32000 },
        { city: "Surat", orders: 30, units: 37, revenue: 19000 },
        { city: "Vadodara", orders: 18, units: 20, revenue: 10300 },
      ]
    },
  ];

  const sampleRunningProducts: RunningProductItem[] = [
    { id: "sample-1", title: "iPhone Case (Sample)", orderCount: 566, units: 660, revenue: 287000 },
    { id: "sample-2", title: "Wireless Charger (Sample)", orderCount: 302, units: 366, revenue: 184400 },
    { id: "sample-3", title: "Leather Wallet (Sample)", orderCount: 135, units: 154, revenue: 76700 },
  ];

  const sampleCampaigns: CampaignAnalytics[] = [
    {
      campaign: "787778",
      orders: 312,
      units: 380,
      revenue: 165000,
      percentageOfRevenue: 30.6,
      percentageOfUnits: 28.9,
      states: [
        { state: "Maharashtra", stateCode: "MH", orders: 140, units: 172, revenue: 78000 },
        { state: "Delhi", stateCode: "DL", orders: 98, units: 118, revenue: 52000 },
        { state: "Karnataka", stateCode: "KA", orders: 74, units: 90, revenue: 35000 },
      ],
    },
    {
      campaign: "120253422144460721",
      orders: 210,
      units: 245,
      revenue: 108000,
      percentageOfRevenue: 20.0,
      percentageOfUnits: 18.6,
      states: [
        { state: "Delhi", stateCode: "DL", orders: 100, units: 120, revenue: 55000 },
        { state: "Uttar Pradesh", stateCode: "UP", orders: 65, units: 75, revenue: 32000 },
        { state: "Rajasthan", stateCode: "RJ", orders: 45, units: 50, revenue: 21000 },
      ],
    },
    {
      campaign: "120253470867910721",
      orders: 145,
      units: 172,
      revenue: 71000,
      percentageOfRevenue: 13.2,
      percentageOfUnits: 13.1,
      states: [
        { state: "Karnataka", stateCode: "KA", orders: 80, units: 95, revenue: 40000 },
        { state: "Gujarat", stateCode: "GJ", orders: 65, units: 77, revenue: 31000 },
      ],
    },
    {
      campaign: NO_CAMPAIGN_LABEL,
      orders: 314,
      units: 397,
      revenue: 190800,
      percentageOfRevenue: 35.4,
      percentageOfUnits: 30.2,
      states: [
        { state: "Maharashtra", stateCode: "MH", orders: 105, units: 140, revenue: 67000 },
        { state: "Gujarat", stateCode: "GJ", orders: 90, units: 112, revenue: 55800 },
        { state: "Rajasthan", stateCode: "RJ", orders: 76, units: 102, revenue: 47000 },
        { state: "Uttar Pradesh", stateCode: "UP", orders: 43, units: 43, revenue: 21000 },
      ],
    },
  ];

  const totalOrders = sampleStates.reduce((acc, s) => acc + s.orders, 0);
  const totalUnits = sampleStates.reduce((acc, s) => acc + s.units, 0);
  const totalRevenue = sampleStates.reduce((acc, s) => acc + s.revenue, 0);

  return {
    summary: {
      totalOrders,
      totalUnits,
      totalRevenue,
      currency: "INR",
      topState: "Maharashtra",
      topStateUnits: 312,
      topStateRevenue: 145000,
    },
    states: sampleStates,
    runningProducts: sampleRunningProducts,
    campaigns: sampleCampaigns,
  };
}
