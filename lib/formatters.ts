/**
 * Format currency with Indian grouping style (Lakhs/Crores) or standard format
 */
export function formatCurrency(amount: number, currency = "INR"): string {
  if (isNaN(amount)) return "₹0";

  if (currency === "INR") {
    // Format using en-IN locale for Indian numbering system (e.g. 1,45,000)
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
    return `₹${formatted}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format integers with commas
 */
export function formatNumber(num: number): string {
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN").format(num);
}

/**
 * Format date for display (e.g. "01 Aug 2026")
 */
export function formatDateDisplay(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format Date object to YYYY-MM-DD for input[type="date"]
 */
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
