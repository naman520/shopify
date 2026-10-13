import React from "react";
import {
  AlertCircle,
  ArrowUpRight,
  IndianRupee,
  MapPin,
  Package,
  ShoppingBag,
  Store,
} from "lucide-react";
import { StoreAnalyticsBreakdown } from "@/types/shopify";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface Props {
  stores: StoreAnalyticsBreakdown[];
  selectedStoreId: string;
  onSelectStore: (storeId: string) => void;
  loading?: boolean;
}

export const StoreOrdersOverview: React.FC<Props> = ({
  stores,
  selectedStoreId,
  onSelectStore,
  loading = false,
}) => {
  if (loading && stores.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 h-5 w-44 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (stores.length === 0) return null;

  const combinedOrders = stores.reduce(
    (sum, store) => sum + (store.summary?.totalOrders || 0),
    0
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Store className="h-5 w-5 text-emerald-600" />
            Store-wise Orders
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Orders, units and revenue for the selected product and date filters.
          </p>
        </div>
        {selectedStoreId === "all" && (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Combined view · {formatNumber(combinedOrders)} orders
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {stores.map((store) => {
          const summary = store.summary;
          const orderShare =
            combinedOrders > 0 && summary
              ? (summary.totalOrders / combinedOrders) * 100
              : 0;

          return (
            <article
              key={store.storeId}
              className={`overflow-hidden rounded-xl border transition-shadow ${
                store.error
                  ? "border-rose-200 bg-rose-50/40"
                  : "border-slate-200 bg-white hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-slate-900">
                      {store.storeName}
                    </h3>
                    {store.error ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        <AlertCircle className="h-3 w-3" /> Unavailable
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{store.domain}</p>
                </div>
                {!store.error && selectedStoreId === "all" && (
                  <button
                    type="button"
                    onClick={() => onSelectStore(store.storeId)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    View store <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {store.error || !summary ? (
                <div className="p-5 text-sm text-rose-700">
                  Store data could not be loaded. Check the Shopify app installation and credentials.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-px bg-slate-100">
                    <Metric
                      icon={ShoppingBag}
                      label="Orders"
                      value={formatNumber(summary.totalOrders)}
                    />
                    <Metric
                      icon={Package}
                      label="Units"
                      value={formatNumber(summary.totalUnits)}
                    />
                    <Metric
                      icon={IndianRupee}
                      label="Revenue"
                      value={formatCurrency(summary.totalRevenue, summary.currency)}
                    />
                    <Metric icon={MapPin} label="Top state" value={summary.topState || "N/A"} />
                  </div>
                  {selectedStoreId === "all" && (
                    <div className="p-4">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Share of combined orders</span>
                        <span>{orderShare.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, orderShare)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

const Metric: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="bg-white p-4">
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <div className="mt-1.5 truncate text-lg font-bold text-slate-900">{value}</div>
  </div>
);
