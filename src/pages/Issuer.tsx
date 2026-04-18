import { useState } from "react";
import { Plus, BarChart3, Users, DollarSign, FileText } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate } from "@/lib/utils";

function Issuer() {
  const { deals } = useApp();
  const myDeals = deals.slice(0, 3);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Layout title="Issuer Portal">
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">Manage your fundraising campaigns and investor relations.</p>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          New Deal
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Create New Deal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Deal Name</Label>
                <Input placeholder="Series A Fundraise" className="mt-1" />
              </div>
              <div>
                <Label>Company Name</Label>
                <Input placeholder="Your Company" className="mt-1" />
              </div>
              <div>
                <Label>Target Raise ($)</Label>
                <Input type="number" placeholder="5000000" className="mt-1" />
              </div>
              <div>
                <Label>Min Investment ($)</Label>
                <Input type="number" placeholder="25000" className="mt-1" />
              </div>
              <div>
                <Label>Sector</Label>
                <Input placeholder="e.g. FinTech, HealthTech" className="mt-1" />
              </div>
              <div>
                <Label>Closing Date</Label>
                <Input type="date" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button>Create Draft</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Raised", value: formatCurrency(myDeals.reduce((s, d) => s + d.raised, 0)), icon: DollarSign },
          { label: "Active Deals", value: String(myDeals.filter((d) => d.status === "open").length), icon: BarChart3 },
          { label: "Total Investors", value: String(myDeals.reduce((s, d) => s + d.investors, 0)), icon: Users },
          { label: "Documents", value: "12", icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="deals">
        <TabsList>
          <TabsTrigger value="deals">My Deals</TabsTrigger>
          <TabsTrigger value="investors">Investors</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="mt-4 space-y-3">
          {myDeals.map((deal) => {
            const progress = Math.min((deal.raised / deal.targetRaise) * 100, 100);
            return (
              <Card key={deal.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{deal.name}</p>
                      <p className="text-xs text-muted-foreground">{deal.company} · Closes {formatDate(deal.deadline)}</p>
                    </div>
                    <div className="w-40">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{formatCurrency(deal.raised, true)}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{deal.investors} investors</p>
                    </div>
                    <Badge variant={deal.status === "open" ? "success" : "secondary"} className="capitalize">
                      {deal.status}
                    </Badge>
                    <Button variant="outline" size="sm">Manage</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="investors" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {[
                  { name: "Alex Morgan", deal: "Series B Growth Round", amount: 25_000, date: "2026-03-10", status: "confirmed" },
                  { name: "Jordan Kim", deal: "Series B Growth Round", amount: 50_000, date: "2026-03-08", status: "confirmed" },
                  { name: "Taylor Brooks", deal: "Pre-IPO Round", amount: 100_000, date: "2026-03-05", status: "pending" },
                ].map((inv) => (
                  <div key={inv.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{inv.name}</p>
                      <p className="text-xs text-muted-foreground">{inv.deal}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(inv.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                    <Badge variant={inv.status === "confirmed" ? "success" : "warning"} className="capitalize">
                      {inv.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {["Term Sheet", "Investment Memorandum", "Cap Table", "Financial Model", "Pitch Deck"].map((doc) => (
                <div key={doc} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{doc}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button variant="outline" size="sm">Share</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}

export default Issuer;
