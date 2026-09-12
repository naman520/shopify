import React, { useState, useMemo } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Megaphone,
  Inbox,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import { CampaignAnalytics } from "@/types/shopify";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { TableSkeleton } from "./SkeletonLoaders";

type SortField = "campaign" | "orders" | "units" | "revenue";
type SortOrder = "asc" | "desc";

interface CampaignOrdersTableProps {
  campaigns: CampaignAnalytics[];
  currency?: string;
  loading?: boolean;
}

export const CampaignOrdersTable: React.FC<CampaignOrdersTableProps> = ({
  campaigns,
  currency = "INR",
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Filter campaigns by search query
  const filteredCampaigns = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const term = searchTerm.toLowerCase().trim();
    return campaigns.filter((c) => c.campaign.toLowerCase().includes(term));
  }, [campaigns, searchTerm]);

  // Sort campaigns
  const sortedCampaigns = useMemo(() => {
    const list = [...filteredCampaigns];
    list.sort((a, b) => {
      let aVal: string | number = a[sortField] ?? "";
      let bVal: string | number = b[sortField] ?? "";

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }

      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return list;
  }, [filteredCampaigns, sortField, sortOrder]);

  // Compute footer totals
  const totals = useMemo(() => {
    return filteredCampaigns.reduce(
      (acc, curr) => {
        acc.orders += curr.orders;
        acc.units += curr.units;
        acc.revenue += curr.revenue;
        return acc;
      },
      { orders: 0, units: 0, revenue: 0 }
    );
  }, [filteredCampaigns]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-emerald-600 font-bold" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-emerald-600 font-bold" />
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span>Campaign-wise Breakdown</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {filteredCampaigns.length} {filteredCampaigns.length === 1 ? "campaign" : "campaigns"}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ad campaign ID per order — expand a row to see which states its orders came from
          </p>
        </div>

        {/* Search input */}
        <div className="w-full sm:w-64 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search campaign ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : sortedCampaigns.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {searchTerm ? "No matching campaigns" : "No campaign data found"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm
              ? `No campaigns matching "${searchTerm}". Try checking the ID or clear your search.`
              : "No campaign-tagged orders found for the selected product and date range. Make sure your ad links pass utm_campaign / utm_id so they get saved onto the order."}
          </p>
        </div>
      ) : (
        /* Data Table */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 sm:pl-6 pr-3 cursor-pointer select-none group"
                  onClick={() => handleSort("campaign")}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Campaign</span>
                    {renderSortIcon("campaign")}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-right cursor-pointer select-none group"
                  onClick={() => handleSort("orders")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Orders</span>
                    {renderSortIcon("orders")}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-right cursor-pointer select-none group"
                  onClick={() => handleSort("units")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Units</span>
                    {renderSortIcon("units")}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-right cursor-pointer select-none group"
                  onClick={() => handleSort("revenue")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Revenue</span>
                    {renderSortIcon("revenue")}
                  </div>
                </th>
                <th scope="col" className="hidden md:table-cell py-3.5 pl-3 pr-6 text-right">
                  <span>Share</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {sortedCampaigns.map((row, index) => {
                const isTop = index === 0 && sortField === "revenue" && sortOrder === "desc";
                const key = row.campaign;
                const hasStates = row.states && row.states.length > 0;
                const isExpanded = !!expandedRows[key];

                return (
                  <React.Fragment key={key}>
                    <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? "bg-slate-50/50" : ""}`}>
                      <td className="py-3.5 pl-4 sm:pl-6 pr-3">
                        <div className="flex items-center gap-2">
                          {hasStates && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(key)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300"
                              title={isExpanded ? "Collapse state breakdown" : "Expand state breakdown"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <Megaphone className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900 font-mono">{row.campaign}</span>
                          {isTop && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              <TrendingUp className="h-3 w-3" />
                              Top
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap text-slate-700 font-medium font-mono">
                        {formatNumber(row.orders)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap text-slate-700 font-medium font-mono">
                        {formatNumber(row.units)}
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap font-semibold text-slate-900 font-mono">
                        {formatCurrency(row.revenue, currency)}
                      </td>
                      <td className="hidden md:table-cell py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, row.percentageOfRevenue || 0))}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 font-mono w-10 text-right">
                            {(row.percentageOfRevenue || 0).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded: which states this campaign's orders shipped to */}
                    {isExpanded && hasStates && (
                      <tr className="bg-slate-50/20">
                        <td colSpan={5} className="py-4.5 pl-8 pr-4 sm:pl-12 sm:pr-6 border-b border-slate-200">
                          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm max-w-2xl">
                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                                <span>States for Campaign &quot;{row.campaign}&quot;</span>
                              </h4>
                              <span className="text-[10px] text-slate-400 font-medium font-mono">
                                Order Wise
                              </span>
                            </div>
                            <div className="divide-y divide-slate-100 text-xs">
                              <div className="grid grid-cols-12 px-4 py-2 bg-slate-50/20 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                <div className="col-span-5">State</div>
                                <div className="col-span-2 text-right">Orders</div>
                                <div className="col-span-2 text-right">Units</div>
                                <div className="col-span-3 text-right">Revenue</div>
                              </div>
                              {row.states?.map((s, sIndex) => (
                                <div
                                  key={s.state}
                                  className="grid grid-cols-12 px-4 py-2.5 hover:bg-slate-50/30 text-slate-600 font-medium items-center"
                                >
                                  <div className="col-span-5 truncate text-slate-800 flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 w-3.5">{sIndex + 1}.</span>
                                    <span className="font-semibold">{s.state}</span>
                                    {s.stateCode && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                                        {s.stateCode}
                                      </span>
                                    )}
                                  </div>
                                  <div className="col-span-2 text-right font-mono text-slate-900 font-semibold">
                                    {formatNumber(s.orders)}
                                  </div>
                                  <div className="col-span-2 text-right font-mono">{formatNumber(s.units)}</div>
                                  <div className="col-span-3 text-right font-mono text-slate-700">
                                    {formatCurrency(s.revenue, currency)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            {/* Totals Summary Footer */}
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-900">
              <tr>
                <td className="py-3.5 pl-4 sm:pl-6 pr-3">
                  <span>Total ({filteredCampaigns.length} campaigns)</span>
                </td>
                <td className="px-3 py-3.5 text-right font-mono">
                  {formatNumber(totals.orders)}
                </td>
                <td className="px-3 py-3.5 text-right font-mono">
                  {formatNumber(totals.units)}
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-emerald-700">
                  {formatCurrency(totals.revenue, currency)}
                </td>
                <td className="hidden md:table-cell py-3.5 pl-3 pr-6 text-right text-xs text-slate-500 font-mono">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
