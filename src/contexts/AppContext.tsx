import { createContext, useContext, useState } from "react";
import type { Deal, PortfolioHolding } from "@/lib/data";
import { deals as initialDeals, portfolio as initialPortfolio } from "@/lib/data";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "investor" | "issuer" | "admin" | "advisor";
  accredited: boolean;
  kycStatus: "pending" | "verified" | "rejected";
  totalInvested: number;
  walletBalance: number;
}

interface AppContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  deals: Deal[];
  portfolio: PortfolioHolding[];
  watchlist: string[];
  toggleWatchlist: (dealId: string) => void;
  isWatched: (dealId: string) => boolean;
  notifications: number;
  clearNotifications: () => void;
}

// Demo accounts
const DEMO_ACCOUNTS: Record<string, { password: string; user: User }> = {
  "investor@demo.com": {
    password: "demo1234",
    user: {
      id: "user-1",
      name: "Alex Morgan",
      email: "investor@demo.com",
      avatar: "AM",
      role: "investor",
      accredited: true,
      kycStatus: "verified",
      totalInvested: 300_000,
      walletBalance: 75_000,
    },
  },
  "admin@demo.com": {
    password: "demo1234",
    user: {
      id: "user-2",
      name: "Jordan Kim",
      email: "admin@demo.com",
      avatar: "JK",
      role: "admin",
      accredited: true,
      kycStatus: "verified",
      totalInvested: 0,
      walletBalance: 0,
    },
  },
  "issuer@demo.com": {
    password: "demo1234",
    user: {
      id: "user-3",
      name: "Sarah Chen",
      email: "issuer@demo.com",
      avatar: "SC",
      role: "issuer",
      accredited: true,
      kycStatus: "verified",
      totalInvested: 0,
      walletBalance: 0,
    },
  },
  "advisor@demo.com": {
    password: "demo1234",
    user: {
      id: "user-4",
      name: "Marcus Rivera",
      email: "advisor@demo.com",
      avatar: "MR",
      role: "advisor",
      accredited: true,
      kycStatus: "verified",
      totalInvested: 0,
      walletBalance: 0,
    },
  },
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(["deal-1", "deal-3"]);
  const [notifications, setNotifications] = useState(4);

  function login(email: string, password: string): { ok: boolean; error?: string } {
    const account = DEMO_ACCOUNTS[email.toLowerCase().trim()];
    if (!account) return { ok: false, error: "No account found with that email." };
    if (account.password !== password) return { ok: false, error: "Incorrect password." };
    setUser(account.user);
    return { ok: true };
  }

  function logout() {
    setUser(null);
  }

  function toggleWatchlist(dealId: string) {
    setWatchlist((prev) =>
      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId]
    );
  }

  function isWatched(dealId: string) {
    return watchlist.includes(dealId);
  }

  function clearNotifications() {
    setNotifications(0);
  }

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        logout,
        deals: initialDeals,
        portfolio: initialPortfolio,
        watchlist,
        toggleWatchlist,
        isWatched,
        notifications,
        clearNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
