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
