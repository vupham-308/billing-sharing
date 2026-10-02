// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GroupStatementDetail from "./GroupStatementDetail";

const mocks = vi.hoisted(() => ({
  getGroup: vi.fn(),
  getGroups: vi.fn(),
  getGroupStatements: vi.fn(),
  getStatementDetail: vi.fn(),
  getQr: vi.fn(),
  user: { id: "u1", fullName: "An", role: "USER" },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { ...mocks.user }, isLoading: false, refreshUser: vi.fn() }),
}));

vi.mock("../services/api", () => ({
  groupApi: {
    getGroup: mocks.getGroup,
    getGroups: mocks.getGroups,
  },
  statementApi: {
    getGroupStatements: mocks.getGroupStatements,
    getStatementDetail: mocks.getStatementDetail,
  },
  paymentRequestApi: {
    getQr: mocks.getQr,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "u1", fullName: "An", role: "USER" };
});
afterEach(cleanup);

test("displays transactions with total, payer, user share and sums the amount user needs to transfer", async () => {
  const groupId = "g1";
  const periodId = "p1";

  mocks.getGroup.mockResolvedValue({ id: groupId, name: "Nhóm Du Lịch" });
  mocks.getGroups.mockResolvedValue([{ id: groupId, name: "Nhóm Du Lịch" }]);
  mocks.getGroupStatements.mockResolvedValue([
    {
      id: periodId,
      groupId,
      periodNumber: 1,
      startDate: "2026-08-01T00:00:00",
      endDate: "2026-08-31T23:59:59",
      processedAt: "2026-09-01T08:30:00",
      status: "PROCESSED",
    },
  ]);

  mocks.getStatementDetail.mockResolvedValue({
    id: periodId,
    groupId,
    periodNumber: 1,
    startDate: "2026-08-01T00:00:00",
    endDate: "2026-08-31T23:59:59",
    processedAt: "2026-09-01T08:30:00",
    status: "PROCESSED",
    transactions: [
      {
        id: "tx1",
        title: "Ăn trưa hải sản",
        totalAmount: 300000,
        payerId: "u2",
        payerName: "Bình",
        isUserPayer: false,
        currentUserShare: 100000,
        createdAt: "2026-08-15T12:00:00",
        shares: [
          { userId: "u1", userName: "An", shareAmount: 100000 },
          { userId: "u2", userName: "Bình", shareAmount: 200000 },
        ],
      },
      {
        id: "tx2",
        title: "Tiền taxi",
        totalAmount: 200000,
        payerId: "u2",
        payerName: "Bình",
        isUserPayer: false,
        currentUserShare: 50000,
        createdAt: "2026-08-16T14:00:00",
        shares: [
          { userId: "u1", userName: "An", shareAmount: 50000 },
          { userId: "u2", userName: "Bình", shareAmount: 150000 },
        ],
      },
    ],
    userSummary: {
      userGrossDebt: 150000,
      userGrossCredit: 0,
      totalToTransfer: 150000,
      totalToReceive: 0,
      paymentRequests: [
        {
          requestId: "pr1",
          creditorName: "Bình",
          amount: 150000,
          bankName: "MBBank",
          accountNumber: "99998888",
          accountHolderName: "NGUYEN VAN BINH",
          description: "BS PAY PR1",
        },
      ],
    },
    snapshot: {
      items: [
        {
          requestId: "pr1",
          transactionTitle: "Tất toán công nợ kỳ 1",
          debtorName: "An",
          creditorName: "Bình",
          amount: 150000,
          status: "PENDING",
        },
      ],
    },
  });

  render(
    <MemoryRouter initialEntries={[`/billing-sharing/groups/${groupId}/statements`]}>
      <Routes>
        <Route
          path="/billing-sharing/groups/:groupId/statements"
          element={<GroupStatementDetail />}
        />
      </Routes>
    </MemoryRouter>
  );

  // Group name
  expect((await screen.findAllByText("Nhóm Du Lịch")).length).toBeGreaterThan(0);

  // Transactions details table: title, total amount, payer, current user share
  expect(await screen.findByText("Ăn trưa hải sản")).toBeTruthy();
  expect(screen.getByText("Tiền taxi")).toBeTruthy();

  // Total amounts ("total nhiêu")
  expect(screen.getByText("300.000 ₫")).toBeTruthy();
  expect(screen.getByText("200.000 ₫")).toBeTruthy();

  // Payer ("ai trả")
  const payerEls = screen.getAllByText("Bình");
  expect(payerEls.length).toBeGreaterThan(0);

  // User share ("user cần trả bao nhiêu từ đó")
  expect(screen.getByText("100.000 ₫")).toBeTruthy();
  expect(screen.getByText("50.000 ₫")).toBeTruthy();

  // Reconciliation summary: Sums up to the exact amount user needs to transfer
  const transferAmounts = screen.getAllByText("150.000 ₫");
  expect(transferAmounts.length).toBeGreaterThanOrEqual(1);

  // Transfer card with creditor details and VietQR action
  expect(screen.getByText("NGUYEN VAN BINH")).toBeTruthy();
  expect(screen.getByText("99998888")).toBeTruthy();
  expect(screen.getByText("Quét mã VietQR chuyển tiền")).toBeTruthy();
});

test("displays creditor reconciliation correctly with total user paid, user share, and incoming transfers", async () => {
  const groupId = "g2";
  const periodId = "p2";

  mocks.getGroup.mockResolvedValue({ id: groupId, name: "Tài chính Markettin" });
  mocks.getGroups.mockResolvedValue([{ id: groupId, name: "Tài chính Markettin" }]);
  mocks.getGroupStatements.mockResolvedValue([
    {
      id: periodId,
      groupId,
      periodNumber: 1,
      startDate: "2026-09-01T00:00:00",
      endDate: "2026-09-22T23:59:59",
      processedAt: "2026-09-22T08:30:00",
      status: "PROCESSED",
    },
  ]);

  mocks.getStatementDetail.mockResolvedValue({
    id: periodId,
    groupId,
    periodNumber: 1,
    startDate: "2026-09-01T00:00:00",
    endDate: "2026-09-22T23:59:59",
    processedAt: "2026-09-22T08:30:00",
    status: "PROCESSED",
    transactions: [
      {
        id: "tx-test-1",
        title: "test 1",
        totalAmount: 600000,
        payerId: "u1",
        payerName: "An",
        isUserPayer: true,
        currentUserShare: 111111,
        createdAt: "2026-09-22T10:00:00",
        shares: [
          { userId: "u1", userName: "An", shareAmount: 111111 },
          { userId: "u2", userName: "Bình", shareAmount: 488889 },
        ],
      },
    ],
    userSummary: {
      userTotalShare: 111111,
      userTotalPaid: 600000,
      userPaidForOthers: 488889,
      userOwesOthers: 0,
      userGrossDebt: 111111,
      userGrossCredit: 488889,
      totalToTransfer: 0,
      totalToReceive: 488889,
      paymentRequestsToPay: [],
      paymentRequestsToReceive: [
        {
          debtorId: "u2",
          debtorName: "Bình",
          amount: 488889,
          status: "PENDING",
        },
      ],
    },
    snapshot: {
      items: [
        {
          requestId: "pr-c1",
          transactionTitle: "Tất toán công nợ kỳ 1",
          debtorName: "Bình",
          creditorName: "An",
          amount: 488889,
          status: "PENDING",
        },
      ],
    },
  });

  render(
    <MemoryRouter initialEntries={[`/billing-sharing/groups/${groupId}/statements`]}>
      <Routes>
        <Route
          path="/billing-sharing/groups/:groupId/statements"
          element={<GroupStatementDetail />}
        />
      </Routes>
    </MemoryRouter>
  );

  // Group name
  expect((await screen.findAllByText("Tài chính Markettin")).length).toBeGreaterThan(0);

  // Transaction title and total
  expect(await screen.findByText("test 1")).toBeTruthy();
  expect(screen.getAllByText("600.000 ₫").length).toBeGreaterThanOrEqual(1);

  // User share in table and footer
  expect(screen.getAllByText("111.111 ₫").length).toBeGreaterThanOrEqual(1);

  // Reconciliation breakdown for creditor
  expect(screen.getByText(/Chi tiết đối soát & quyền lợi nhận tiền của bạn/)).toBeTruthy();
  expect(screen.getByText(/Tổng tiền bạn đã chi trả cho cả nhóm/)).toBeTruthy();
  expect(screen.getByText(/Trừ phần tiền bạn tự tiêu/)).toBeTruthy();
  expect(screen.getByText("-111.111 ₫")).toBeTruthy();
  expect(screen.getAllByText("+488.889 ₫").length).toBeGreaterThanOrEqual(1);

  // Incoming payment from debtor Bình
  expect(screen.getByText("Chi tiết các khoản sẽ chuyển cho bạn (1 người)")).toBeTruthy();
  expect(screen.getAllByText("Bình").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("Chờ thanh toán").length).toBeGreaterThanOrEqual(1);
});

test("displays 'Đã thanh toán' badge when isPaid is true or status is COMPLETED/PAID", async () => {
  const groupId = "g3";
  const periodId = "p3";

  mocks.getGroup.mockResolvedValue({ id: groupId, name: "Tài chính Markettin" });
  mocks.getGroups.mockResolvedValue([{ id: groupId, name: "Tài chính Markettin" }]);
  mocks.getGroupStatements.mockResolvedValue([
    {
      id: periodId,
      groupId,
      periodNumber: 1,
      startDate: "2026-09-01T00:00:00",
      endDate: "2026-09-22T23:59:59",
      processedAt: "2026-09-22T08:30:00",
      status: "PROCESSED",
    },
  ]);

  mocks.getStatementDetail.mockResolvedValue({
    id: periodId,
    groupId,
    periodNumber: 1,
    startDate: "2026-09-01T00:00:00",
    endDate: "2026-09-22T23:59:59",
    processedAt: "2026-09-22T08:30:00",
    status: "PROCESSED",
    transactions: [
      {
        id: "tx-paid-1",
        title: "Nước giặt",
        totalAmount: 175000,
        payerId: "u2",
        payerName: "Minhh",
        isUserPayer: false,
        currentUserShare: 58334,
        currentUserIsPaid: true,
        createdAt: "2026-09-06T12:00:00",
        shares: [
          { userId: "u1", userName: "An", shareAmount: 58334, isPaid: true },
          { userId: "u2", userName: "Minhh", shareAmount: 58332, isPaid: true },
        ],
      },
    ],
    userSummary: {
      userTotalShare: 58334,
      userTotalPaid: 0,
      userPaidForOthers: 0,
      userOwesOthers: 58334,
      totalToTransfer: 0,
      totalToReceive: 100000,
      paymentRequestsToPay: [],
      paymentRequestsToReceive: [
        {
          requestId: "pr-rec-1",
          debtorName: "Duy Thành Nguyễn",
          amount: 100000,
          status: "COMPLETED",
          isPaid: true,
        },
      ],
    },
    snapshot: {
      items: [
        {
          requestId: "pr-rec-1",
          transactionTitle: "Kỳ sao kê 1/9 - 2/10",
          debtorName: "Duy Thành Nguyễn",
          creditorName: "An",
          amount: 100000,
          status: "COMPLETED",
          isPaid: true,
        },
      ],
    },
  });

  render(
    <MemoryRouter initialEntries={[`/billing-sharing/groups/${groupId}/statements`]}>
      <Routes>
        <Route
          path="/billing-sharing/groups/:groupId/statements"
          element={<GroupStatementDetail />}
        />
      </Routes>
    </MemoryRouter>
  );

  // Checks that 'Đã thanh toán' badges are rendered
  const paidBadges = await screen.findAllByText("Đã thanh toán");
  expect(paidBadges.length).toBeGreaterThanOrEqual(2); // In incoming payments card & in transactions table

  // Check that the sharing member tag has 'Đã trả'
  expect(screen.getAllByText("Đã trả").length).toBeGreaterThanOrEqual(1);
});

test("renders correct netting notes in snapshot table: hides transferred debt note and displays offset credit note", async () => {
  const groupId = "g-netting";
  const periodId = "p-netting";

  mocks.getGroup.mockResolvedValue({ id: groupId, name: "Tài chính Markettin" });
  mocks.getGroups.mockResolvedValue([{ id: groupId, name: "Tài chính Markettin" }]);
  mocks.getGroupStatements.mockResolvedValue([
    {
      id: periodId,
      groupId,
      periodNumber: 1,
      startDate: "2026-09-01T13:12:15",
      endDate: "2026-10-02T11:34:04",
      status: "PROCESSED",
    },
  ]);

  mocks.getStatementDetail.mockResolvedValue({
    id: periodId,
    groupId,
    periodNumber: 1,
    startDate: "2026-09-01T13:12:15",
    endDate: "2026-10-02T11:34:04",
    status: "PROCESSED",
    transactions: [],
    userSummary: {
      totalToTransfer: 0,
      totalToReceive: 0,
      paymentRequestsToPay: [],
      paymentRequestsToReceive: [],
    },
    snapshot: {
      items: [
        {
          requestId: "pr-thanh",
          transactionTitle: "Kỳ sao kê 1/9 - 2/10",
          debtorName: "Duy Thành Nguyễn",
          creditorName: "Kai",
          amount: 1844785,
          status: "PENDING",
          breakdown: {
            transferredDebtAmount: 95529,
            offsetCreditAmount: 0,
            transferredDebtorName: "Minhh",
            nettingDetailNote: "Nhận nợ thay Minhh trả Kai: +95.529đ",
          },
        },
        {
          requestId: "pr-minh",
          transactionTitle: "Kỳ sao kê 1/9 - 2/10",
          debtorName: "Minhh",
          creditorName: "Kai",
          amount: 1724868,
          status: "PENDING",
          breakdown: {
            transferredDebtAmount: 0,
            offsetCreditAmount: 95529,
            transferredDebtorName: "Duy Thành Nguyễn",
            nettingDetailNote: "Cấn trừ nợ Duy Thành Nguyễn: -95.529đ",
          },
        },
      ],
    },
  });

  render(
    <MemoryRouter initialEntries={[`/billing-sharing/groups/${groupId}/statements`]}>
      <Routes>
        <Route
          path="/billing-sharing/groups/:groupId/statements"
          element={<GroupStatementDetail />}
        />
      </Routes>
    </MemoryRouter>
  );

  // Row của Minh phải hiển thị ghi chú cấn trừ rõ ràng
  const minhNote = await screen.findByText(/Đã cấn trừ khoản nợ của Duy Thành Nguyễn: -95\.529/);
  expect(minhNote).toBeTruthy();

  // Row của Thành không được hiển thị chú thích nhận nợ thay
  expect(screen.queryByText(/Nhận nợ thay/)).toBeNull();
});


