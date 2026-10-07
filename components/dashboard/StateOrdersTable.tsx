import React, { useState, useMemo } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  MapPin,
  Inbox,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Building2,
  Package,
  X,
} from "lucide-react";
import { StateAnalytics } from "@/types/shopify";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { TableSkeleton } from "./SkeletonLoaders";

type SortField = "state" | "orders" | "units" | "revenue";
type SortOrder = "asc" | "desc";

interface StateOrdersTableProps {
  states: StateAnalytics[];
  campaignFilterActive?: boolean;
  matchedCampaignCount?: number;
  onClearCampaignFilter?: () => void;
  currency?: string;
  loading?: boolean;
}

export const StateOrdersTable: React.FC<StateOrdersTableProps> = ({
  states,
  campaignFilterActive = false,
  matchedCampaignCount = 0,
  onClearCampaignFilter,
  currency = "INR",
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("orders");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpand = (stateName: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [stateName]: !prev[stateName],
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

  // Filter states by search query
  const filteredStates = useMemo(() => {
    if (!searchTerm.trim()) return states;
    const term = searchTerm.toLowerCase().trim();
    return states.filter(
      (s) =>
        s.state.toLowerCase().includes(term) ||
        (s.stateCode && s.stateCode.toLowerCase().includes(term))
    );
  }, [states, searchTerm]);

  // Sort states
  const sortedStates = useMemo(() => {
    const list = [...filteredStates];
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
  }, [filteredStates, sortField, sortOrder]);

  // Compute footer totals
  const totals = useMemo(() => {
    return filteredStates.reduce(
      (acc, curr) => {
        acc.orders += curr.orders;
        acc.units += curr.units;
        acc.revenue += curr.revenue;
        return acc;
      },
      { orders: 0, units: 0, revenue: 0 }
    );
  }, [filteredStates]);

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
            <span>State-wise Breakdown</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {filteredStates.length} {filteredStates.length === 1 ? "state" : "states"}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {campaignFilterActive
              ? "Geographic totals for the campaign IDs selected in By Campaign"
              : "Geographic order volume and sales distribution based on shipping address"}
          </p>
          {campaignFilterActive && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
              <span>
                Campaign filter active · {matchedCampaignCount} {matchedCampaignCount === 1 ? "campaign" : "campaigns"} matched
              </span>
              {onClearCampaignFilter && (
                <button
                  type="button"
                  onClick={onClearCampaignFilter}
                  className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
                  aria-label="Clear campaign filter"
                  title="Clear campaign filter"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="w-full sm:w-64 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <TableSkeleton rows={7} />
      ) : sortedStates.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {searchTerm
              ? "No matching states"
              : campaignFilterActive
                ? "No states for these campaigns"
                : "No orders found"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm
              ? `No states matching "${searchTerm}". Try checking the spelling or clear your search.`
              : campaignFilterActive
                ? "No state data was found for the searched campaign IDs in the selected product and date range."
              : "No orders found for the selected product and date range. Try broadening your date filter."}
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
                  onClick={() => handleSort("state")}
                >
                  <div className="flex items-center gap-1.5">
                    <span>State / Region</span>
                    {renderSortIcon("state")}
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
              {sortedStates.map((row, index) => {
                const isTop = index === 0 && sortField === "orders" && sortOrder === "desc";
                const isExpanded = !!expandedRows[row.state];
                const hasCities = row.cities && row.cities.length > 0;
                const hasProducts = row.products && row.products.length > 0;
                const canExpand = hasCities || hasProducts;

                return (
                  <React.Fragment key={row.state}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isExpanded ? "bg-slate-50/50" : ""
                      }`}
                    >
                      <td className="py-3.5 pl-4 sm:pl-6 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {canExpand && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.state)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300"
                              title={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900">
                            {row.state}
                          </span>
                          {row.stateCode && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                              {row.stateCode}
                            </span>
                          )}
                          {isTop && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <TrendingUp className="h-3 w-3" />
                              #1 State
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

                    {/* Consolidated Expanded Details Row (Cities & Products Side-by-Side) */}
                    {isExpanded && canExpand && (
                      <tr className="bg-slate-50/20">
                        <td colSpan={5} className="py-4.5 pl-8 pr-4 sm:pl-12 sm:pr-6 border-b border-slate-200">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
                            
                            {/* Left Column: Top Cities (sorted by orders) */}
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Top Cities in {row.state}</span>
                                </h4>
                                <span className="text-[10px] text-slate-400 font-medium font-mono">
                                  Order Wise
                                </span>
                              </div>
                              <div className="divide-y divide-slate-100 text-xs">
                                {hasCities ? (
                                  <>
                                    <div className="grid grid-cols-12 px-4 py-2 bg-slate-50/20 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                      <div className="col-span-5">City Name</div>
                                      <div className="col-span-2 text-right">Orders</div>
                                      <div className="col-span-2 text-right">Units</div>
                                      <div className="col-span-3 text-right">Revenue</div>
                                    </div>
                                    {row.cities?.map((city, cIndex) => (
                                      <div key={city.city} className="grid grid-cols-12 px-4 py-2.5 hover:bg-slate-50/30 text-slate-600 font-medium items-center">
                                        <div className="col-span-5 truncate text-slate-800 flex items-center gap-1">
                                          <span className="text-[10px] font-bold text-slate-400 w-3.5">{cIndex + 1}.</span>
                                          <span className="font-semibold">{city.city}</span>
                                        </div>
                                        <div className="col-span-2 text-right font-mono text-slate-900 font-semibold">{formatNumber(city.orders)}</div>
                                        <div className="col-span-2 text-right font-mono">{formatNumber(city.units)}</div>
                                        <div className="col-span-3 text-right font-mono text-slate-700">
                                          {formatCurrency(city.revenue, currency)}
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                    No city data available for this state.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Column: Product Breakdown */}
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <Package className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Product Split in {row.state}</span>
                                </h4>
                                <span className="text-[10px] text-slate-400 font-medium font-mono">
                                  Revenue Contribution
                                </span>
                              </div>
                              <div className="divide-y divide-slate-100 text-xs">
                                {hasProducts ? (
                                  <>
                                    <div className="grid grid-cols-12 px-4 py-2 bg-slate-50/20 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                      <div className="col-span-5">Product Title</div>
                                      <div className="col-span-2 text-right">Orders</div>
                                      <div className="col-span-2 text-right">Units</div>
                                      <div className="col-span-3 text-right">Revenue</div>
                                    </div>
                                    {row.products?.map((prod) => (
                                      <div key={prod.productId} className="grid grid-cols-12 px-4 py-2.5 hover:bg-slate-50/30 text-slate-600 font-medium items-center">
                                        <div className="col-span-5 truncate font-semibold text-slate-800 pr-2" title={prod.productName}>
                                          {prod.productName}
                                        </div>
                                        <div className="col-span-2 text-right font-mono">{formatNumber(prod.orders)}</div>
                                        <div className="col-span-2 text-right font-mono">{formatNumber(prod.units)}</div>
                                        <div className="col-span-3 text-right font-mono font-semibold text-emerald-600">
                                          {formatCurrency(prod.revenue, currency)}
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                    No product split data available for this state.
                                  </div>
                                )}
                              </div>
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
                  <span>Total ({filteredStates.length} states)</span>
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
