export function formatVND(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "0 ₫";
  const num = Math.round(Number(amount));
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "0";
  return new Intl.NumberFormat("vi-VN").format(Math.round(Number(amount)));
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatShortDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}
