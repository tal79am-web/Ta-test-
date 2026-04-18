import { Shield, Users, BarChart3, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate } from "@/lib/utils";

const pendingKYC = [
  { name: "Marcus Reed", email: "marcus.reed@email.com", submitted: "2026-04-15", type: "Passport" },
  { name: "Priya Nair", email: "priya.nair@email.com", submitted: "2026-04-14", type: "Driver's License" },
  { name: "Jordan Kim", email: "jordan.kim@email.com", submitted: "2026-04-13", type: "Passport" },
];

const pendingDeals = [
  { name: "BioSynth Series A", company: "BioSynth Inc", submitted: "2026-04-12", raise: 8_000_000 },
  { name: "RoboTech Growth", company: "RoboTech Labs", submitted: "2026-04-10", raise: 20_000_000 },
];

function Admin() {
  const { deals, portfolio } = useApp();
  const totalAUM = portfolio.reduce((s, h) => s + h.currentValue, 0);

  return (
    <Layout title="Admin Dashboard">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5 text-primary" />
        <Badge variant="default">Admin Access</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total AUM", value: formatCurrency(totalAUM, true), icon: BarChart3 },
          { label: "Active Deals", value: String(deals.filter((d) => d.status === "open").length), icon: BarChart3 },
          { label: "Pending KYC", value: String(pendingKYC.length), icon: Users },
          { label: "Alerts", value: "2", icon: AlertTriangle },
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

      <Tabs defaultValue="kyc">
        <TabsList>
          <TabsTrigger value="kyc">KYC Review</TabsTrigger>
          <TabsTrigger value="deals">Deal Approval</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc" className="mt-4 space-y-3">
          {pendingKYC.map((u) => (
            <Card key={u.email}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email} · {u.type} · Submitted {formatDate(u.submitted)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500 border-red-500 hover:bg-red-50">
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="deals" className="mt-4 space-y-3">
          {pendingDeals.map((d) => (
            <Card key={d.name}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.company} · Target: {formatCurrency(d.raise, true)} · Submitted {formatDate(d.submitted)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Review</Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">User Management</CardTitle>
                <Input placeholder="Search users..." className="w-60 h-8 text-sm" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: "Alex Morgan", role: "investor", kyc: "verified", joined: "2026-01-15" },
                  { name: "Sarah Chen", role: "issuer", kyc: "verified", joined: "2025-11-20" },
                  { name: "Marcus Reed", role: "investor", kyc: "pending", joined: "2026-04-10" },
                  { name: "Jordan Kim", role: "advisor", kyc: "verified", joined: "2025-09-05" },
                ].map((user) => (
                  <div key={user.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user.role} · Joined {formatDate(user.joined)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.kyc === "verified" ? "success" : "warning"} className="capitalize">
                        {user.kyc}
                      </Badge>
                      <Button variant="ghost" size="sm">Manage</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {[
                { type: "Suspicious Activity", description: "Large wire transfer pattern flagged", severity: "high", date: "2026-04-17" },
                { type: "AML Alert", description: "Multiple failed KYC submissions", severity: "medium", date: "2026-04-16" },
              ].map((flag, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-border rounded-md">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${flag.severity === "high" ? "text-red-500" : "text-amber-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{flag.type}</p>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(flag.date)}</p>
                  </div>
                  <Badge variant={flag.severity === "high" ? "destructive" : "warning"} className="capitalize">
                    {flag.severity}
                  </Badge>
                  <Button size="sm" variant="outline">Investigate</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}

export default Admin;
