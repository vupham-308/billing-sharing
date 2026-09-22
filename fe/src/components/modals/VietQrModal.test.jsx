// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import VietQrModal from "./VietQrModal";

afterEach(cleanup);

const paymentQr = {
  id: "request-1",
  paymentRequestId: "request-1",
  mode: "PAYMENT_REQUEST",
  status: "PENDING",
  qrUrl: "https://example.test/qr.png",
  bankCode: "TPB",
  accountNumber: "123456",
  accountHolderName: "NGUYEN VAN A",
  amount: 100000,
  description: "SHARE12345 NGUYEN VAN A chuyen tien",
  transactionTitle: "Tien an trua",
  groupName: "Nhom A",
  creditorName: "NGUYEN VAN A",
};

test("personal QR does not show payment confirmation action", () => {
  render(
    <VietQrModal
      isOpen
      onClose={vi.fn()}
      onConfirmPaid={vi.fn()}
      qrData={{ ...paymentQr, id: "personal-qr", paymentRequestId: undefined, mode: "PERSONAL", amount: 0 }}
    />
  );

  expect(screen.getByText("Mã QR nhận tiền cá nhân")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /tôi đã chuyển khoản xong/i })).toBeNull();
  expect(screen.getByText("Nhập trên app ngân hàng")).toBeTruthy();
});

test("keeps payment modal open when confirmation fails", async () => {
  const onClose = vi.fn();
  const onConfirmPaid = vi.fn().mockRejectedValue(new Error("failed"));

  render(<VietQrModal isOpen onClose={onClose} onConfirmPaid={onConfirmPaid} qrData={paymentQr} />);

  fireEvent.click(screen.getByRole("button", { name: /tôi đã chuyển khoản xong/i }));

  await waitFor(() => expect(onConfirmPaid).toHaveBeenCalledWith("request-1"));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /tôi đã chuyển khoản xong/i })).toBeTruthy();
});

test("hides confirmation action for a completed payment", () => {
  render(<VietQrModal isOpen onClose={vi.fn()} qrData={{ ...paymentQr, status: "COMPLETED" }} />);

  expect(screen.getByText(/khoản thanh toán này đã được hoàn tất/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /tôi đã chuyển khoản xong/i })).toBeNull();
});
