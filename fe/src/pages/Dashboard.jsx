import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import HeroBalance from "../components/HeroBalance";
import GroupList from "../components/GroupList";
import RecentTransactions from "../components/RecentTransactions";
import PaymentRequestsSection from "../components/PaymentRequestsSection";
import PaymentInfoCard from "../components/PaymentInfoCard";

// Modals
import CreateTransactionModal from "../components/modals/CreateTransactionModal";
import CreateGroupModal from "../components/modals/CreateGroupModal";
import VietQrModal from "../components/modals/VietQrModal";
import PaymentInfoModal from "../components/modals/PaymentInfoModal";
import AuthCard from "../components/auth/AuthCard";
import AddGroupMemberModal from "../components/modals/AddGroupMemberModal";

import { useAuth } from "../context/AuthContext";
import {
  groupApi,
  transactionApi,
  paymentRequestApi,
  paymentInfoApi,
} from "../services/api";

export default function Dashboard() {
  const { user, isLoading, refreshUser } = useAuth();
  const userId = user?.id;
  const dashboardRequest = useRef(0);
  const [transactionRevision, setTransactionRevision] = useState(0);
  const [transactionError, setTransactionError] = useState("");
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [memberGroup, setMemberGroup] = useState(null);
  const [settlingGroupId, setSettlingGroupId] = useState(null);

  // State
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [credits, setCredits] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState(null);

  // Pagination & filter
  const [dateFilter, setDateFilter] = useState("ALL");

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedQrData, setSelectedQrData] = useState(null);
  const [isPaymentInfoModalOpen, setIsPaymentInfoModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Tự động mở modal tài khoản nhận tiền khi có query param ?action=edit-payment
  useEffect(() => {
    if (searchParams.get("action") === "edit-payment") {
      setIsPaymentInfoModalOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Notification toast
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Helper để chuẩn hóa Transaction từ backend
  const normalizeTransaction = useCallback((tx, currentUserId) => {
    const isPayer = tx.payer?.id === currentUserId || tx.payerId === currentUserId;
    return {
      ...tx,
      payerId: tx.payer?.id || tx.payerId,
      payerName: isPayer ? "Bạn" : tx.payer?.fullName || tx.payerName || "Thành viên",
      status: tx.status || (tx.isPaid ? "PAID" : "UNPAID"),
      isPaid: typeof tx.isPaid === "boolean" ? tx.isPaid : tx.status === "PAID",
      sharingMembers: (tx.sharingMembers || []).map((m) => ({
        ...m,
        userId: m.userId || m.id,
        userName: m.fullName || m.userName || (m.userId === currentUserId ? "Bạn" : "Thành viên"),
        amount: m.shareAmount ?? m.amount,
        isPaid: typeof m.isPaid === "boolean" ? m.isPaid : false,
      })),
    };
  }, []);

  // Only group IDs affect the transaction scope, not balance/member updates.
  const groupIdsKey = JSON.stringify(groups.map((group) => group.id).sort());
  useEffect(() => {
    let active = true;
    const ids = selectedGroupId ? [selectedGroupId] : JSON.parse(groupIdsKey);
    setTransactions([]);
    setTransactionError("");
    if (!userId || ids.length === 0) {
      setTransactionsLoading(false);
      return;
    }
    setTransactionsLoading(true);
    async function load() {
      try {
        // RecentTransactions filters and paginates locally, so load all pages.
        const results = await Promise.all(ids.map(async (id) => {
          const items = [];
          let page = 0;
          let totalPages = 1;
          do {
            if (!active) return [];
            const result = await groupApi.getGroupTransactions(id, { page, size: 100, sort: "createdAt,desc" });
            items.push(...(result.content || []).map((tx) => normalizeTransaction({ ...tx, groupId: tx.groupId || id }, userId)));
            totalPages = result.totalPages || 1;
            page++;
          } while (page < totalPages);
          return items;
        }));
        if (active) setTransactions(results.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } catch (err) {
        if (active) setTransactionError(err.response?.data?.message || "Không thể tải hóa đơn. Vui lòng thử lại.");
      } finally {
        if (active) setTransactionsLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [userId, selectedGroupId, groupIdsKey, transactionRevision, normalizeTransaction]);

  // Tải toàn bộ dữ liệu Dashboard khi đăng nhập
  const loadDashboardData = useCallback(async () => {
    if (!userId) return;
    const requestId = ++dashboardRequest.current;

    try {
      const [groupsData, debtsData, creditsData, infoData] = await Promise.allSettled([
        groupApi.getGroups(),
        paymentRequestApi.getMyDebts(),
        paymentRequestApi.getMyCredits(),
        paymentInfoApi.getMyInfo(),
      ]);
      if (requestId !== dashboardRequest.current) return;

      // Xử lý thông tin tài khoản ngân hàng
      if (infoData.status === "fulfilled" && infoData.value && infoData.value.accountNumber) {
        setPaymentInfo(infoData.value);
      } else {
        setPaymentInfo(null);
      }

      // Xử lý danh sách nhóm
      let loadedGroups = [];
      if (groupsData.status === "fulfilled" && Array.isArray(groupsData.value)) {
        loadedGroups = groupsData.value.map((g) => ({
          ...g,
          myBalance: g.myBalanceInGroup ?? g.myBalance ?? 0,
        }));
        setGroups(loadedGroups);
      }

      // Xử lý công nợ
      if (debtsData.status === "fulfilled" && Array.isArray(debtsData.value)) {
        const normalizedDebts = debtsData.value.map((d) => ({
          ...d,
          toUserName: d.creditor?.fullName || d.toUserName || "Người nhận",
        }));
        setDebts(normalizedDebts);
      }

      if (creditsData.status === "fulfilled" && Array.isArray(creditsData.value)) {
        const normalizedCredits = creditsData.value.map((c) => ({
          ...c,
          fromUserName: c.debtor?.fullName || c.fromUserName || "Người chuyển",
        }));
        setCredits(normalizedCredits);
      }

    } catch (err) {
      console.error("Lỗi khi tải dữ liệu Dashboard:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadDashboardData();
    } else {
      setGroups([]);
      setDebts([]);
      setCredits([]);
      setPaymentInfo(null);
      setSelectedGroupId(null);
      setMemberGroup(null);
    }
    return () => { dashboardRequest.current++; };
  }, [userId, loadDashboardData]);

  // Xử lý chuyển đổi nhóm chi tiêu
  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
  };

  // Filter transactions theo ngày ở UI
  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    if (selectedGroupId) {
      list = list.filter((t) => t.groupId === selectedGroupId);
    }

    const now = new Date();
    if (dateFilter === "7DAYS") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      list = list.filter((t) => new Date(t.createdAt) >= sevenDaysAgo);
    } else if (dateFilter === "MONTH") {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((t) => new Date(t.createdAt) >= firstDayOfMonth);
    }

    return list;
  }, [transactions, selectedGroupId, dateFilter]);

  // Tính tổng nợ / có
  const totalOwedToYou = useMemo(() => {
    return credits
      .filter((c) => c.status === "PENDING" || c.status === "WAITING_APPROVE")
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [credits]);

  const totalYouOwe = useMemo(() => {
    return debts
      .filter((d) => d.status === "PENDING" || d.status === "WAITING_APPROVE")
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [debts]);

  // Handlers: Tạo hóa đơn
  const handleCreateTransaction = async (formData) => {
    try {
      await transactionApi.createTransaction(formData.groupId, {
        title: formData.title,
        totalAmount: formData.totalAmount,
        shares: formData.shares,
      });

      showToast("Đã tạo hóa đơn mới thành công!");
      // Tải lại giao dịch nhóm
      if (formData.groupId) {
        setSelectedGroupId(formData.groupId);
      }
      setTransactionRevision((value) => value + 1);
      // Tải lại công nợ & số dư
      await Promise.all([loadDashboardData(), refreshUser()]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Tạo hóa đơn thất bại";
      showToast(msg);
      throw err;
    }
  };

  // Handlers: Tạo nhóm
  const handleCreateGroup = async (formData) => {
    try {
      const res = await groupApi.createGroup({
        name: formData.name,
        summaryDayOfMonth: formData.summaryDayOfMonth,
      });
      showToast(`Đã tạo nhóm "${res.name}" thành công!`);
      const updatedGroups = await groupApi.getGroups();
      setGroups((updatedGroups || []).map((group) => ({ ...group, myBalance: group.myBalanceInGroup ?? 0 })));
      setSelectedGroupId(res.id);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Tạo nhóm thất bại";
      showToast(msg);
      throw err;
    }
  };

  const handleSettleEarly = async (group) => {
    const confirmed = window.confirm(
      `Tất toán trước hạn nhóm "${group.name}"? Hệ thống sẽ tạo sao kê và đưa email vào hàng đợi gửi ngay.`
    );
    if (!confirmed) return;

    setSettlingGroupId(group.id);
    try {
      const result = await groupApi.settleEarly(group.id);
      const created = result?.paymentRequestsCreated ?? 0;
      showToast(
        result?.statementQueued
          ? `Đã tất toán nhóm "${group.name}" và xếp email sao kê vào hàng đợi (${created} khoản mới).`
          : `Nhóm "${group.name}" không có khoản nợ cần tất toán.`
      );
      await Promise.all([loadDashboardData(), refreshUser()]);
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể tất toán nhóm trước hạn.");
    } finally {
      setSettlingGroupId(null);
    }
  };

  // Handlers: Quét VietQR
  const handleOpenQrModal = async (debtItem) => {
    try {
      const qrRes = await paymentRequestApi.getQr(debtItem.id);
      setSelectedQrData({
        id: debtItem.id,
        paymentRequestId: debtItem.id,
        bankCode: qrRes.bankCode,
        accountNumber: qrRes.accountNumber,
        accountHolderName: qrRes.accountHolderName,
        amount: qrRes.amount,
        description: qrRes.description,
        qrUrl: qrRes.qrUrl,
        mode: "PAYMENT_REQUEST",
        status: qrRes.status || debtItem.status,
        transactionTitle: qrRes.transactionTitle || debtItem.transactionTitle,
        groupName: qrRes.groupName || debtItem.groupName,
        creditorName: qrRes.creditorName || debtItem.toUserName,
        originalAmount: qrRes.originalAmount ?? debtItem.originalAmount,
        nettedAmount: qrRes.nettedAmount ?? debtItem.nettedAmount,
        breakdown: qrRes.breakdown ?? debtItem.breakdown,
      });
      setIsQrModalOpen(true);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Người thụ hưởng chưa thiết lập số tài khoản ngân hàng để tạo mã QR.";
      showToast(msg);
    }
  };

  // Xem trước VietQR cá nhân
  const handlePreviewPersonalQr = () => {
    if (!paymentInfo || !paymentInfo.accountNumber) {
      setIsPaymentInfoModalOpen(true);
      return;
    }
    setSelectedQrData({
      id: "personal-qr",
      mode: "PERSONAL",
      bankCode: paymentInfo.bankCode,
      accountNumber: paymentInfo.accountNumber,
      accountHolderName: paymentInfo.accountHolderName,
      amount: 0,
      description: `Billing Sharing ${user?.fullName || user?.name || "thanh toan"}`,
      qrUrl: paymentInfo.qrUrl || undefined,
    });
    setIsQrModalOpen(true);
  };

  // Xác nhận đã chuyển tiền
  const handleConfirmPaid = async (paymentRequestId) => {
    try {
      const response = await paymentRequestApi.confirmPaid(paymentRequestId);
      setDebts((prev) =>
        prev.map((d) => (d.id === paymentRequestId ? { ...d, status: "WAITING_APPROVE" } : d))
      );
      showToast("Đã xác nhận thanh toán! Đang chờ đối phương duyệt nhận tiền.");
      return response;
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể xác nhận thanh toán.");
      throw err;
    }
  };

  const handleRefreshQrStatus = useCallback(async (paymentRequestId) => {
    const detail = await paymentRequestApi.getDetail(paymentRequestId);
    setDebts((prev) =>
      prev.map((debt) => (debt.id === paymentRequestId ? { ...debt, status: detail.status } : debt))
    );
    setSelectedQrData((previous) =>
      previous?.paymentRequestId === paymentRequestId
        ? { ...previous, status: detail.status }
        : previous
    );
    return detail;
  }, []);

  // Duyệt đã nhận tiền
  const handleApproveCredit = async (paymentRequestId) => {
    try {
      await paymentRequestApi.approve(paymentRequestId);
      setCredits((prev) =>
        prev.map((c) => (c.id === paymentRequestId ? { ...c, status: "COMPLETED" } : c))
      );
      refreshUser();
      showToast("Đã duyệt đã nhận tiền thành công!");
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể duyệt nhận tiền.");
    }
  };

  // Từ chối nhận tiền
  const handleRejectCredit = async (paymentRequestId) => {
    try {
      await paymentRequestApi.reject(paymentRequestId);
      setCredits((prev) =>
        prev.map((c) => (c.id === paymentRequestId ? { ...c, status: "PENDING" } : c))
      );
      showToast("Đã chuyển lại yêu cầu về trạng thái Chưa nhận được tiền.");
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể từ chối nhận tiền.");
    }
  };

  // Lưu thông tin tài khoản ngân hàng
  const handleSavePaymentInfo = async (infoData) => {
    try {
      const res = await paymentInfoApi.saveMyInfo(infoData);
      setPaymentInfo(res);
      showToast("Đã lưu thông tin tài khoản ngân hàng thành công!");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Không thể lưu thông tin ngân hàng.";
      showToast(msg);
      throw err;
    }
  };

  // 1. Màn hình loading khi đang xác thực phiên đăng nhập
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  // 2. Màn hình khi chưa đăng nhập: hiển thị trực tiếp form đăng nhập/đăng ký/quên mật khẩu ở giữa trang
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar
          onOpenCreateTransaction={() => {}}
          onOpenCreateGroup={() => {}}
          onOpenAuthModal={() => {}}
        />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-10">
          <AuthCard initialMode="LOGIN" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-xs sm:text-sm font-medium animate-bounce flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation */}
      <Navbar
        onOpenCreateTransaction={() => setIsTxModalOpen(true)}
        onOpenCreateGroup={() => setIsGroupModalOpen(true)}
        onOpenAuthModal={() => {}}
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <HeroBalance
          user={user}
          totalOwedToYou={totalOwedToYou}
          totalYouOwe={totalYouOwe}
          onOpenCreateTransaction={() => setIsTxModalOpen(true)}
          onOpenCreateGroup={() => setIsGroupModalOpen(true)}
          groups={groups}
          selectedGroupId={selectedGroupId}
        />

        {/* 2-column layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <GroupList
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelectGroup={handleSelectGroup}
              onOpenCreateGroup={() => setIsGroupModalOpen(true)}
              onOpenCreateModal={() => setIsGroupModalOpen(true)}
              currentUser={user}
              onAddMember={setMemberGroup}
              onSettleEarly={handleSettleEarly}
              settlingGroupId={settlingGroupId}
            />

            {transactionsLoading && <p role="status" className="text-sm text-slate-500">Đang tải hóa đơn...</p>}
            {transactionError && <div role="alert" className="text-sm text-rose-600">{transactionError} <button type="button" onClick={() => setTransactionRevision((value) => value + 1)} className="underline">Thử lại</button></div>}
            <RecentTransactions
              key={selectedGroupId || "all-groups"}
              transactions={filteredTransactions}
              currentUserId={user?.id}
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
            />
          </div>

          {/* Sidebar (Right 1 col) */}
          <div className="space-y-6">
            <PaymentRequestsSection
              debts={debts}
              credits={credits}
              onOpenQrModal={handleOpenQrModal}
              onApproveCredit={handleApproveCredit}
              onRejectCredit={handleRejectCredit}
            />

            <PaymentInfoCard
              paymentInfo={paymentInfo}
              onOpenEditModal={() => setIsPaymentInfoModalOpen(true)}
              onPreviewPersonalQr={handlePreviewPersonalQr}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      {memberGroup && <AddGroupMemberModal
        key={memberGroup.id}
        group={memberGroup}
        onClose={() => setMemberGroup(null)}
        onMembersChanged={(groupId, members) => {
          setGroups((previous) => previous.map((group) => group.id === groupId ? { ...group, members, memberCount: members.length } : group));
        }}
      />}
      <CreateTransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        groups={groups}
        onSubmit={handleCreateTransaction}
        currentUserId={user?.id}
      />

      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSubmit={handleCreateGroup}
      />

      <VietQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrData={selectedQrData}
        onConfirmPaid={handleConfirmPaid}
        onRefreshStatus={handleRefreshQrStatus}
      />

      <PaymentInfoModal
        isOpen={isPaymentInfoModalOpen}
        onClose={() => setIsPaymentInfoModalOpen(false)}
        currentInfo={paymentInfo}
        onSave={handleSavePaymentInfo}
        isForceSetup={false}
      />
    </div>
  );
}
