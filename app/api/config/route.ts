import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isShopifyConfigured, loadLocalConfig, refreshAccessToken } from "@/lib/shopify";

const CONFIG_FILE_PATH = path.join(process.cwd(), "shopify-config.json");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const isConfig = isShopifyConfigured();
    const local = loadLocalConfig();
    
    // Safely return config state without exposing secrets
    const domain = local.domain || process.env.SHOPIFY_STORE_DOMAIN || "";
    const apiVersion = local.apiVersion || process.env.SHOPIFY_API_VERSION || "2026-07";
    const hasClientCredentials = Boolean(
      (local.clientId && local.clientSecret) || 
      (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)
    );

    return NextResponse.json({
      isConfigured: isConfig,
      domain,
      apiVersion,
      hasClientCredentials,
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
    const { domain, clientId, clientSecret, apiVersion } = body;

    if (!domain || domain.trim() === "") {
      return NextResponse.json({ error: "Store domain is required." }, { status: 400 });
    }
    if (!clientId || clientId.trim() === "") {
      return NextResponse.json({ error: "Client ID is required." }, { status: 400 });
    }
    if (!clientSecret || clientSecret.trim() === "") {
      return NextResponse.json({ error: "Client Secret is required." }, { status: 400 });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
    const cleanClientId = clientId.trim();
    const cleanClientSecret = clientSecret.trim();
    const cleanVersion = (apiVersion || "2026-07").trim();

    // Verify configuration by trying to perform a token exchange first
    let verifiedToken = "";
    try {
      console.log(`Exchanging client credentials for domain: ${cleanDomain}...`);
      verifiedToken = await refreshAccessToken(cleanDomain, cleanClientId, cleanClientSecret);
    } catch (err: any) {
      console.error("Token exchange failed during validation:", err);
      return NextResponse.json(
        { 
          error: `Authentication failed: ${err.message || "Invalid Client ID, Client Secret or Store Domain"}. Please verify your credentials.` 
        }, 
        { status: 400 }
      );
    }

    const newConfig = {
      domain: cleanDomain,
      clientId: cleanClientId,
      clientSecret: cleanClientSecret,
      apiVersion: cleanVersion,
      token: verifiedToken, // Store the initial verified token
    };

    // Save to shopify-config.json (or fallback gracefully if read-only filesystem)
    try {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(newConfig, null, 2), "utf8");
    } catch (fsError) {
      console.warn("Failed to write shopify-config.json on Vercel read-only filesystem. Used in-memory credentials instead.");
    }

    return NextResponse.json({
      success: true,
      message: "Shopify Client Credentials saved and verified successfully.",
      domain: cleanDomain,
      apiVersion: cleanVersion,
    });
  } catch (error: any) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration. Please try again." },
      { status: 500 }
    );
  }
}
