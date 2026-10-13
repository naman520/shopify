import fs from "fs";
import path from "path";

const CONFIG_FILE_PATH = path.join(process.cwd(), "shopify-config.json");
const DEFAULT_API_VERSION = "2026-10";
const inMemoryTokens = new Map<string, string>();

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
  token?: string;
  apiVersion?: string;
}

export interface ShopifyStoreConfig extends LocalConfig {
  id: string;
  name: string;
  environmentManaged?: boolean;
}

interface ConfigFile extends LocalConfig {
  stores?: ShopifyStoreConfig[];
}

function cleanDomain(domain = "") {
  return domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
}

function defaultStoreName(domain: string, index = 0) {
  return domain.replace(/\.myshopify\.com$/i, "") || `Store ${index + 1}`;
}

function normalizeStore(store: Partial<ShopifyStoreConfig>, index: number): ShopifyStoreConfig {
  const domain = cleanDomain(store.domain);
  return {
    id: String(store.id || `store-${index + 1}`).trim(),
    name: String(store.name || defaultStoreName(domain, index)).trim(),
    domain,
    clientId: store.clientId?.trim(),
    clientSecret: store.clientSecret?.trim(),
    token: store.token?.trim(),
    apiVersion: store.apiVersion?.trim() || DEFAULT_API_VERSION,
    environmentManaged: store.environmentManaged || false,
  };
}

function readConfigFile(): ConfigFile {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf8"));
    }
  } catch (error) {
    console.error("Failed to read shopify-config.json:", error);
  }
  return {};
}

/**
 * Environment variables are the source of truth on Vercel. The second store uses
 * the existing SHOPIFY_DOMAIN / *_2 variable names from this project.
 */
export function loadStores(): ShopifyStoreConfig[] {
  const parsed = readConfigFile();
  const firstDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const secondDomain = process.env.SHOPIFY_DOMAIN?.trim();
  const hasEnvironmentConfig = Boolean(
    firstDomain ||
      secondDomain ||
      process.env.SHOPIFY_CLIENT_ID ||
      process.env.SHOPIFY_CLIENT_ID_2
  );

  if (hasEnvironmentConfig) {
    const stores: ShopifyStoreConfig[] = [];
    if (firstDomain) {
      stores.push(
        normalizeStore(
          {
            id: "store-1",
            name: process.env.SHOPIFY_STORE_NAME || defaultStoreName(cleanDomain(firstDomain), 0),
            domain: firstDomain,
            clientId: process.env.SHOPIFY_CLIENT_ID,
            clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
            token: process.env.SHOPIFY_ACCESS_TOKEN || (!parsed.stores ? parsed.token : undefined),
            apiVersion: process.env.SHOPIFY_API_VERSION,
            environmentManaged: true,
          },
          0
        )
      );
    }
    if (secondDomain) {
      stores.push(
        normalizeStore(
          {
            id: "store-2",
            name:
              process.env.SHOPIFY_STORE_NAME_2 || defaultStoreName(cleanDomain(secondDomain), 1),
            domain: secondDomain,
            clientId: process.env.SHOPIFY_CLIENT_ID_2,
            clientSecret: process.env.SHOPIFY_CLIENT_SECRET_2,
            token: process.env.SHOPIFY_ACCESS_TOKEN_2,
            apiVersion: process.env.SHOPIFY_API_VERSION_2 || process.env.SHOPIFY_API_VERSION,
            environmentManaged: true,
          },
          1
        )
      );
    }
    return stores;
  }

  if (Array.isArray(parsed.stores)) {
    return parsed.stores.slice(0, 2).map(normalizeStore);
  }

  const legacyDomain = parsed.domain?.trim();
  const hasLegacyConfig = Boolean(
    legacyDomain || parsed.token || parsed.clientId
  );
  if (!hasLegacyConfig) return [];

  return [
    normalizeStore(
      {
        id: "store-1",
        name: defaultStoreName(cleanDomain(legacyDomain), 0),
        domain: legacyDomain,
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        token: parsed.token,
        apiVersion: parsed.apiVersion,
      },
      0
    ),
  ];
}

function writeStores(stores: ShopifyStoreConfig[]) {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({ stores }, null, 2), "utf8");
  } catch (error) {
    console.warn(
      "Failed to write config file (the deployment filesystem may be read-only):",
      error
    );
  }
}

export function saveStoreConfig(store: ShopifyStoreConfig) {
  const stores = loadStores();
  const normalized = normalizeStore(store, stores.length);
  const index = stores.findIndex((item) => item.id === normalized.id);

  if (normalized.token) inMemoryTokens.set(normalized.id, normalized.token);
  if (index >= 0) stores[index] = normalized;
  else if (stores.length < 2) stores.push(normalized);
  else throw new ShopifyConfigurationError("Only two Shopify stores can be connected.");

  writeStores(stores);
  return normalized;
}

