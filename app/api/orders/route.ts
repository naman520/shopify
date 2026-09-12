import { NextRequest, NextResponse } from "next/server";
import { isShopifyConfigured, shopifyFetch } from "@/lib/shopify";
import { GET_ORDERS_QUERY } from "@/lib/shopify-queries";
import { calculateStateAnalytics, getSampleAnalytics } from "@/lib/order-analytics";
import { ShopifyOrderNode, ShopifyOrdersQueryResponse } from "@/types/shopify";

export const dynamic = "force-dynamic";

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
        message: "Shopify credentials not configured. Displaying demo analytics.",
      });
    }

    // Build Shopify Search Query matching store local timezone (IST +05:30)
    // Note: In Shopify query syntax, timestamps with colons MUST be enclosed in quotes
    const queryParts: string[] = ["status:any"];

    if (startDate) {
      const formattedStart = startDate.includes("T") ? startDate : `${startDate}T00:00:00+05:30`;
      queryParts.push(`created_at:>='${formattedStart}'`);
    }
    if (endDate) {
      const formattedEnd = endDate.includes("T") ? endDate : `${endDate}T23:59:59+05:30`;
      queryParts.push(`created_at:<='${formattedEnd}'`);
    }

    const shopifyQuery = queryParts.join(" ");

    const allOrders: ShopifyOrderNode[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = 20; // Allows up to 2,000 orders per request for fast response

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      const data: ShopifyOrdersQueryResponse = await shopifyFetch<ShopifyOrdersQueryResponse>({
        query: GET_ORDERS_QUERY,
        variables: {
          cursor,
          query: shopifyQuery,
        },
      });

      if (data?.orders?.nodes) {
        allOrders.push(...data.orders.nodes);
      }

      hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
      cursor = data?.orders?.pageInfo?.endCursor || null;
    }

    // Process orders through normalization and state analytics calculation
    const { summary, states, runningProducts, campaigns } = calculateStateAnalytics(allOrders, productId);

    return NextResponse.json({
      isConfigured: true,
      summary,
      states,
      runningProducts,
      campaigns,
      totalCount: allOrders.length,
    });
  } catch (error: any) {
    console.error("Error fetching or processing Shopify orders:", error);
    return NextResponse.json(
      {
        error: "Unable to load Shopify data. Please check your Shopify connection and try again.",
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
