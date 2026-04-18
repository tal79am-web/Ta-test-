import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookMarked,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Home,
  LayoutGrid,
  MessageSquare,
  Settings,
  Shield,
  TrendingUp,
  Users,
  ArrowLeftRight,
  Bell,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/marketplace", label: "Marketplace", icon: LayoutGrid },
  { href: "/deals", label: "Deals", icon: ClipboardList },
  { href: "/portfolio", label: "Portfolio", icon: BarChart3 },
  { href: "/watchlist", label: "Watchlist", icon: BookMarked },
  { href: "/clubs", label: "Clubs", icon: Users },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/copilot", label: "AI Copilot", icon: MessageSquare },
  { href: "/advisor", label: "Advisor", icon: TrendingUp },
  { href: "/issuer", label: "Issuer", icon: Building2 },
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, notifications, clearNotifications, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-300 sticky top-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center px-4 h-16 border-b border-border", collapsed && "justify-center")}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <CircleDollarSign className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-foreground truncate">InvestPro</span>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors mb-0.5",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-2 space-y-1">
        {/* Notifications */}
        <button
          onClick={clearNotifications}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Notifications" : undefined}
        >
          <div className="relative">
            <Bell className="w-4 h-4" />
            {notifications > 0 && (
              <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                {notifications}
              </Badge>
            )}
          </div>
          {!collapsed && <span>Notifications</span>}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Toggle theme" : undefined}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
          {!collapsed && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign out</span>}
        </button>

        {/* User */}
        <div className={cn("flex items-center gap-3 px-2 py-2", collapsed && "justify-center")}>
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {user?.avatar}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
