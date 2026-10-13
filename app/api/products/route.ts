import { NextRequest, NextResponse } from "next/server";
import { isShopifyConfigured, loadStores, shopifyFetch } from "@/lib/shopify-multi";
import { GET_PRODUCTS_QUERY } from "@/lib/shopify-queries";
import { ShopifyProductsQueryResponse, ShopifyProductItem } from "@/types/shopify";

export const dynamic = "force-dynamic";

async function fetchProductsForStore(storeId: string) {
  const products: ShopifyProductItem[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  let pageCount = 0;

  while (hasNextPage && pageCount < 10) {
    pageCount++;
    const data: ShopifyProductsQueryResponse = await shopifyFetch<ShopifyProductsQueryResponse>({
      query: GET_PRODUCTS_QUERY,
      variables: { cursor },
      storeId,
    });
    for (const item of data?.products?.nodes || []) {
      products.push({ id: item.id, title: item.title });
    }
    hasNextPage = data?.products?.pageInfo?.hasNextPage || false;
    cursor = data?.products?.pageInfo?.endCursor || null;
  }
  return products;
}

export async function GET(request: NextRequest) {
  try {
    const storeId = request.nextUrl.searchParams.get("storeId") || "all";
    const configuredStores = loadStores().filter((store) => isShopifyConfigured(store.id));
    const selectedStores =
      storeId === "all"
        ? configuredStores
        : configuredStores.filter((store) => store.id === storeId);

    if (selectedStores.length === 0) {
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

    const settled = await Promise.allSettled(
      selectedStores.map(async (store) => ({
        store,
        products: await fetchProductsForStore(store.id),
      }))
    );
    const successful = settled.filter(
      (result): result is PromiseFulfilledResult<{
        store: typeof selectedStores[number];
        products: ShopifyProductItem[];
      }> => result.status === "fulfilled"
    );
    if (successful.length === 0) {
      throw settled.find((result) => result.status === "rejected")?.reason || new Error("No store data available.");
    }
    const isCombined = storeId === "all";
    const allProducts = successful.flatMap(({ value }) =>
      value.products.map((product) =>
        isCombined
          ? {
              ...product,
              id: `${value.store.id}:${product.id}`,
              title: `${product.title} — ${value.store.name}`,
            }
          : product
      )
    );

    return NextResponse.json({
      isConfigured: true,
      products: allProducts,
      partialData: successful.length < selectedStores.length,
    });
  } catch (error: any) {
    console.error("Error fetching Shopify products:", error);
    return NextResponse.json(
      {
        error: "Unable to load Shopify products. Please check your Shopify connection.",
        isConfigured: isShopifyConfigured(request.nextUrl.searchParams.get("storeId")),
        products: [],
      },
      { status: 500 }
    );
  }
}
