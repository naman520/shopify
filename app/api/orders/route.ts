import { NextRequest, NextResponse } from "next/server";
import { isShopifyConfigured, shopifyFetch } from "@/lib/shopify";
import { GET_ORDERS_QUERY, GET_ORDERS_COUNT_QUERY } from "@/lib/shopify-queries";
import { calculateStateAnalytics, getSampleAnalytics } from "@/lib/order-analytics";
import { ShopifyOrderNode, ShopifyOrdersQueryResponse } from "@/types/shopify";

export const dynamic = "force-dynamic";

const ORDERS_PER_PAGE = 250;
const MAX_PAGES = 40;
const MAX_ORDERS = ORDERS_PER_PAGE * MAX_PAGES;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 12;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

interface CachedRange {
  orders: ShopifyOrderNode[];
  totalAvailable: number;
  truncated: boolean;
  fetchedAt: number;
}

// Raw orders are cached per date range, not per product: switching the product filter
// re-runs the aggregation over the same orders instead of re-crawling the Shopify API.
const ordersCache = new Map<string, CachedRange>();

function readCache(key: string): CachedRange | undefined {
  const hit = ordersCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.fetchedAt > CACHE_TTL_MS) {
    ordersCache.delete(key);
    return undefined;
  }
  return hit;
}

function writeCache(key: string, entry: CachedRange) {
  ordersCache.set(key, entry);
  while (ordersCache.size > MAX_CACHE_ENTRIES) {
    const oldest = ordersCache.keys().next().value;
    if (oldest === undefined) break;
    ordersCache.delete(oldest);
  }
}

function buildShopifyQuery(startDate: string | null, endDate: string | null): string {
  // Timestamps carry the store's local offset (IST) and must be quoted for Shopify's parser.
  const parts: string[] = [];
  if (startDate) {
    const start = startDate.includes("T") ? startDate : `${startDate}T00:00:00+05:30`;
    parts.push(`created_at:>='${start}'`);
  }
  if (endDate) {
    const end = endDate.includes("T") ? endDate : `${endDate}T23:59:59+05:30`;
    parts.push(`created_at:<='${end}'`);
  }
  return parts.join(" ");
}

async function fetchOrdersForRange(shopifyQuery: string): Promise<CachedRange> {
  const countData = await shopifyFetch<{
    ordersCount: { count: number; precision: string };
  }>({ query: GET_ORDERS_COUNT_QUERY, variables: { query: shopifyQuery } });

  const totalAvailable = countData?.ordersCount?.count ?? 0;

  const orders: ShopifyOrderNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let page = 0;

  while (hasNextPage && page < MAX_PAGES) {
    page++;
    const data: ShopifyOrdersQueryResponse = await shopifyFetch<ShopifyOrdersQueryResponse>({
      query: GET_ORDERS_QUERY,
      variables: { cursor, query: shopifyQuery },
    });

    if (data?.orders?.nodes) {
      orders.push(...data.orders.nodes);
    }

    hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
    cursor = data?.orders?.pageInfo?.endCursor || null;
  }

  return {
    orders,
    totalAvailable,
    truncated: hasNextPage || totalAvailable > orders.length,
    fetchedAt: Date.now(),
  };
}

/**
 * Refresh a cached range without crawling the entire date range again. Shopify
 * returns newest orders first, so querying from the newest cached timestamp is
 * enough to discover new leads while keeping the scheduled refresh inexpensive.
 * Orders with the same timestamp are de-duplicated by ID during the merge.
 */
async function refreshLatestOrdersForRange(
  shopifyQuery: string,
  cached: CachedRange
): Promise<CachedRange> {
  if (cached.orders.length === 0) {
    return fetchOrdersForRange(shopifyQuery);
  }

  const countData = await shopifyFetch<{
    ordersCount: { count: number; precision: string };
  }>({ query: GET_ORDERS_COUNT_QUERY, variables: { query: shopifyQuery } });

  const newestCreatedAt = cached.orders.reduce(
    (newest, order) => (order.createdAt > newest ? order.createdAt : newest),
    cached.orders[0].createdAt
  );
  const latestQuery = [shopifyQuery, `created_at:>='${newestCreatedAt}'`]
    .filter(Boolean)
    .join(" ");

  const latestOrders: ShopifyOrderNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let page = 0;

  while (hasNextPage && page < MAX_PAGES) {
    page++;
    const data: ShopifyOrdersQueryResponse = await shopifyFetch<ShopifyOrdersQueryResponse>({
      query: GET_ORDERS_QUERY,
      variables: { cursor, query: latestQuery },
    });

    if (data?.orders?.nodes) {
      latestOrders.push(...data.orders.nodes);
    }

    hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
    cursor = data?.orders?.pageInfo?.endCursor || null;
  }

  const ordersById = new Map(cached.orders.map((order) => [order.id, order]));
  for (const order of latestOrders) {
    ordersById.set(order.id, order);
  }

  const orders = Array.from(ordersById.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ORDERS);
  const totalAvailable = countData?.ordersCount?.count ?? orders.length;

  return {
    orders,
    totalAvailable,
    truncated: hasNextPage || totalAvailable > orders.length,
    fetchedAt: Date.now(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get("productId") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const refreshMode = searchParams.get("refresh");

    if (!isShopifyConfigured()) {
      const sample = getSampleAnalytics();
      return NextResponse.json(
        {
          isConfigured: false,
          summary: sample.summary,
          states: sample.states,
          runningProducts: sample.runningProducts || [],
          campaigns: sample.campaigns || [],
          totalCount: sample.summary.totalOrders,
          totalAvailable: sample.summary.totalOrders,
          truncated: false,
          fetchedAt: Date.now(),
          message: "Shopify credentials not configured. Displaying demo analytics.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const shopifyQuery = buildShopifyQuery(startDate, endDate);
    const cacheKey = `${startDate || "*"}|${endDate || "*"}`;

    let range = readCache(cacheKey);
    let syncMode: "cache" | "incremental" | "full" = "cache";
    if (!range || refreshMode === "full") {
      range = await fetchOrdersForRange(shopifyQuery);
      writeCache(cacheKey, range);
      syncMode = "full";
    } else if (refreshMode === "latest") {
      range = await refreshLatestOrdersForRange(shopifyQuery, range);
      writeCache(cacheKey, range);
      syncMode = "incremental";
    }

    const { summary, states, runningProducts, campaigns } = calculateStateAnalytics(
      range.orders,
      productId
    );

    return NextResponse.json(
      {
        isConfigured: true,
        summary,
        states,
        runningProducts,
        campaigns,
        totalCount: range.orders.length,
        totalAvailable: range.totalAvailable,
        truncated: range.truncated,
        maxOrders: MAX_ORDERS,
        fetchedAt: range.fetchedAt,
        syncMode,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: any) {
    console.error("Error fetching or processing Shopify orders:", error);
    const detail = error?.message ? String(error.message) : "Unknown error";
    return NextResponse.json(
      {
        error: `Unable to load Shopify data: ${detail}`,
        isConfigured: isShopifyConfigured(),
        summary: {
          totalOrders: 0,
          totalUnits: 0,
          totalRevenue: 0,
          currency: "INR",
          topState: "N/A",
        },
        states: [],
        runningProducts: [],
        campaigns: [],
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
