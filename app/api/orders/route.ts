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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get("productId") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!isShopifyConfigured()) {
      const sample = getSampleAnalytics();
      return NextResponse.json({
        isConfigured: false,
        summary: sample.summary,
        states: sample.states,
        runningProducts: sample.runningProducts || [],
        campaigns: sample.campaigns || [],
        totalCount: sample.summary.totalOrders,
        totalAvailable: sample.summary.totalOrders,
        truncated: false,
        message: "Shopify credentials not configured. Displaying demo analytics.",
      });
    }

    const shopifyQuery = buildShopifyQuery(startDate, endDate);
    const cacheKey = `${startDate || "*"}|${endDate || "*"}`;

    let range = readCache(cacheKey);
    if (!range) {
      range = await fetchOrdersForRange(shopifyQuery);
      writeCache(cacheKey, range);
    }

    const { summary, states, runningProducts, campaigns } = calculateStateAnalytics(
      range.orders,
      productId
    );

    return NextResponse.json({
      isConfigured: true,
      summary,
      states,
      runningProducts,
      campaigns,
      totalCount: range.orders.length,
      totalAvailable: range.totalAvailable,
      truncated: range.truncated,
      maxOrders: MAX_ORDERS,
    });
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
      { status: 500 }
    );
  }
}
