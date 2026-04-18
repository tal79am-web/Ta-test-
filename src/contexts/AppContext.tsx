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
  user: User;
  deals: Deal[];
  portfolio: PortfolioHolding[];
  watchlist: string[];
  toggleWatchlist: (dealId: string) => void;
  isWatched: (dealId: string) => boolean;
  notifications: number;
  clearNotifications: () => void;
}

const defaultUser: User = {
  id: "user-1",
  name: "Alex Morgan",
  email: "alex.morgan@example.com",
  avatar: "AM",
  role: "investor",
  accredited: true,
  kycStatus: "verified",
  totalInvested: 300_000,
  walletBalance: 75_000,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<string[]>(["deal-1", "deal-3"]);
  const [notifications, setNotifications] = useState(4);

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
        user: defaultUser,
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
