import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider, useApp } from "./contexts/AppContext";
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

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useApp();
  return isAuthenticated ? <Component /> : <Redirect to="/login" />;
}

function Router() {
  const { isAuthenticated } = useApp();

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login">
          {isAuthenticated ? <Redirect to="/" /> : <Login />}
        </Route>
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/" component={() => <PrivateRoute component={Home} />} />
        <Route path="/marketplace" component={() => <PrivateRoute component={Marketplace} />} />
        <Route path="/deal/:id" component={() => <PrivateRoute component={DealRoom} />} />
        <Route path="/deals" component={() => <PrivateRoute component={Deals} />} />
        <Route path="/portfolio" component={() => <PrivateRoute component={Portfolio} />} />
        <Route path="/clubs" component={() => <PrivateRoute component={Clubs} />} />
        <Route path="/clubs/:id" component={() => <PrivateRoute component={ClubDetail} />} />
        <Route path="/issuer" component={() => <PrivateRoute component={Issuer} />} />
        <Route path="/transfers" component={() => <PrivateRoute component={Transfers} />} />
        <Route path="/admin" component={() => <PrivateRoute component={Admin} />} />
        <Route path="/copilot" component={() => <PrivateRoute component={Copilot} />} />
        <Route path="/advisor" component={() => <PrivateRoute component={Advisor} />} />
        <Route path="/settings" component={() => <PrivateRoute component={Settings} />} />
        <Route path="/watchlist" component={() => <PrivateRoute component={Watchlist} />} />
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
