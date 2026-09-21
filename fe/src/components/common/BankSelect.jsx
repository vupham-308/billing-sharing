import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, Building2 } from "lucide-react";

function removeVietnameseTones(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase();
}

export default function BankSelect({
  banks = [],
  value = "",
  onChange,
  disabled = false,
  placeholder = "Chọn ngân hàng thụ hưởng",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Tìm thông tin ngân hàng hiện đang được chọn
  const selectedBank = useMemo(() => {
    return banks.find((b) => b.code === value);
  }, [banks, value]);

  // Lọc danh sách ngân hàng theo mã (code) hoặc tên (name), hỗ trợ không dấu
  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) return banks;
    const q = searchQuery.trim().toLowerCase();
    const qNoTones = removeVietnameseTones(q).toLowerCase();

    return banks.filter((b) => {
      const code = (b.code || "").toLowerCase();
      const name = (b.name || "").toLowerCase();
      const nameNoTones = removeVietnameseTones(b.name || "").toLowerCase();

      return (
        code.includes(q) ||
        name.includes(q) ||
        nameNoTones.includes(qNoTones)
      );
    });
  }, [banks, searchQuery]);

  // Click outside listener để đóng dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Tự động focus vào ô tìm kiếm khi mở dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelect = (bankCode) => {
    if (onChange) {
      onChange(bankCode);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm flex items-center justify-between gap-2 transition-all text-left ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-white"
            : "border-slate-200 hover:border-slate-300"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-100" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedBank ? (
            <>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-xs shrink-0 border border-indigo-100/80">
                {selectedBank.code}
              </span>
              <span className="text-sm font-medium text-slate-800 truncate">
                {selectedBank.name}
              </span>
            </>
          ) : (
            <span className="text-slate-400 text-sm truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-indigo-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm theo mã (VCB, MB...) hoặc tên ngân hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bank Items List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredBanks.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-500">
                Không tìm thấy ngân hàng nào phù hợp với "
                <span className="font-semibold text-slate-700">{searchQuery}</span>"
              </div>
            ) : (
              filteredBanks.map((b) => {
                const isSelected = b.code === value;
                return (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => handleSelect(b.code)}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-900 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-xs shrink-0 ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.code}
                      </span>
                      <span className="text-xs truncate">{b.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
