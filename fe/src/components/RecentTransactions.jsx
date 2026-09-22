import React, { useState, useMemo, useEffect } from "react";
import {
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  CheckCircle2,
  Search,
  ArrowUpDown,
  RotateCcw,
  X,
} from "lucide-react";
import { formatVND, formatDate } from "../utils/formatters";

const PAGE_SIZE = 20;

export default function RecentTransactions({
  transactions = [],
  currentUserId,
  page = 0,
  totalPages = 1,
  onPageChange,
  dateFilter,
  onDateFilterChange,
}) {
  const [expandedTxId, setExpandedTxId] = useState(null);

  // Search, Filter & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("DATE_DESC");
  const [currentPage, setCurrentPage] = useState(0);

  // Reset page to 0 when filters or sort change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, statusFilter, typeFilter, sortBy, dateFilter]);

  const toggleExpand = (id) => {
    setExpandedTxId((prev) => (prev === id ? null : id));
  };

  // Determine if current user's share in this transaction is paid
  const isTxPaidForUser = (tx) => {
    const isPayer = tx.payerId === currentUserId || tx.payerName === "Bạn";
    if (isPayer) return true; // Bạn là người chi trả nên phần của bạn đã được trả

    const myShare =
      tx.sharingMembers?.find(
        (m) => m.userId === currentUserId || m.userName === "Bạn"
      ) || tx.myShare;

    if (myShare && typeof myShare.isPaid === "boolean") {
      return myShare.isPaid;
    }
    if (typeof tx.isPaid === "boolean") {
      return tx.isPaid;
    }
    if (tx.status === "PAID" || tx.status === "COMPLETED") {
      return true;
    }
    return false;
  };

  const renderStatusBadge = (isPaid) => {
    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Đã thanh toán
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        <Clock className="w-3 h-3 text-rose-600" />
        Chưa thanh toán
      </span>
    );
  };

  // Filter and sort transactions
  const processedTransactions = useMemo(() => {
    let list = [...transactions];

    // 1. Search Query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (tx) =>
          tx.title?.toLowerCase().includes(q) ||
          tx.groupName?.toLowerCase().includes(q) ||
          tx.payerName?.toLowerCase().includes(q)
      );
    }

    // 2. Status filter: PAID vs UNPAID
    if (statusFilter === "PAID") {
      list = list.filter((tx) => isTxPaidForUser(tx));
    } else if (statusFilter === "UNPAID") {
      list = list.filter((tx) => !isTxPaidForUser(tx));
    }

    // 3. Type / Role filter (Payer vs Debtor)
    if (typeFilter === "PAYER") {
      list = list.filter((tx) => tx.payerId === currentUserId || tx.payerName === "Bạn");
    } else if (typeFilter === "DEBTOR") {
      list = list.filter((tx) => tx.payerId !== currentUserId && tx.payerName !== "Bạn");
    }

    // 4. Sort
    list.sort((a, b) => {
      if (sortBy === "DATE_DESC") {
        return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
      }
      if (sortBy === "DATE_ASC") {
        return new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date);
      }
      if (sortBy === "AMOUNT_DESC") {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (sortBy === "AMOUNT_ASC") {
        return (a.totalAmount || 0) - (b.totalAmount || 0);
      }
      return 0;
    });

    return list;
  }, [transactions, searchQuery, statusFilter, typeFilter, sortBy, currentUserId]);

  // Pagination calculations
  const totalCount = processedTransactions.length;
  const calcTotalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const activePage = Math.min(currentPage, calcTotalPages - 1);
  const paginatedTransactions = processedTransactions.slice(
    activePage * PAGE_SIZE,
    (activePage + 1) * PAGE_SIZE
  );

  const handlePageChange = (newPage) => {
    if (newPage < 0 || newPage >= calcTotalPages) return;
    setCurrentPage(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  const isFiltered = searchQuery.trim() !== "" || statusFilter !== "ALL" || typeFilter !== "ALL" || sortBy !== "DATE_DESC";

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setSortBy("DATE_DESC");
    setCurrentPage(0);
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
      {/* Header: Title & Quick Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Hóa đơn gần đây</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {totalCount} hóa đơn
              </span>
            </div>
            <p className="text-xs text-slate-500">Mặc định 20 hóa đơn mới nhất có bạn tham gia</p>
          </div>
        </div>

        {/* Date quick filter pills */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => onDateFilterChange && onDateFilterChange("ALL")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              dateFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => onDateFilterChange && onDateFilterChange("7DAYS")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              dateFilter === "7DAYS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            7 ngày
          </button>
          <button
            onClick={() => onDateFilterChange && onDateFilterChange("MONTH")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              dateFilter === "MONTH" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tháng này
          </button>
        </div>
      </div>

      {/* Filter & Sort Toolbar */}
      <div className="pt-4 pb-2 space-y-2.5">
        {/* Row 1: Full Width Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hóa đơn, người trả, nhóm..."
            className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Filters & Sort Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none text-xs bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-xl pl-3 pr-8 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all shadow-2xs"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="UNPAID">Chưa thanh toán</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Type / Role Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full appearance-none text-xs bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-xl pl-3 pr-8 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all shadow-2xs"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="PAYER">Bạn chi trả (Được nhận)</option>
              <option value="DEBTOR">Phần của bạn (Cần trả)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full appearance-none text-xs bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-xl pl-3 pr-8 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all shadow-2xs"
            >
              <option value="DATE_DESC">Mới nhất (Ngày giảm dần)</option>
              <option value="DATE_ASC">Cũ nhất (Ngày tăng dần)</option>
              <option value="AMOUNT_DESC">Số tiền: Cao → Thấp</option>
              <option value="AMOUNT_ASC">Số tiền: Thấp → Cao</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Active filter count & Reset button */}
        {isFiltered && (
          <div className="flex items-center justify-between pt-1 px-0.5 text-xs">
            <span className="text-slate-500 text-[11px]">
              Tìm thấy <strong className="text-slate-800 font-semibold">{totalCount}</strong> hóa đơn phù hợp
            </span>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-slate-100 mt-2">
        {paginatedTransactions.map((tx) => {
          const isPayer = tx.payerId === currentUserId || tx.payerName === "Bạn";
          // Find current user's share in this transaction
          const myShareObj = tx.sharingMembers?.find(
            (m) => m.userId === currentUserId || m.userName === "Bạn"
          );
          const myShareAmount = myShareObj ? myShareObj.amount : 0;
          const isExpanded = expandedTxId === tx.id;
          const isUserPaid = isTxPaidForUser(tx);

          // Net effect on user:
          // If user paid 100k, their own share is 20k -> they get back +80k
          // If someone else paid, user's share is 20k -> user owes -20k
          const netEffect = isPayer ? tx.totalAmount - myShareAmount : -myShareAmount;

          return (
            <div
              key={tx.id}
              className="group py-3 px-2.5 hover:bg-slate-50/80 rounded-xl transition-all border border-transparent hover:border-slate-200/60 cursor-pointer"
            >
              <div
                className="flex items-center justify-between gap-3"
                onClick={() => toggleExpand(tx.id)}
              >
                {/* Left: Icon & Title & Date */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50/80 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100/80 shadow-2xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 text-sm truncate">{tx.title}</h3>
                      {tx.groupName && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                          {tx.groupName}
                        </span>
                      )}
                      {renderStatusBadge(isUserPaid)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDate(tx.createdAt || tx.date)}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate">
                        Người trả:{" "}
                        <strong className="text-slate-700 font-medium">
                          {isPayer ? "Bạn" : tx.payerName}
                        </strong>{" "}
                        ({formatVND(tx.totalAmount)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Net Impact & Expand Icon */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block font-medium">
                      {isPayer ? "Bạn được nhận lại" : "Phần của bạn"}
                    </span>
                    <span
                      className={`text-sm font-bold tracking-tight block ${
                        isPayer
                          ? "text-emerald-600"
                          : netEffect < 0
                          ? "text-rose-600"
                          : "text-slate-700"
                      }`}
                    >
                      {netEffect > 0 ? "+" : ""}
                      {formatVND(netEffect)}
                    </span>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isExpanded
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100"
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expandable Breakdown Drawer */}
              {isExpanded && (
                <div className="mt-3.5 pt-3.5 border-t border-slate-100 pl-12 pr-2 text-xs bg-slate-50/70 p-3 rounded-xl">
                  <div className="font-semibold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Chi tiết chia tiền ({tx.sharingMembers?.length || 0} người tham gia):</span>
                    <span className="text-slate-500 font-normal">Tổng hóa đơn: {formatVND(tx.totalAmount)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tx.sharingMembers?.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700 font-medium">
                            {m.userName || (m.userId === currentUserId ? "Bạn" : "Thành viên")}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                              m.isPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {m.isPaid ? "Đã trả" : "Chưa trả"}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900">{formatVND(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {paginatedTransactions.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Không tìm thấy hóa đơn nào phù hợp với bộ lọc</p>
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination Footer (20 items per page) */}
      {calcTotalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Hiển thị{" "}
            <strong>
              {totalCount > 0 ? activePage * PAGE_SIZE + 1 : 0} -{" "}
              {Math.min((activePage + 1) * PAGE_SIZE, totalCount)}
            </strong>{" "}
            trên tổng số <strong>{totalCount}</strong> hóa đơn (Trang{" "}
            <strong>{activePage + 1}</strong> / <strong>{calcTotalPages}</strong>)
          </div>

          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              disabled={activePage <= 0}
              onClick={() => handlePageChange(0)}
              title="Trang đầu"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Prev Page */}
            <button
              disabled={activePage <= 0}
              onClick={() => handlePageChange(activePage - 1)}
              title="Trang trước"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Numeric Page Buttons */}
            {Array.from({ length: calcTotalPages }, (_, i) => i).map((p) => {
              const isCurrent = p === activePage;
              return (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
                    isCurrent
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "border border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {p + 1}
                </button>
              );
            })}

            {/* Next Page */}
            <button
              disabled={activePage >= calcTotalPages - 1}
              onClick={() => handlePageChange(activePage + 1)}
              title="Trang sau"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              disabled={activePage >= calcTotalPages - 1}
              onClick={() => handlePageChange(calcTotalPages - 1)}
              title="Trang cuối"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
