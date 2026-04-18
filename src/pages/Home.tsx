import { Link } from "wouter";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { DealCard } from "@/components/DealCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatPercent } from "@/lib/utils";

function StatCard({
  title,
  value,
  delta,
  icon: Icon,
  positive,
}: {
  title: string;
  value: string;
  delta?: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {delta && (
          <p
            className={`text-xs mt-1 flex items-center gap-1 ${
              positive ? "text-green-600" : "text-red-500"
            }`}
          >
            {positive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {delta} from last month
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Home() {
  const { user, deals, portfolio } = useApp();
  const featuredDeals = deals.filter((d) => d.featured).slice(0, 2);
  const totalValue = portfolio.reduce((sum, h) => sum + h.currentValue, 0);
  const totalInvested = portfolio.reduce((sum, h) => sum + h.invested, 0);
  const unrealizedGain = totalValue - totalInvested;
  const activeHoldings = portfolio.filter((h) => h.status === "active").length;

  return (
    <Layout>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Good morning, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground">Here's an overview of your investment activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Portfolio Value"
          value={formatCurrency(totalValue)}
          delta="12.4%"
          icon={BarChart3}
          positive
        />
        <StatCard
          title="Unrealized Gain"
          value={formatCurrency(unrealizedGain)}
          delta="8.1%"
          icon={TrendingUp}
          positive={unrealizedGain >= 0}
        />
        <StatCard
          title="Wallet Balance"
          value={formatCurrency(user.walletBalance)}
          icon={DollarSign}
        />
        <StatCard
          title="Active Holdings"
          value={String(activeHoldings)}
          delta="1 new"
          icon={Clock}
          positive
        />
      </div>

      {/* Portfolio snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Portfolio Holdings</CardTitle>
                <Link href="/portfolio">
                  <Button variant="ghost" size="sm">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {portfolio.slice(0, 4).map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{h.company}</p>
                      <p className="text-xs text-muted-foreground">{h.dealName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(h.currentValue)}</p>
                      <p
                        className={`text-xs ${
                          h.irr >= 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {formatPercent(h.irr)} IRR
                      </p>
                    </div>
                    <Badge
                      variant={
                        h.status === "active"
                          ? "success"
                          : h.status === "exited"
                          ? "secondary"
                          : "warning"
                      }
                      className="ml-3"
                    >
                      {h.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/marketplace">
                <Button className="w-full justify-start" variant="outline">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Browse Marketplace
                </Button>
              </Link>
              <Link href="/transfers">
                <Button className="w-full justify-start" variant="outline">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Fund Wallet
                </Button>
              </Link>
              <Link href="/copilot">
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  AI Copilot
                </Button>
              </Link>
              <Link href="/clubs">
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Join a Club
                </Button>
              </Link>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">KYC Status</p>
                <Badge variant="success" className="capitalize">
                  {user.kycStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Featured deals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Featured Deals</h2>
          <Link href="/marketplace">
            <Button variant="ghost" size="sm">
              View all deals
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {featuredDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default Home;