export function deleteStoreConfig(storeId: string) {
  const stores = loadStores().filter((store) => store.id !== storeId);
  inMemoryTokens.delete(storeId);
  writeStores(stores);
}

export function getStoreConfig(storeId?: string | null): ShopifyStoreConfig | undefined {
  const stores = loadStores();
  return (storeId ? stores.find((store) => store.id === storeId) : stores[0]) || undefined;
}

export async function refreshAccessToken(
  domain: string,
  clientId: string,
  clientSecret: string,
  storeId = "store-1",
  persist = true
): Promise<string> {
  const sanitizedDomain = cleanDomain(domain);
  const response = await fetch(`https://${sanitizedDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

  inMemoryTokens.set(storeId, token);
  if (persist) {
    const current = getStoreConfig(storeId);
    if (current && !current.environmentManaged) saveStoreConfig({ ...current, token });
  }
  return token;
}

export function isShopifyConfigured(storeId?: string | null): boolean {
  if (storeId === "all") {
    return loadStores().some((store) => isShopifyConfigured(store.id));
  }
  const store = getStoreConfig(storeId);
  if (!store?.domain) return false;
  const token = inMemoryTokens.get(store.id) || store.token;
  return Boolean(token || (store.clientId && store.clientSecret));
}

export async function getShopifyConfig(storeId?: string | null) {
  const store = getStoreConfig(storeId);
  if (!store?.domain) {
    throw new ShopifyConfigurationError(
      storeId ? "The selected Shopify store is not configured." : "No Shopify store is configured."
    );
  }
  const domain = store.domain;

  let token = inMemoryTokens.get(store.id) || store.token;
  if (!token && store.clientId && store.clientSecret) {
    try {
      token = await refreshAccessToken(
        domain,
        store.clientId,
        store.clientSecret,
        store.id
      );
    } catch (error: any) {
      throw new ShopifyConfigurationError(`Failed to generate token: ${error.message}`);
    }
  }
  if (!token) {
    throw new ShopifyConfigurationError(
      "Missing access token or client credentials for the selected store."
    );
  }

  const apiVersion = store.apiVersion || DEFAULT_API_VERSION;
  return {
    ...store,
    domain,
    token,
    apiVersion,
    endpoint: `https://${domain}/admin/api/${apiVersion}/graphql.json`,
  };
}

const MAX_THROTTLE_RETRIES = 5;

function isThrottledError(errors: any[]): boolean {
  return errors.some(
    (error: any) =>
      error?.extensions?.code === "THROTTLED" ||
      error?.message?.toLowerCase().includes("throttled")
  );
}

function isTokenError(errors: any[]): boolean {
  return errors.some(
    (error: any) =>
      error?.message?.toLowerCase().includes("access token") ||
      error?.message?.toLowerCase().includes("unauthorized")
  );
}

export async function shopifyFetch<T>({
  query,
  variables = {},
  storeId,
}: {
  query: string;
  variables?: Record<string, any>;
  storeId?: string | null;
}): Promise<T> {
  const config = await getShopifyConfig(storeId);
  let accessToken = config.token;

  const runFetch = (token: string) =>
    fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

  for (let attempt = 0; ; attempt++) {
    let response = await runFetch(accessToken);

    if (response.status === 401 && config.clientId && config.clientSecret) {
      accessToken = await refreshAccessToken(
        config.domain,
        config.clientId,
        config.clientSecret,
        config.id
      );
      response = await runFetch(accessToken);
    }

    if (response.status === 429 && attempt < MAX_THROTTLE_RETRIES) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After"));
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.min(10000, Math.max(250, retryAfterSeconds * 1000))
        : Math.min(10000, 1000 * (attempt + 1));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
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
    const errors: any[] = result.errors || [];
    if (errors.length === 0) return result.data as T;

    if (isThrottledError(errors) && attempt < MAX_THROTTLE_RETRIES) {
      const available = result.extensions?.cost?.throttleStatus?.currentlyAvailable ?? 0;
      const restoreRate = result.extensions?.cost?.throttleStatus?.restoreRate || 100;
      const needed = result.extensions?.cost?.requestedQueryCost ?? 100;
      const waitMs = Math.min(
        10000,
        Math.ceil(Math.max(0, (needed - available) / restoreRate) * 1000) +
          250 * (attempt + 1)
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (
      isTokenError(errors) &&
      config.clientId &&
      config.clientSecret &&
      attempt === 0
    ) {
      accessToken = await refreshAccessToken(
        config.domain,
        config.clientId,
        config.clientSecret,
        config.id
      );
      continue;
    }

    throw new ShopifyApiError(
      `Shopify GraphQL Error: ${errors.map((error: any) => error.message).join(", ")}`,
      errors
    );
  }
}
