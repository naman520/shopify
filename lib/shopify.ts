import fs from "fs";
import path from "path";

const CONFIG_FILE_PATH = path.join(process.cwd(), "shopify-config.json");

// In-memory token cache to support read-only environments (like Vercel serverless functions)
let inMemoryToken = "";

export class ShopifyConfigurationError extends Error {
  constructor(message = "Shopify credentials are not properly configured") {
    super(message);
    this.name = "ShopifyConfigurationError";
  }
}

export class ShopifyApiError extends Error {
  public errors: any[];
  public status?: number;

  constructor(message: string, errors: any[] = [], status?: number) {
    super(message);
    this.name = "ShopifyApiError";
    this.errors = errors;
    this.status = status;
  }
}

export interface LocalConfig {
  domain?: string;
  clientId?: string;
  clientSecret?: string;
  token?: string; // Exchanged cached access token
  apiVersion?: string;
}

export function loadLocalConfig(): LocalConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
      const parsed = JSON.parse(content);
      return {
        domain: parsed.domain?.trim(),
        clientId: parsed.clientId?.trim(),
        clientSecret: parsed.clientSecret?.trim(),
        token: parsed.token?.trim(),
        apiVersion: parsed.apiVersion?.trim(),
      };
    }
  } catch (error) {
    console.error("Failed to read shopify-config.json:", error);
  }
  return {};
}

/**
 * Saves configuration back to shopify-config.json (and updates in-memory token)
 */
export function saveLocalConfig(newConfig: LocalConfig) {
  if (newConfig.token) {
    inMemoryToken = newConfig.token;
  }
  try {
    const current = loadLocalConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), "utf8");
  } catch (error) {
    console.warn("Failed to write config file (could be a read-only environment like Vercel):", error);
  }
}

/**
 * Automatic token refresh via Client Credentials flow
 */
export async function refreshAccessToken(
  domain: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const sanitizedDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const tokenUrl = `https://${sanitizedDomain}/admin/oauth/access_token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new ShopifyApiError(
      `Shopify OAuth token exchange failed with status ${response.status}: ${response.statusText}`,
      [{ message: errorBody }],
      response.status
    );
  }

  const data = await response.json();
  const token = data.access_token;

  if (!token) {
    throw new ShopifyApiError("Shopify OAuth response did not contain an access_token", [
      { message: JSON.stringify(data) },
    ]);
  }

  // Save token in memory and local config (if writeable)
  saveLocalConfig({ token });

  return token;
}

export function isShopifyConfigured(): boolean {
  const local = loadLocalConfig();
  const domain = local.domain || process.env.SHOPIFY_STORE_DOMAIN;
  const token = inMemoryToken || local.token || process.env.SHOPIFY_ACCESS_TOKEN;
  const hasClientCredentials = 
    (local.clientId && local.clientSecret) || 
    (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);

  return Boolean(domain && (token || hasClientCredentials));
}

export async function getShopifyConfig() {
  const local = loadLocalConfig();
  const rawDomain = local.domain || process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = local.apiVersion || process.env.SHOPIFY_API_VERSION || "2026-07";

  let token = inMemoryToken || local.token || process.env.SHOPIFY_ACCESS_TOKEN;
  const clientId = local.clientId || process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = local.clientSecret || process.env.SHOPIFY_CLIENT_SECRET;

  if (!rawDomain || rawDomain.trim() === "") {
    throw new ShopifyConfigurationError("Missing SHOPIFY_STORE_DOMAIN in settings.");
  }

  // If token is missing but client credentials exist, perform initial refresh
  if (!token && clientId && clientSecret) {
    try {
      token = await refreshAccessToken(rawDomain, clientId, clientSecret);
    } catch (err: any) {
      throw new ShopifyConfigurationError(
        `Failed to generate token on configuration load: ${err.message}`
      );
    }
  }

  if (!token || token.trim() === "") {
    throw new ShopifyConfigurationError(
      "Missing SHOPIFY_ACCESS_TOKEN or client credentials (Client ID & Client Secret) in configuration."
    );
  }

  const domain = rawDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  return {
    domain,
    token: token.trim(),
    apiVersion: apiVersion.trim(),
    endpoint: `https://${domain}/admin/api/${apiVersion}/graphql.json`,
    clientId,
    clientSecret,
  };
}

export async function shopifyFetch<T>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, any>;
}): Promise<T> {
  const config = await getShopifyConfig();

  const runFetch = async (accessToken: string) => {
    return fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store",
    });
  };

  let response = await runFetch(config.token);

  // If token is expired (401 Unauthorized) and we have client credentials, refresh token and retry
  if (response.status === 401 && config.clientId && config.clientSecret) {
    console.log("Access token expired (401). Refreshing token using Client Credentials...");
    try {
      const freshToken = await refreshAccessToken(
        config.domain,
        config.clientId,
        config.clientSecret
      );
      response = await runFetch(freshToken);
    } catch (refreshErr) {
      console.error("Token refresh failed during fetch retry:", refreshErr);
    }
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new ShopifyApiError(
      `Shopify Admin API HTTP error ${response.status}: ${response.statusText}`,
      [{ message: errorBody }],
      response.status
    );
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    const errorMsg = result.errors.map((e: any) => e.message).join(", ");
    
    // Check if GraphQL error is related to invalid access token and try refreshing
    const isTokenError = result.errors.some(
      (e: any) =>
        e.message?.toLowerCase().includes("access token") ||
        e.message?.toLowerCase().includes("unauthorized")
    );

    if (isTokenError && config.clientId && config.clientSecret) {
      console.log("GraphQL reported token issue. Refreshing token...");
      try {
        const freshToken = await refreshAccessToken(
          config.domain,
          config.clientId,
          config.clientSecret
        );
        const retryResponse = await runFetch(freshToken);
        if (retryResponse.ok) {
          const retryResult = await retryResponse.json();
          if (!retryResult.errors || retryResult.errors.length === 0) {
            return retryResult.data as T;
          }
        }
      } catch (refreshErr) {
        console.error("Token refresh failed during GraphQL retry:", refreshErr);
      }
    }

    throw new ShopifyApiError(`Shopify GraphQL Error: ${errorMsg}`, result.errors);
  }

  return result.data as T;
}
