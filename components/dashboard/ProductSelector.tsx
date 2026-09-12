import React from "react";
import { Package, Loader2 } from "lucide-react";
import { ShopifyProductItem } from "@/types/shopify";
import { formatNumber } from "@/lib/formatters";

interface ProductSelectorProps {
  products: ShopifyProductItem[];
  totalOrders?: number;
  selectedProduct: string;
  onChange: (productId: string) => void;
  loading?: boolean;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  totalOrders,
  selectedProduct,
  onChange,
  loading = false,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor="product-select"
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
        >
          Select Product
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          {products.length} {products.length === 1 ? "active product" : "active products"}
        </span>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <Package className="h-4 w-4 text-slate-400" />
          )}
        </div>
        <select
          id="product-select"
          value={selectedProduct}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed appearance-none cursor-pointer"
        >
          <option value="all">
            All Running Products {totalOrders !== undefined ? `(${formatNumber(totalOrders)} orders)` : ""}
          </option>
          {products.length === 0 && !loading && (
            <option value="none" disabled>
              No running products with orders in this period
            </option>
          )}
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.title} {product.orderCount !== undefined ? `(${formatNumber(product.orderCount)} orders)` : ""}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
