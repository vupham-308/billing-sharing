import React, { useState, useEffect, useMemo } from "react";
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
import AuthModal from "../components/modals/AuthModal";

import { useAuth } from "../context/AuthContext";
import { groupApi, transactionApi, paymentRequestApi, paymentInfoApi } from "../services/api";
import {
  MOCK_GROUPS,
  MOCK_TRANSACTIONS,
  MOCK_DEBTS,
  MOCK_CREDITS,
  MOCK_PAYMENT_INFO,
} from "../services/mockData";

export default function Dashboard() {
  const { user, isDemo, setUser } = useAuth();

  // State
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [credits, setCredits] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState(null);

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Notification banner
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Fetch or Load data
  useEffect(() => {
    async function loadDashboardData() {
      if (isDemo) {
        setGroups(MOCK_GROUPS);
        setTransactions(MOCK_TRANSACTIONS);
        setDebts(MOCK_DEBTS);
        setCredits(MOCK_CREDITS);
        setPaymentInfo(MOCK_PAYMENT_INFO);
        setTotalPages(1);
        return;
      }

      try {
        const [groupsData, debtsData, creditsData, infoData] = await Promise.allSettled([
          groupApi.getGroups(),
          paymentRequestApi.getMyDebts(),
          paymentRequestApi.getMyCredits(),
          paymentInfoApi.getMyInfo(),
        ]);

        if (groupsData.status === "fulfilled") setGroups(groupsData.value);
        if (debtsData.status === "fulfilled") setDebts(debtsData.value);
        if (creditsData.status === "fulfilled") setCredits(creditsData.value);
        if (infoData.status === "fulfilled") setPaymentInfo(infoData.value);

        // Load transactions for first group or overall
        if (groupsData.status === "fulfilled" && groupsData.value.length > 0) {
          const firstGroupId = groupsData.value[0].id;
          loadGroupTransactions(firstGroupId, 0);
        }
      } catch (err) {
        console.error("Error loading dashboard data", err);
      }
    }

    loadDashboardData();
  }, [isDemo]);

  // Load transactions based on selected group and pagination
  const loadGroupTransactions = async (groupId, targetPage) => {
    if (isDemo) {
      // In demo mode, filter mock transactions
      return;
    }
    try {
      const res = await groupApi.getGroupTransactions(groupId, {
        page: targetPage,
        size: 10,
      });
      setTransactions(res.content || []);
      setTotalPages(res.totalPages || 1);
      setPage(res.number || 0);
    } catch (err) {
      console.error("Error loading group transactions", err);
    }
  };

  // Filter transactions in UI (especially for demo mode and date filters)
  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    if (selectedGroupId) {
      list = list.filter((t) => t.groupId === selectedGroupId);
    }

    const now = new Date();
    if (dateFilter === "7DAYS") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      list = list.filter((t) => new Date(t.createdAt || t.date) >= sevenDaysAgo);
    } else if (dateFilter === "MONTH") {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((t) => new Date(t.createdAt || t.date) >= firstDayOfMonth);
    }

    return list;
  }, [transactions, selectedGroupId, dateFilter]);

  // Calculate totals
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

  // Modal Handlers: Create Transaction
  const handleCreateTransaction = async (formData) => {
    if (isDemo) {
      const targetGroup = groups.find((g) => g.id === formData.groupId);
      const myShare =
        formData.sharingMembers.find((m) => m.userId === user?.id)?.amount || 0;
      const netGain = formData.totalAmount - myShare;

      const newTx = {
        id: `tx-demo-${Date.now()}`,
        groupId: formData.groupId,
        groupName: targetGroup?.name || "Nhóm",
        title: formData.title,
        totalAmount: formData.totalAmount,
        payerId: user?.id,
        payerName: "Bạn",
        createdAt: new Date().toISOString(),
        sharingMembers: formData.sharingMembers.map((m) => {
          const matchedMember = targetGroup?.members?.find((gm) => (gm.userId || gm.id) === m.userId);
          return {
            userId: m.userId,
            userName: m.userId === user?.id ? "Bạn" : matchedMember?.name || "Thành viên",
            amount: m.amount,
          };
        }),
      };

      setTransactions([newTx, ...transactions]);

      // Update user balance
      if (user) {
        setUser({ ...user, balance: (user.balance || 0) + netGain });
      }
      showToast("Đã tạo hóa đơn thành công! Số dư đã được cập nhật.");
      return;
    }

    // Live API
    await transactionApi.createTransaction(formData);
    showToast("Đã tạo hóa đơn mới!");
    // Refresh group transactions
    if (formData.groupId) {
      loadGroupTransactions(formData.groupId, 0);
    }
  };

  // Modal Handlers: Create Group
  const handleCreateGroup = async (formData) => {
    if (isDemo) {
      const newGroup = {
        id: `g-demo-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        summaryDayOfMonth: formData.summaryDayOfMonth,
        myBalance: 0,
        memberCount: 1,
        members: [{ id: user?.id, name: `${user?.name} (Bạn)` }],
      };
      setGroups([newGroup, ...groups]);
      showToast(`Đã tạo nhóm "${formData.name}" thành công!`);
      return;
    }

    // Live API
    const res = await groupApi.createGroup(formData);
    setGroups([res, ...groups]);
    showToast(`Đã tạo nhóm "${res.name}"!`);
  };

  // Modal Handlers: Open VietQR
  const handleOpenQrModal = (debtItem) => {
    setSelectedQrData({
      id: debtItem.id,
      paymentRequestId: debtItem.id,
      bankCode: debtItem.bankCode || "MB",
      accountNumber: debtItem.accountNumber || "0123456789",
      accountHolderName: debtItem.toUserName || "NGUYEN VAN A",
      amount: debtItem.amount,
      description: debtItem.description || `ChiaTien thanh toan ${debtItem.id.slice(0, 8)}`,
    });
    setIsQrModalOpen(true);
  };

  // Personal VietQR preview
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
      description: `ChiaTien ${user?.name || "thanh toan"}`,
    });
    setIsQrModalOpen(true);
  };

  // Confirm Paid
  const handleConfirmPaid = async (paymentRequestId) => {
    if (isDemo) {
      setDebts((prev) =>
        prev.map((d) => (d.id === paymentRequestId ? { ...d, status: "WAITING_APPROVE" } : d))
      );
      showToast("Đã xác nhận thanh toán! Đang chờ đối phương xác nhận nhận tiền.");
      return;
    }

    await paymentRequestApi.confirmPaid(paymentRequestId);
    setDebts((prev) =>
      prev.map((d) => (d.id === paymentRequestId ? { ...d, status: "WAITING_APPROVE" } : d))
    );
    showToast("Đã xác nhận thanh toán!");
  };

  // Approve Credit
  const handleApproveCredit = async (paymentRequestId) => {
    if (isDemo) {
      const targetItem = credits.find((c) => c.id === paymentRequestId);
      setCredits((prev) =>
        prev.map((c) => (c.id === paymentRequestId ? { ...c, status: "COMPLETED" } : c))
      );
      if (user && targetItem) {
        setUser({ ...user, balance: (user.balance || 0) + targetItem.amount });
      }
      showToast("Đã duyệt nhận tiền thành công! Số dư đã được hoàn tất.");
      return;
    }

    await paymentRequestApi.approve(paymentRequestId);
    setCredits((prev) =>
      prev.map((c) => (c.id === paymentRequestId ? { ...c, status: "COMPLETED" } : c))
    );
    showToast("Đã duyệt đã nhận tiền!");
  };

  // Reject Credit
  const handleRejectCredit = async (paymentRequestId) => {
    if (isDemo) {
      setCredits((prev) =>
        prev.map((c) => (c.id === paymentRequestId ? { ...c, status: "PENDING" } : c))
      );
      showToast("Đã chuyển lại yêu cầu về Chưa nhận được tiền (Pending).");
      return;
    }

    await paymentRequestApi.reject(paymentRequestId);
    setCredits((prev) =>
      prev.map((c) => (c.id === paymentRequestId ? { ...c, status: "PENDING" } : c))
    );
    showToast("Đã từ chối nhận tiền.");
  };

  // Save Payment Info
  const handleSavePaymentInfo = async (infoData) => {
    if (isDemo) {
      setPaymentInfo(infoData);
      showToast("Đã cập nhật số tài khoản nhận tiền!");
      return;
    }

    const res = await paymentInfoApi.saveMyInfo(infoData);
    setPaymentInfo(res);
    showToast("Đã lưu thông tin tài khoản ngân hàng!");
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
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
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Hero Balance Card */}
        <HeroBalance
          user={user}
          totalOwedToYou={totalOwedToYou}
          totalYouOwe={totalYouOwe}
          onOpenCreateTransaction={() => setIsTxModalOpen(true)}
          onOpenCreateGroup={() => setIsGroupModalOpen(true)}
          onOpenPaymentInfo={() => setIsPaymentInfoModalOpen(true)}
        />

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Column (8 of 12) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Groups */}
            <GroupList
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelectGroup={(id) => setSelectedGroupId(id)}
              onOpenCreateGroup={() => setIsGroupModalOpen(true)}
            />

            {/* Transactions */}
            <RecentTransactions
              transactions={filteredTransactions}
              currentUserId={user?.id}
              page={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              dateFilter={dateFilter}
              onDateFilterChange={(filter) => setDateFilter(filter)}
            />
          </div>

          {/* Sidebar Column (4 of 12) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Payment Requests & Approvals */}
            <PaymentRequestsSection
              debts={debts}
              credits={credits}
              onOpenQrModal={handleOpenQrModal}
              onApproveCredit={handleApproveCredit}
              onRejectCredit={handleRejectCredit}
            />

            {/* Bank & VietQR Card */}
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
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
