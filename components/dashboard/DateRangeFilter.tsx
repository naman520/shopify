import React from "react";
import { Calendar, Filter, RotateCcw, Loader2 } from "lucide-react";
import { formatDateInputValue } from "@/lib/formatters";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  activePreset?: "today" | "yesterday" | "7" | "30" | "month" | "custom";
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onApply: () => void;
  onReset: () => void;
  onSelectPreset?: (
    preset: "today" | "yesterday" | "7" | "30" | "month",
    start: string,
    end: string
  ) => void;
  loading?: boolean;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  activePreset = "30",
  onStartDateChange,
  onEndDateChange,
  onApply,
  onReset,
  onSelectPreset,
  loading = false,
}) => {
  const today = new Date();
  const endTodayStr = formatDateInputValue(today);

  // Compute preset dates
  const handlePresetClick = (preset: "today" | "yesterday" | "7" | "30" | "month") => {
    let startStr = endTodayStr;
    let endStr = endTodayStr;

    if (preset === "today") {
      startStr = endTodayStr;
    } else if (preset === "yesterday") {
      const d = new Date();
      d.setDate(today.getDate() - 1);
      startStr = formatDateInputValue(d);
      endStr = startStr;
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      startStr = formatDateInputValue(firstDay);
    } else if (preset === "7") {
      const d = new Date();
      d.setDate(today.getDate() - 7);
      startStr = formatDateInputValue(d);
    } else if (preset === "30") {
      const d = new Date();
      d.setDate(today.getDate() - 30);
      startStr = formatDateInputValue(d);
    }

    onStartDateChange(startStr);
    onEndDateChange(endStr);
    if (onSelectPreset) {
      onSelectPreset(preset, startStr, endStr);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Date Pickers and Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 items-end">
        {/* From Date */}
        <div className="lg:col-span-3">
          <label
            htmlFor="start-date"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
          >
            From Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
            />
          </div>
        </div>

        {/* To Date */}
        <div className="lg:col-span-3">
          <label
            htmlFor="end-date"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
          >
            To Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="lg:col-span-6 flex items-center gap-2 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={onApply}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Filter className="h-4 w-4" />
                <span>Apply Range</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-400"
            title="Reset to Last 30 Days & All Products"
          >
            <RotateCcw className="h-4 w-4 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Quick Presets with unambiguous active highlights */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-slate-500 font-medium mr-1">Quick Ranges:</span>
        <button
          type="button"
          onClick={() => handlePresetClick("today")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activePreset === "today"
              ? "bg-emerald-600 text-white shadow-sm font-semibold"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => handlePresetClick("yesterday")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activePreset === "yesterday"
              ? "bg-emerald-600 text-white shadow-sm font-semibold"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => handlePresetClick("7")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activePreset === "7"
              ? "bg-emerald-600 text-white shadow-sm font-semibold"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          Last 7 Days
        </button>
        <button
          type="button"
          onClick={() => handlePresetClick("30")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activePreset === "30"
              ? "bg-emerald-600 text-white shadow-sm font-semibold"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          Last 30 Days
        </button>
        <button
          type="button"
          onClick={() => handlePresetClick("month")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activePreset === "month"
              ? "bg-emerald-600 text-white shadow-sm font-semibold"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          This Month
        </button>
      </div>
    </div>
  );
};
