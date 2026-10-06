"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

import { Header } from "./Header";
import { StatsCards } from "./StatsCards";
import { ProductSelector } from "./ProductSelector";
import { DateRangeFilter } from "./DateRangeFilter";
import { StateOrdersTable } from "./StateOrdersTable";
import { CampaignOrdersTable } from "./CampaignOrdersTable";
import { SettingsModal } from "./SettingsModal";
import { ShopifyProductItem, OrdersApiResponse, ProductsApiResponse } from "@/types/shopify";
import { formatDateInputValue, formatDateDisplay, formatNumber } from "@/lib/formatters";
import { AlertTriangle, RefreshCw, KeyRound, MapPin, Megaphone } from "lucide-react";


export const Dashboard: React.FC = () => {
  // Products catalog state
  const [products, setProducts] = useState<ShopifyProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);

  // Filter state
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activePreset, setActivePreset] = useState<
    "today" | "yesterday" | "7" | "30" | "month" | "custom"
  >("30");
  const [activeTab, setActiveTab] = useState<"states" | "campaigns">("states");

  // Analytics state
  const [analytics, setAnalytics] = useState<OrdersApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [storeDomain, setStoreDomain] = useState<string>("");

  // Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Request ID ref to prevent stale response race conditions
  const activeRequestId = useRef<number>(0);

  // Active filter info for visual feedback
  const [appliedFilters, setAppliedFilters] = useState<{
    productTitle: string;
    startDate: string;
    endDate: string;
  }>({
    productTitle: "All Running Products",
    startDate: "",
    endDate: "",
  });

  // Fetch store configuration status
  const loadConfigStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setIsConfigured(data.isConfigured);
        setStoreDomain(data.domain || "");
      }
    } catch (err) {
      console.error("Failed to load connection status:", err);
    }
  }, []);

  // Fetch products catalog
  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const res = await fetch("/api/products");
      const data: ProductsApiResponse = await res.json();

      if (data.products) {
        setProducts(data.products);
      }
      if (data.isConfigured !== undefined) {
        setIsConfigured(data.isConfigured);
      }
    } catch (err: any) {
      console.error("Failed to load products:", err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Fetch orders analytics function with race-condition prevention
  const fetchAnalytics = useCallback(
    async (
      prodId: string,
      start: string,
      end: string,
      options: { refresh?: "latest" | "full"; background?: boolean } = {}
    ) => {
      const currentRequestId = ++activeRequestId.current;
      try {
        if (options.background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError("");

        const params = new URLSearchParams();
        if (prodId) params.set("productId", prodId);
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
        if (options.refresh) params.set("refresh", options.refresh);

        const res = await fetch(`/api/orders?${params.toString()}`, { cache: "no-store" });
        const data: OrdersApiResponse = await res.json();

        // If a newer request was dispatched while this was in-flight, discard this response
        if (currentRequestId !== activeRequestId.current) {
          return;
        }

        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to fetch order analytics.");
        }

        setAnalytics(data);
        if (data.isConfigured !== undefined) {
          setIsConfigured(data.isConfigured);
        }

        // Update applied filter labels
        let prodName = "All Running Products";
        if (prodId !== "all") {
          const found =
            data.runningProducts?.find((p) => p.id === prodId) ||
            products.find((p) => p.id === prodId);
          if (found) prodName = found.title;
        }

        setAppliedFilters({
          productTitle: prodName,
          startDate: start,
          endDate: end,
        });
      } catch (err: any) {
        if (currentRequestId === activeRequestId.current) {
          console.error("Error fetching order analytics:", err);
          setError(err.message || "Unable to load Shopify order data.");
        }
      } finally {
        if (currentRequestId === activeRequestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [products]
  );

  // Initialize dates and trigger initial fetch on mount
  useEffect(() => {
    loadConfigStatus();
    loadProducts();

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const initialEnd = formatDateInputValue(today);
    const initialStart = formatDateInputValue(thirtyDaysAgo);

    setStartDate(initialStart);
    setEndDate(initialEnd);
    setActivePreset("30");

    setAppliedFilters({
      productTitle: "All Running Products",
      startDate: initialStart,
      endDate: initialEnd,
    });

    fetchAnalytics("all", initialStart, initialEnd);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull only orders newer than the current cache once per minute. Pausing while
  // the tab is hidden avoids spending Shopify API budget when nobody is viewing it.
  useEffect(() => {
    if (!startDate || !endDate) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible" && !loading && !refreshing) {
        fetchAnalytics(selectedProduct, startDate, endDate, {
          refresh: "latest",
          background: true,
        });
      }
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [fetchAnalytics, selectedProduct, startDate, endDate, loading, refreshing]);

  // Handle Product change from dropdown with instant fetch
  const handleProductChange = (newProductId: string) => {
    setSelectedProduct(newProductId);
    fetchAnalytics(newProductId, startDate, endDate);
  };

  // Handle Apply button click for custom dates
  const handleApplyFilters = () => {
    setActivePreset("custom");
    fetchAnalytics(selectedProduct, startDate, endDate);
  };

  // Handle manual start date change
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setActivePreset("custom");
  };

  // Handle manual end date change
  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setActivePreset("custom");
  };

  // Handle Quick Range Preset select with instant fetch
  const handlePresetSelect = (
    preset: "today" | "yesterday" | "7" | "30" | "month",
    newStart: string,
    newEnd: string
  ) => {
    setActivePreset(preset);
    setStartDate(newStart);
    setEndDate(newEnd);
    fetchAnalytics(selectedProduct, newStart, newEnd);
  };

  // Handle Reset button click with instant fetch
  const handleResetFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const initialEnd = formatDateInputValue(today);
    const initialStart = formatDateInputValue(thirtyDaysAgo);

    setSelectedProduct("all");
    setStartDate(initialStart);
    setEndDate(initialEnd);
    setActivePreset("30");
    fetchAnalytics("all", initialStart, initialEnd);
  };

  const handleRefresh = () => {
    fetchAnalytics(selectedProduct, startDate, endDate, {
      refresh: "full",
      background: true,
    });
  };

  // Handle configuration saved successfully
  const handleConfigSaved = () => {
    loadConfigStatus();
    loadProducts();
    if (startDate && endDate) {
      fetchAnalytics(selectedProduct, startDate, endDate);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header 
        isConfigured={isConfigured} 
        storeDomain={storeDomain}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Setup Banner if not configured */}
        {!isConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 text-amber-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-900">
                  Shopify API Not Connected (Showing Demo Analytics)
                </h2>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  To analyze real store orders, click the **Settings icon** in the header and add your connection credentials, or add them to your <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded">.env.local</code> file.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-semibold rounded-lg transition-colors"
              >
                Configure Now
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 shadow-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-rose-900">
                  Unable to load Shopify data
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchAnalytics(selectedProduct, startDate, endDate)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Unified Filter Card */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Product Selector */}
            <div className="lg:col-span-4">
              <ProductSelector
                products={analytics?.runningProducts || []}
                totalOrders={analytics?.summary?.totalOrders}
                selectedProduct={selectedProduct}
                onChange={handleProductChange}
                loading={loading}
              />
            </div>

            {/* Date Range & Controls */}
            <div className="lg:col-span-8">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                activePreset={activePreset}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                onSelectPreset={handlePresetSelect}
                loading={loading}
              />
            </div>
          </div>

          {/* Active Filter Scope Info */}
          {appliedFilters.startDate && appliedFilters.endDate && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-700">Currently showing:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {appliedFilters.productTitle}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-medium text-slate-600">
                  {formatDateDisplay(appliedFilters.startDate)} → {formatDateDisplay(appliedFilters.endDate)}
                </span>
              </div>
              {analytics?.totalCount !== undefined && (
                <span
                  className={
                    analytics.truncated ? "text-amber-700 font-semibold" : "text-slate-400"
                  }
                >
                  {analytics.truncated && analytics.totalAvailable
                    ? `Analysed newest ${formatNumber(analytics.totalCount)} of ${formatNumber(
                        analytics.totalAvailable
                      )} orders — narrow the range for exact totals`
                    : `${formatNumber(analytics.totalCount)} Shopify ${
                        analytics.totalCount === 1 ? "order" : "orders"
                      } analysed`}
                </span>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || refreshing || !startDate || !endDate}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                title="Reload the complete date range from Shopify"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          )}
        </section>

        {/* Summary Metrics Cards */}
        <section>
          <StatsCards
            summary={analytics?.summary || null}
            attributedOrders={analytics?.summary?.attributedOrders}
            loading={loading}
          />
        </section>

        {/* Breakdown tables, switched by tab so neither one buries the other */}
        <section>
          <div
            role="tablist"
            aria-label="Breakdown view"
            className="flex items-center gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-full sm:w-auto sm:inline-flex"
          >
            <button
              role="tab"
              aria-selected={activeTab === "states"}
              onClick={() => setActiveTab("states")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                activeTab === "states"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MapPin className="h-4 w-4" />
              <span>By State</span>
              {analytics?.states?.length ? (
                <span className="text-xs font-medium text-slate-400">
                  ({analytics.states.length})
                </span>
              ) : null}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "campaigns"}
              onClick={() => setActiveTab("campaigns")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                activeTab === "campaigns"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Megaphone className="h-4 w-4" />
              <span>By Campaign</span>
              {analytics?.campaigns?.length ? (
                <span className="text-xs font-medium text-slate-400">
                  ({analytics.campaigns.length})
                </span>
              ) : null}
            </button>
          </div>

          {activeTab === "states" ? (
            <StateOrdersTable
              states={analytics?.states || []}
              currency={analytics?.summary?.currency || "INR"}
              loading={loading}
            />
          ) : (
            <CampaignOrdersTable
              campaigns={analytics?.campaigns || []}
              currency={analytics?.summary?.currency || "INR"}
              loading={loading}
            />
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400">
          Shopify Order Analytics Dashboard • Powered by Shopify Admin GraphQL API
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={handleConfigSaved}
      />
    </div>
  );
};
