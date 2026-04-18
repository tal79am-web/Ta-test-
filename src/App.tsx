import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider } from "./contexts/AppContext";
import { lazy, Suspense } from "react";

// Pages
import Home from "./pages/Home";
const Marketplace = lazy(() => import("./pages/Marketplace"));
const DealRoom = lazy(() => import("./pages/DealRoom"));
const Deals = lazy(() => import("./pages/Deals"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Clubs = lazy(() => import("./pages/Clubs"));
const ClubDetail = lazy(() => import("./pages/ClubDetail"));
const Issuer = lazy(() => import("./pages/Issuer"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Admin = lazy(() => import("./pages/Admin"));
const Copilot = lazy(() => import("./pages/Copilot"));
const Advisor = lazy(() => import("./pages/Advisor"));
const Settings = lazy(() => import("./pages/Settings"));
const Watchlist = lazy(() => import("./pages/Watchlist"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/deal/:id" component={DealRoom} />
        <Route path="/deals" component={Deals} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/clubs" component={Clubs} />
        <Route path="/clubs/:id" component={ClubDetail} />
        <Route path="/issuer" component={Issuer} />
        <Route path="/transfers" component={Transfers} />
        <Route path="/admin" component={Admin} />
        <Route path="/copilot" component={Copilot} />
        <Route path="/advisor" component={Advisor} />
        <Route path="/settings" component={Settings} />
        <Route path="/watchlist" component={Watchlist} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
