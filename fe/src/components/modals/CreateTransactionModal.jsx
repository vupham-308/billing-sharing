import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { X, Receipt, Check, AlertCircle } from "lucide-react";
import { formatVND, formatNumber } from "../../utils/formatters";
import { splitAmount } from "../../utils/splitAmount";

export default function CreateTransactionModal({ isOpen, onClose, groups = [], onSubmit, currentUserId }) {
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [splitType, setSplitType] = useState("EQUAL"); // "EQUAL" | "CUSTOM"
  const [members, setMembers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [customShares, setCustomShares] = useState(null);
  const [shareDraft, setShareDraft] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountInputRef = useRef(null);
  const cursorPositionRef = useRef(null);

  useEffect(() => {
    if (isOpen && groups.length > 0 && !groupId) {
      setGroupId(groups[0].id);
    }
  }, [isOpen, groups, groupId]);

  useEffect(() => {
    if (!isOpen || !groupId) return;
    let isCancelled = false;

    async function fetchMembers() {
      const selectedGroup = groups.find((g) => g.id === groupId);
      let groupMembers = selectedGroup?.members || [];
      if (!groupMembers || groupMembers.length === 0) {
        try {
          groupMembers = await groupApi.getMembers(groupId);
        } catch (err) {
          console.error("Không thể tải thành viên của nhóm", err);
          groupMembers = [];
        }
      }

      if (!isCancelled) {
        setMembers(groupMembers);
        const allIds = groupMembers.map((m) => m.userId || m.id);
        setSelectedMemberIds(allIds);

        setCustomShares(null);
        setShareDraft(null);
      }
    }

    fetchMembers();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, groupId, groups]);

  const handleAmountChange = (e) => {
    const input = e.target;
    const cursorPos = input.selectionStart ?? input.value.length;
    const digitsBefore = input.value.slice(0, cursorPos).replace(/\D/g, "").length;

    let rawVal = input.value.replace(/\D/g, "");
    if (rawVal.length > 1 && rawVal.startsWith("0")) {
      rawVal = rawVal.replace(/^0+/, "") || "0";
    }

    if (rawVal && !Number.isSafeInteger(Number(rawVal))) {
      setError("Số tiền quá lớn để chia chính xác.");
      return;
    }

    const nextFormatted = rawVal === "" ? "" : formatNumber(rawVal);

    let targetPos = 0;
    let digitCount = 0;
    for (let i = 0; i < nextFormatted.length; i++) {
      if (/\d/.test(nextFormatted[i])) {
        digitCount++;
      }
      if (digitCount === digitsBefore) {
        targetPos = i + 1;
        break;
      }
    }
    if (digitsBefore === 0) targetPos = 0;
    if (digitCount < digitsBefore) targetPos = nextFormatted.length;

    cursorPositionRef.current = targetPos;
    setTotalAmount(rawVal);
    setCustomShares(null);
    setShareDraft(null);
    setError("");
  };

  const handleAmountKeyDown = (e) => {
    if (e.key === "Backspace") {
      const input = e.target;
      const { selectionStart, selectionEnd } = input;
      if (selectionStart === selectionEnd && selectionStart > 0) {
        const charBefore = input.value[selectionStart - 1];
        if (/\D/.test(charBefore)) {
          e.preventDefault();
          const val = input.value;
          const newVal = val.slice(0, selectionStart - 2) + val.slice(selectionStart);
          const rawVal = newVal.replace(/\D/g, "");
          const digitsBefore = val.slice(0, selectionStart - 2).replace(/\D/g, "").length;

          const nextFormatted = rawVal === "" ? "" : formatNumber(rawVal);
          let targetPos = 0;
          let digitCount = 0;
          for (let i = 0; i < nextFormatted.length; i++) {
            if (/\d/.test(nextFormatted[i])) digitCount++;
            if (digitCount === digitsBefore) {
              targetPos = i + 1;
              break;
            }
          }
          if (digitsBefore === 0) targetPos = 0;
          if (digitCount < digitsBefore) targetPos = nextFormatted.length;

          cursorPositionRef.current = targetPos;
          setTotalAmount(rawVal);
          setCustomShares(null);
          setShareDraft(null);
          setError("");
        }
      }
    }
  };

  useLayoutEffect(() => {
    if (cursorPositionRef.current !== null && amountInputRef.current) {
      const pos = cursorPositionRef.current;
      try {
        amountInputRef.current.setSelectionRange(pos, pos);
      } catch {
        // Safe fallback in test environments
      }
      cursorPositionRef.current = null;
    }
  });

  if (!isOpen) return null;

  const toggleMember = (id) => {
    setCustomShares(null);
    setShareDraft(null);
    setSelectedMemberIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        if (prev.length <= 1) return prev; // Phải có ít nhất 1 người
        return prev.filter((mId) => mId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleCustomShareChange = (memberId, value) => {
    setSplitType("CUSTOM");
    let rawVal = value.replace(/\D/g, "");
    if (rawVal.length > 1 && rawVal.startsWith("0")) {
      rawVal = rawVal.replace(/^0+/, "") || "0";
    }
    setShareDraft({ memberId, value: rawVal });
    setError("");
  };

  // Calculations
  const numericTotal = parseInt(totalAmount, 10) || 0;
  const equalShares = splitAmount(numericTotal, selectedMemberIds, currentUserId);
  const baseShares = customShares || equalShares;
  const currentShares = shareDraft
    ? { ...baseShares, [shareDraft.memberId]: shareDraft.value === "" ? 0 : Number(shareDraft.value) }
    : baseShares;
  const displayedShares = currentShares;

  const customSum = selectedMemberIds.reduce((sum, id) => sum + (displayedShares[id] || 0), 0);
  const diff = customSum - numericTotal;
  const isCustomBalanced = numericTotal > 0 && diff === 0;
  const hasInvalidShare = selectedMemberIds.some((id) => (displayedShares[id] || 0) < 1);

  const commitShareDraft = (memberId = shareDraft?.memberId) => {
    if (!shareDraft || (memberId && shareDraft.memberId !== memberId)) {
      return customShares || equalShares;
    }
    if (shareDraft.value === "") {
      setShareDraft(null);
      setError("");
      return customShares || equalShares;
    }
    const nextVal = Number(shareDraft.value);
    const base = customShares || equalShares;
    const next = { ...base, [shareDraft.memberId]: nextVal };
    setCustomShares(next);
    setShareDraft(null);
    setError("");
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const committedShares = commitShareDraft();

    if (!groupId) {
      setError("Vui lòng chọn nhóm chi tiêu");
      return;
    }
    if (!title.trim()) {
      setError("Vui lòng nhập tên hóa đơn/khoản chi");
      return;
    }
    if (numericTotal <= 0) {
      setError("Vui lòng nhập tổng số tiền hợp lệ (> 0)");
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError("Phải có ít nhất 1 người tham gia chia tiền");
      return;
    }

    const committedSum = selectedMemberIds.reduce((sum, id) => sum + (committedShares[id] || 0), 0);
    const hasInvalidCommitted = selectedMemberIds.some((id) => (committedShares[id] || 0) < 1);
    if (numericTotal < selectedMemberIds.length || committedSum !== numericTotal || hasInvalidCommitted) {
      setError("Tổng tiền chia phải bằng tổng hóa đơn và mỗi người phải có ít nhất 1 đồng.");
      return;
    }
    const shares = selectedMemberIds.map((id) => ({ userId: id, shareAmount: committedShares[id] }));

    setIsSubmitting(true);
    try {
      await onSubmit({
        groupId,
        title: title.trim(),
        totalAmount: numericTotal,
        shares,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Không thể tạo hóa đơn mới.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Thêm hóa đơn / Chi tiêu mới</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Nhóm */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nhóm chi tiêu
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tiêu đề & Tổng tiền */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên khoản chi
              </label>
              <input
                type="text"
                placeholder="VD: Tiền phòng tháng 9, Ăn lẩu..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tổng số tiền (VNĐ)
              </label>
              <input
                ref={amountInputRef}
                type="text"
                placeholder="0"
                aria-label="Tổng số tiền"
                inputMode="numeric"
                value={totalAmount === "" ? "" : formatNumber(totalAmount)}
                onChange={handleAmountChange}
                onKeyDown={handleAmountKeyDown}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Cách chia tiền */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Phương thức chia tiền
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setSplitType("EQUAL"); setCustomShares(null); setShareDraft(null); setError(""); }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  splitType === "EQUAL"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Chia đều (ưu tiên phần lẻ cho người trả)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSplitType("CUSTOM");
                  if (!customShares) {
                    setCustomShares({ ...equalShares });
                  }
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  splitType === "CUSTOM"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Tùy chỉnh số tiền từng người
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Nhập số tiền cho từng người. Tổng số tiền chia phải bằng chính xác tổng hóa đơn để có thể tạo.
            </p>
          </div>

          {/* Danh sách người tham gia chia */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Thành viên chia ({selectedMemberIds.length}/{members.length})
              </label>
              <div className="flex items-center gap-1.5">
                <span
                  aria-label="Tổng đã chia / tổng hóa đơn"
                  className={`text-xs font-semibold ${
                    numericTotal > 0 && isCustomBalanced
                      ? "text-emerald-600"
                      : diff < 0
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatVND(customSum)} / {formatVND(numericTotal)}
                </span>
                {numericTotal > 0 && (
                  <span
                    className={`text-[11px] font-medium ${
                      isCustomBalanced
                        ? "text-emerald-600"
                        : diff < 0
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}
                  >
                    {isCustomBalanced
                      ? "(Đã khớp)"
                      : diff < 0
                      ? `(Thiếu ${formatVND(Math.abs(diff))})`
                      : `(Dư ${formatVND(diff)})`}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {members.map((member) => {
                const memberId = member.userId || member.id;
                const isSelected = selectedMemberIds.includes(memberId);
                const isMe = memberId === currentUserId;
                const memberName = member.fullName || member.name || (isMe ? "Bạn" : "Thành viên");

                return (
                  <div
                    key={memberId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-slate-50/80 border-slate-200"
                        : "bg-white border-slate-100 opacity-60"
                    }`}
                  >
                    <div
                      onClick={() => toggleMember(memberId)}
                      className="flex items-center gap-2.5 cursor-pointer select-none flex-1"
                    >
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-medium text-slate-800">
                        {memberName} {isMe && "(Bạn)"}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-1.5 w-36">
                        <input
                          type="text"
                          aria-label={`Số tiền của ${memberName}`}
                          inputMode="numeric"
                          value={
                            shareDraft?.memberId === memberId
                              ? shareDraft.value
                              : displayedShares[memberId] !== undefined && displayedShares[memberId] !== null
                              ? formatNumber(displayedShares[memberId])
                              : ""
                          }
                          disabled={numericTotal < selectedMemberIds.length}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleCustomShareChange(memberId, e.target.value)}
                          onBlur={() => commitShareDraft(memberId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitShareDraft(memberId);
                            }
                          }}
                          placeholder="0"
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[11px] text-slate-400 font-medium">đ</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {members.length === 0 && (
                <div className="py-4 text-center text-xs text-slate-400">
                  Đang tải thành viên nhóm...
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || numericTotal <= 0 || !isCustomBalanced || hasInvalidShare}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Đang tạo..." : "Xác nhận tạo hóa đơn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
