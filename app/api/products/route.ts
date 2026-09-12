import { NextResponse } from "next/server";
import { isShopifyConfigured, shopifyFetch } from "@/lib/shopify";
import { GET_PRODUCTS_QUERY } from "@/lib/shopify-queries";
import { ShopifyProductsQueryResponse, ShopifyProductItem } from "@/types/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isShopifyConfigured()) {
      return NextResponse.json({
        isConfigured: false,
        products: [
          { id: "sample-1", title: "iPhone Case (Sample)" },
          { id: "sample-2", title: "Wireless Charger (Sample)" },
          { id: "sample-3", title: "Leather Wallet (Sample)" },
        ],
        message: "Shopify credentials are not set. Provide SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in .env.local",
      });
    }

    const allProducts: ShopifyProductItem[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = 10; // Safety cap to avoid infinite loops

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      const data: ShopifyProductsQueryResponse = await shopifyFetch<ShopifyProductsQueryResponse>({
        query: GET_PRODUCTS_QUERY,
        variables: { cursor },
      });

      if (data?.products?.nodes) {
        for (const item of data.products.nodes) {
          allProducts.push({
            id: item.id,
            title: item.title,
          });
        }
      }

      hasNextPage = data?.products?.pageInfo?.hasNextPage || false;
      cursor = data?.products?.pageInfo?.endCursor || null;
    }

    return NextResponse.json({
      isConfigured: true,
      products: allProducts,
    });
  } catch (error: any) {
    console.error("Error fetching Shopify products:", error);
    return NextResponse.json(
      {
        error: "Unable to load Shopify products. Please check your Shopify connection.",
        isConfigured: isShopifyConfigured(),
        products: [],
      },
      { status: 500 }
    );
  }
}
