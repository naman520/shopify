import React from "react";

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="w-full animate-pulse">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-32"></div>
        <div className="h-8 bg-slate-200 rounded w-48"></div>
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-4 w-4 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded w-36"></div>
            </div>
            <div className="h-4 bg-slate-200 rounded w-16"></div>
            <div className="h-4 bg-slate-200 rounded w-16"></div>
            <div className="h-4 bg-slate-200 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  );
};
