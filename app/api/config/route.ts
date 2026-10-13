import { NextRequest, NextResponse } from "next/server";
import {
  deleteStoreConfig,
  isShopifyConfigured,
  loadStores,
  refreshAccessToken,
  saveStoreConfig,
} from "@/lib/shopify-multi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stores = loadStores();
    const publicStores = stores.map((store) => ({
      id: store.id,
      name: store.name,
      domain: store.domain || "",
      apiVersion: store.apiVersion || "2026-10",
      isConfigured: isShopifyConfigured(store.id),
      hasClientCredentials: Boolean(store.clientId && store.clientSecret),
      environmentManaged: store.environmentManaged || false,
    }));
    const firstStore = publicStores[0];

    return NextResponse.json({
      isConfigured: publicStores.some((store) => store.isConfigured),
      stores: publicStores,
      // Legacy fields keep older dashboard clients working during deployment.
      domain: firstStore?.domain || "",
      apiVersion: firstStore?.apiVersion || "2026-10",
      hasClientCredentials: firstStore?.hasClientCredentials || false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to read configuration status." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storeId, name, domain, clientId, clientSecret, apiVersion } = body;
    const stores = loadStores();
    const existing = storeId ? stores.find((store) => store.id === storeId) : undefined;

    if (existing?.environmentManaged) {
      return NextResponse.json(
        { error: "This store is managed through Vercel environment variables." },
        { status: 409 }
      );
    }

    if (!domain || domain.trim() === "") {
      return NextResponse.json({ error: "Store domain is required." }, { status: 400 });
    }
    const resolvedClientId = clientId?.trim() || existing?.clientId || "";
    const resolvedClientSecret = clientSecret?.trim() || existing?.clientSecret || "";
    if (!resolvedClientId) {
      return NextResponse.json({ error: "Client ID is required." }, { status: 400 });
    }
    if (!resolvedClientSecret) {
      return NextResponse.json({ error: "Client Secret is required." }, { status: 400 });
    }
    if (!existing && stores.length >= 2) {
      return NextResponse.json(
        { error: "Maximum two Shopify stores can be connected." },
        { status: 400 }
      );
    }

    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
    const cleanVersion = (apiVersion || "2026-10").trim();
    const id = existing?.id || `store-${Date.now().toString(36)}`;

    // Verify configuration by trying to perform a token exchange first
    let verifiedToken = "";
    try {
      console.log(`Exchanging client credentials for domain: ${cleanDomain}...`);
      verifiedToken = await refreshAccessToken(
        cleanDomain,
        resolvedClientId,
        resolvedClientSecret,
        id,
        false
      );
    } catch (err: any) {
      console.error("Token exchange failed during validation:", err);
      return NextResponse.json(
        { 
          error: `Authentication failed: ${err.message || "Invalid Client ID, Client Secret or Store Domain"}. Please verify your credentials.` 
        }, 
        { status: 400 }
      );
    }

    const saved = saveStoreConfig({
      id,
      name: String(name || existing?.name || cleanDomain.replace(/\.myshopify\.com$/i, "")).trim(),
      domain: cleanDomain,
      clientId: resolvedClientId,
      clientSecret: resolvedClientSecret,
      apiVersion: cleanVersion,
      token: verifiedToken,
    });

    return NextResponse.json({
      success: true,
      message: "Shopify store saved and verified successfully.",
      store: {
        id: saved.id,
        name: saved.name,
        domain: saved.domain,
        apiVersion: saved.apiVersion,
        isConfigured: true,
        hasClientCredentials: true,
      },
    });
  } catch (error: any) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return NextResponse.json({ error: "Store ID is required." }, { status: 400 });
    }
    if (!loadStores().some((store) => store.id === storeId)) {
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }
    if (loadStores().find((store) => store.id === storeId)?.environmentManaged) {
      return NextResponse.json(
        { error: "Environment-managed stores cannot be removed from the dashboard." },
        { status: 409 }
      );
    }
    deleteStoreConfig(storeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting store config:", error);
    return NextResponse.json({ error: "Failed to remove store." }, { status: 500 });
  }
}
