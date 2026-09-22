// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

afterEach(cleanup);

const mocks = vi.hoisted(() => ({
  user: null,
  isLoading: false,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    isLoading: mocks.isLoading,
  }),
}));

test("shows loading spinner when checking auth", () => {
  mocks.isLoading = true;
  mocks.user = null;

  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Secret Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("Đang kiểm tra phiên đăng nhập...")).toBeTruthy();
  expect(screen.queryByText("Secret Content")).toBeNull();
});

test("redirects unauthenticated user to /billing-sharing (login)", () => {
  mocks.isLoading = false;
  mocks.user = null;

  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Secret Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/billing-sharing" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("Login Page")).toBeTruthy();
  expect(screen.queryByText("Secret Content")).toBeNull();
});

test("renders children when user is authenticated", () => {
  mocks.isLoading = false;
  mocks.user = { id: "u1", role: "USER" };

  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Secret Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/billing-sharing" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("Secret Content")).toBeTruthy();
  expect(screen.queryByText("Login Page")).toBeNull();
});

test("redirects non-admin user when requireAdmin is true", () => {
  mocks.isLoading = false;
  mocks.user = { id: "u1", role: "USER" };

  render(
    <MemoryRouter initialEntries={["/admin-only"]}>
      <Routes>
        <Route
          path="/admin-only"
          element={
            <ProtectedRoute requireAdmin={true}>
              <div>Admin Only Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/billing-sharing" element={<div>Redirected Home</div>} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("Redirected Home")).toBeTruthy();
  expect(screen.queryByText("Admin Only Content")).toBeNull();
});
