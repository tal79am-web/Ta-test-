import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate } from "@/lib/utils";

const history = [
  { id: "t1", type: "deposit", amount: 50_000, from: "Chase Bank ••1234", date: "2026-04-10", status: "completed" },
  { id: "t2", type: "investment", amount: -25_000, from: "TechVision AI — Series B", date: "2026-04-08", status: "completed" },
  { id: "t3", type: "deposit", amount: 25_000, from: "Wire Transfer", date: "2026-03-20", status: "completed" },
  { id: "t4", type: "distribution", amount: 4_200, from: "CloudOps Pro — Exit", date: "2026-03-15", status: "completed" },
  { id: "t5", type: "investment", amount: -100_000, from: "GreenEnergy Corp — Pre-IPO", date: "2026-02-14", status: "pending" },
];

function Transfers() {
  const { user: _user } = useApp();
  const user = _user!;
  const [amount, setAmount] = useState("");

  return (
    <Layout title="Transfers">
      {/* Balance */}
      <Card className="mb-6 bg-primary text-primary-foreground border-0">
        <CardContent className="pt-6">
          <p className="text-sm opacity-80 mb-1">Available Balance</p>
          <p className="text-4xl font-bold">{formatCurrency(user.walletBalance)}</p>
          <p className="text-sm opacity-70 mt-1">InvestPro Wallet</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Tabs defaultValue="deposit">
            <TabsList className="w-full">
              <TabsTrigger value="deposit" className="flex-1">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw" className="flex-1">Withdraw</TabsTrigger>
            </TabsList>

            <TabsContent value="deposit" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>Amount (USD)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Source Account</Label>
                    <Input defaultValue="Chase Bank ••1234" className="mt-1" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[10_000, 25_000, 50_000, 100_000].map((amt) => (
                      <Button
                        key={amt}
                        variant="outline"
                        size="sm"
                        onClick={() => setAmount(String(amt))}
                      >
                        {formatCurrency(amt, true)}
                      </Button>
                    ))}
                  </div>
                  <Button className="w-full">
                    <ArrowDownLeft className="w-4 h-4 mr-2" />
                    Deposit Funds
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Funds typically available within 1-2 business days
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>Amount (USD)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input type="number" placeholder="0.00" className="pl-7" />
                    </div>
                  </div>
                  <div>
                    <Label>Destination Account</Label>
                    <Input defaultValue="Chase Bank ••1234" className="mt-1" />
                  </div>
                  <Button className="w-full" variant="outline">
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Withdraw Funds
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Withdrawals process in 3-5 business days
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* History */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Transaction History</CardTitle>
                <Button variant="ghost" size="icon">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPositive ? "bg-green-100" : "bg-blue-100"}`}>
                          {isPositive ? (
                            <ArrowDownLeft className="w-4 h-4 text-green-600" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{tx.type}</p>
                          <p className="text-xs text-muted-foreground">{tx.from}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${isPositive ? "text-green-600" : ""}`}>
                          {isPositive ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                          <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                          <Badge variant={tx.status === "completed" ? "success" : "warning"} className="text-[10px] py-0">
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default Transfers;
