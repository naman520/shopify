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
  X,
  MapPin,
  Clock3,
} from "lucide-react";
import { CampaignAnalytics } from "@/types/shopify";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import {
  filterCampaignsBySearch,
  getCampaignSearchTerms,
} from "@/lib/campaign-filters";
import { TableSkeleton } from "./SkeletonLoaders";

type SortField = "campaign" | "latestLeadAt" | "orders" | "units" | "revenue";
type SortOrder = "asc" | "desc";

interface CampaignOrdersTableProps {
  campaigns: CampaignAnalytics[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  currency?: string;
  loading?: boolean;
}

export const CampaignOrdersTable: React.FC<CampaignOrdersTableProps> = ({
  campaigns,
  searchTerm,
  onSearchTermChange,
  currency = "INR",
  loading = false,
}) => {
  const [sortField, setSortField] = useState<SortField>("latestLeadAt");
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

  const handleSortOption = (value: string) => {
    const [field, order] = value.split(":") as [SortField, SortOrder];
    setSortField(field);
    setSortOrder(order);
  };

  const searchTerms = useMemo(
    () => getCampaignSearchTerms(searchTerm),
    [searchTerm],
  );

  const hasSearch = searchTerms.length > 0;
  const isBulkSearch = searchTerms.length > 1;

  // Match any entered campaign ID. A single value keeps the original partial-search behavior.
  const filteredCampaigns = useMemo(
    () => filterCampaignsBySearch(campaigns, searchTerm),
    [campaigns, searchTerm],
  );

  const mostRecentCampaign = useMemo(
    () =>
      filteredCampaigns.reduce<CampaignAnalytics | undefined>(
        (latest, campaign) => {
          if (
            campaign.campaign === "Direct / No Campaign" ||
            !campaign.latestLeadAt
          )
            return latest;
          return !latest || campaign.latestLeadAt > (latest.latestLeadAt || "")
            ? campaign
            : latest;
        },
        undefined,
      ),
    [filteredCampaigns],
  );

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
      { orders: 0, units: 0, revenue: 0 },
    );
  }, [filteredCampaigns]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-emerald-600 font-bold" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-emerald-600 font-bold" />
    );
  };

  const formatLeadDate = (value?: string) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(date);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row items-start justify-between gap-3 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span>Campaign-wise Breakdown</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {filteredCampaigns.length}{" "}
              {filteredCampaigns.length === 1 ? "campaign" : "campaigns"}
              {hasSearch && ` of ${campaigns.length}`}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Campaign states and the newest lead received, based on Shopify order
            time
          </p>
          {mostRecentCampaign && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-emerald-700">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Most recent campaign lead:</span>
              <span className="font-bold font-mono">
                {mostRecentCampaign.campaign}
              </span>
              <span className="text-emerald-600">
                • {formatLeadDate(mostRecentCampaign.latestLeadAt)}
              </span>
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-start">
          {/* Single and bulk campaign search */}
          <div className="w-full lg:w-80">
            <div className="relative">
              <div className="absolute left-0 top-0 pl-3 pt-2.5 pointer-events-none text-slate-400">
                <Search className="h-4 w-4" aria-hidden="true" />
              </div>
              <textarea
                rows={1}
                aria-label="Search one or more campaign IDs"
                placeholder="Search or paste campaign IDs..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="block min-h-10 max-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm leading-5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchTermChange("")}
                  aria-label="Clear campaign search"
                  title="Clear search"
                  className="absolute right-2 top-2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>Separate IDs with commas, semicolons, or new lines</span>
              {isBulkSearch && (
                <span className="shrink-0 font-medium text-emerald-700">
                  {searchTerms.length} IDs entered
                </span>
              )}
            </div>
          </div>

          <label className="w-full lg:w-44">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Sort by
            </span>
            <select
              value={`${sortField}:${sortOrder}`}
              onChange={(event) => handleSortOption(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="latestLeadAt:desc">Newest lead</option>
              <option value="latestLeadAt:asc">Oldest lead</option>
              <option value="orders:desc">Most orders</option>
              <option value="orders:asc">Fewest orders</option>
              <option value="revenue:desc">Highest revenue</option>
              <option value="revenue:asc">Lowest revenue</option>
              <option value="units:desc">Most units</option>
              <option value="units:asc">Fewest units</option>
              <option value="campaign:asc">Campaign ID A–Z</option>
              <option value="campaign:desc">Campaign ID Z–A</option>
            </select>
          </label>
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
            {hasSearch ? "No matching campaigns" : "No campaign data found"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasSearch
              ? isBulkSearch
                ? `No campaigns matched any of the ${searchTerms.length} IDs entered. Try checking the IDs or clear your search.`
                : `No campaigns matching "${searchTerms[0]}". Try checking the ID or clear your search.`
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
                  className="min-w-44 px-3 py-3.5 cursor-pointer select-none group"
                  onClick={() => handleSort("latestLeadAt")}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Latest lead</span>
                    {renderSortIcon("latestLeadAt")}
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
                <th
                  scope="col"
                  className="hidden md:table-cell py-3.5 pl-3 pr-6 text-right"
                >
                  <span>Share</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {sortedCampaigns.map((row) => {
                const key = row.campaign;
                const hasStates = row.states && row.states.length > 0;
                const isExpanded = !!expandedRows[key];
                const isMostRecent =
                  row.campaign === mostRecentCampaign?.campaign;
                const visibleStates =
                  row.states?.slice(0, hasSearch ? 5 : 2) || [];
                const hiddenStateCount =
                  (row.states?.length || 0) - visibleStates.length;

                return (
                  <React.Fragment key={key}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="py-3.5 pl-4 sm:pl-6 pr-3">
                        <div className="flex items-center gap-2">
                          {hasStates && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(key)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300"
                              title={
                                isExpanded
                                  ? "Collapse state breakdown"
                                  : "Expand state breakdown"
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <Megaphone className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900 font-mono">
                            {row.campaign}
                          </span>
                          {isMostRecent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              <TrendingUp className="h-3 w-3" />
                              Most recent
                            </span>
                          )}
                        </div>
                      </td>
                      {/*  */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div
                          className={`flex items-center gap-1.5 text-xs font-medium ${
                            isMostRecent ? "text-emerald-700" : "text-slate-600"
                          }`}
                        >
                          <Clock3
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{formatLeadDate(row.latestLeadAt)}</span>
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
                              style={{
                                width: `${Math.min(100, Math.max(0, row.percentageOfRevenue || 0))}%`,
                              }}
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
                        <td
                          colSpan={7}
                          className="py-4.5 pl-8 pr-4 sm:pl-12 sm:pr-6 border-b border-slate-200"
                        >
                          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm max-w-2xl">
                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                                <span>
                                  States for Campaign &quot;{row.campaign}&quot;
                                </span>
                              </h4>
                              <span className="text-[10px] text-slate-400 font-medium font-mono">
                                Order Wise
                              </span>
                            </div>
                            <div className="divide-y divide-slate-100 text-xs">
                              <div className="grid grid-cols-12 px-4 py-2 bg-slate-50/20 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                <div className="col-span-5">State</div>
                                <div className="col-span-2 text-right">
                                  Orders
                                </div>
                                <div className="col-span-2 text-right">
                                  Units
                                </div>
                                <div className="col-span-3 text-right">
                                  Revenue
                                </div>
                              </div>
                              {row.states?.map((s, sIndex) => (
                                <div
                                  key={s.state}
                                  className="grid grid-cols-12 px-4 py-2.5 hover:bg-slate-50/30 text-slate-600 font-medium items-center"
                                >
                                  <div className="col-span-5 truncate text-slate-800 flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 w-3.5">
                                      {sIndex + 1}.
                                    </span>
                                    <span className="font-semibold">
                                      {s.state}
                                    </span>
                                    {s.stateCode && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                                        {s.stateCode}
                                      </span>
                                    )}
                                  </div>
                                  <div className="col-span-2 text-right font-mono text-slate-900 font-semibold">
                                    {formatNumber(s.orders)}
                                  </div>
                                  <div className="col-span-2 text-right font-mono">
                                    {formatNumber(s.units)}
                                  </div>
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
                
                <td className="px-3 py-3.5 text-xs text-slate-500">—</td>
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
