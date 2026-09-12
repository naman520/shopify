import React from "react";
import { ShoppingBag, Package, IndianRupee, MapPin } from "lucide-react";
import { AnalyticsSummary } from "@/types/shopify";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface StatsCardsProps {
  summary: AnalyticsSummary | null;
  loading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ summary, loading = false }) => {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse flex flex-col justify-between h-32"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 bg-slate-200 rounded w-24"></div>
              <div className="h-9 w-9 bg-slate-200 rounded-lg"></div>
            </div>
            <div className="h-8 bg-slate-200 rounded w-32 mt-3"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Orders",
      value: formatNumber(summary.totalOrders),
      subtitle: "Unique Shopify orders",
      icon: ShoppingBag,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      ringColor: "ring-blue-500/10",
    },
    {
      title: "Units Sold",
      value: formatNumber(summary.totalUnits),
      subtitle: "Total items ordered",
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      ringColor: "ring-indigo-500/10",
    },
    {
      title: "Revenue",
      value: formatCurrency(summary.totalRevenue, summary.currency),
      subtitle: `In ${summary.currency || "INR"}`,
      icon: IndianRupee,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      ringColor: "ring-emerald-500/10",
    },
    {
      title: "Top State",
      value: summary.topState || "N/A",
      subtitle: summary.topStateUnits
        ? `${formatNumber(summary.topStateUnits)} units (${formatCurrency(summary.topStateRevenue || 0, summary.currency)})`
        : "Leading delivery region",
      icon: MapPin,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      ringColor: "ring-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.title}
              </span>
              <div
                className={`h-9 w-9 rounded-lg ${card.bgColor} ${card.color} flex items-center justify-center ring-1 ${card.ringColor}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight truncate">
                {card.value}
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
