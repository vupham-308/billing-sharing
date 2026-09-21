import React from "react";
import { Users, Calendar, ArrowRight, Plus, FolderKanban } from "lucide-react";
import { formatVND } from "../utils/formatters";

export default function GroupList({ groups = [], selectedGroupId, onSelectGroup, onOpenCreateGroup }) {
  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nhóm chi tiêu của bạn</h2>
            <p className="text-xs text-slate-500">Bấm vào nhóm để xem sao kê hóa đơn chi tiết</p>
          </div>
        </div>
        <button
          onClick={onOpenCreateGroup}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo nhóm</span>
        </button>
      </div>

      {/* Group Pills / Filter buttons */}
      <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar border-b border-slate-100 mb-4">
        <button
          onClick={() => onSelectGroup(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            selectedGroupId === null
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          Tất cả các nhóm ({groups.length})
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              selectedGroupId === group.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* Grid of group cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          const userBalance = group.myBalance ?? 0;
          const isPositive = userBalance > 0;
          const isZero = userBalance === 0;

          return (
            <div
              key={group.id}
              onClick={() => onSelectGroup(isSelected ? null : group.id)}
              className={`cursor-pointer group relative p-4 rounded-xl border transition-all ${
                isSelected
                  ? "bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                  {group.name}
                </h3>
                {group.summaryDayOfMonth && (
                  <span
                    title={`Chốt sao kê và gửi mail vào ngày ${group.summaryDayOfMonth} hàng tháng`}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                  >
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Ngày {group.summaryDayOfMonth}</span>
                  </span>
                )}
              </div>

              {group.description && (
                <p className="text-xs text-slate-500 line-clamp-1 mb-3">{group.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <div className="text-slate-500 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>{group.memberCount || group.members?.length || 1} thành viên</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Số dư trong nhóm</span>
                  <span
                    className={`font-bold ${
                      isZero
                        ? "text-slate-600"
                        : isPositive
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {formatVND(userBalance)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <FolderKanban className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Bạn chưa tham gia nhóm nào</p>
            <button
              onClick={onOpenCreateGroup}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
            >
              + Bấm vào đây để tạo nhóm đầu tiên
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
