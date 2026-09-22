import React, { useState, useEffect, useMemo, useCallback } from "react";
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

import { useAuth } from "../context/AuthContext";
import {
  groupApi,
  transactionApi,
  paymentRequestApi,
  paymentInfoApi,
} from "../services/api";
import { ShieldAlert, Receipt, LogIn } from "lucide-react";

export default function Dashboard() {
  const { user, isLoading, refreshUser } = useAuth();

  // State
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [credits, setCredits] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [isForceBankSetup, setIsForceBankSetup] = useState(false);

  // Pagination & filter
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFilter, setDateFilter] = useState("ALL");

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedQrData, setSelectedQrData] = useState(null);
  const [isPaymentInfoModalOpen, setIsPaymentInfoModalOpen] = useState(false);

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

  // Tải danh sách giao dịch theo nhóm
  const loadGroupTransactions = useCallback(
    async (groupId, targetPage = 0) => {
      if (!groupId) return;
      try {
        const res = await groupApi.getGroupTransactions(groupId, {
          page: targetPage,
          size: 20,
          sort: "createdAt,desc",
        });
        const items = (res.content || []).map((t) => normalizeTransaction(t, user?.id));
        setTransactions(items);
        setTotalPages(res.totalPages || 1);
        setPage(res.number || 0);
      } catch (err) {
        console.error("Lỗi khi tải giao dịch nhóm:", err);
      }
    },
    [user?.id, normalizeTransaction]
  );

  // Tải toàn bộ dữ liệu Dashboard khi đăng nhập
  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      const [groupsData, debtsData, creditsData, infoData] = await Promise.allSettled([
        groupApi.getGroups(),
        paymentRequestApi.getMyDebts(),
        paymentRequestApi.getMyCredits(),
        paymentInfoApi.getMyInfo(),
      ]);

      // Xử lý thông tin tài khoản ngân hàng
      if (infoData.status === "fulfilled" && infoData.value && infoData.value.accountNumber) {
        setPaymentInfo(infoData.value);
      } else {
        setPaymentInfo(null);
      }
      setIsForceBankSetup(false);
      setIsPaymentInfoModalOpen(false);

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

      // Tải giao dịch của nhóm đầu tiên nếu có
      if (loadedGroups.length > 0) {
        const targetId = selectedGroupId || loadedGroups[0].id;
        setSelectedGroupId(targetId);
        loadGroupTransactions(targetId, 0);
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu Dashboard:", err);
    }
  }, [user, selectedGroupId, loadGroupTransactions]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  // Xử lý chuyển đổi nhóm chi tiêu
  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
    if (groupId) {
      loadGroupTransactions(groupId, 0);
    }
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
        loadGroupTransactions(formData.groupId, 0);
      }
      // Tải lại công nợ & số dư
      paymentRequestApi.getMyDebts().then((d) => setDebts(d || []));
      paymentRequestApi.getMyCredits().then((c) => setCredits(c || []));
      refreshUser();
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
      setGroups(updatedGroups || []);
      setSelectedGroupId(res.id);
      loadGroupTransactions(res.id, 0);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Tạo nhóm thất bại";
      showToast(msg);
      throw err;
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
      bankCode: paymentInfo.bankCode,
      accountNumber: paymentInfo.accountNumber,
      accountHolderName: paymentInfo.accountHolderName,
      amount: 0,
      description: `ChiaTien ${user?.fullName || user?.name || "thanh toan"}`,
    });
    setIsQrModalOpen(true);
  };

  // Xác nhận đã chuyển tiền
  const handleConfirmPaid = async (paymentRequestId) => {
    try {
      await paymentRequestApi.confirmPaid(paymentRequestId);
      setDebts((prev) =>
        prev.map((d) => (d.id === paymentRequestId ? { ...d, status: "WAITING_APPROVE" } : d))
      );
      showToast("Đã xác nhận thanh toán! Đang chờ đối phương duyệt nhận tiền.");
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể xác nhận thanh toán.");
    }
  };

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
      setIsForceBankSetup(false);
      showToast("Đã lưu thông tin tài khoản ngân hàng thành công!");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Không thể lưu thông tin ngân hàng.";
      showToast(msg);
      throw err;
    }
  };

  // Màn hình khi chưa đăng nhập: hiển thị trực tiếp form đăng nhập/đăng ký/quên mật khẩu ở giữa trang, bên trên là header
  if (!user && !isLoading) {
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
            />

            <RecentTransactions
              transactions={filteredTransactions}
              currentUserId={user?.id}
              dateFilter={dateFilter}
              onChangeDateFilter={setDateFilter}
              page={page}
              totalPages={totalPages}
              onPageChange={(p) => loadGroupTransactions(selectedGroupId, p)}
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
