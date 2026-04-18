import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Users,
  Clock,
  TrendingUp,
  FileText,
  Shield,
  CheckCircle,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

const statusConfig = {
  open: { label: "Open for Investment", variant: "success" as const },
  closing: { label: "Closing Soon", variant: "warning" as const },
  closed: { label: "Closed", variant: "secondary" as const },
  funded: { label: "Fully Funded", variant: "secondary" as const },
};

function DealRoom() {
  const params = useParams<{ id: string }>();
  const { deals, toggleWatchlist, isWatched } = useApp();
  const deal = deals.find((d) => d.id === params.id);

  if (!deal) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-xl font-semibold mb-2">Deal not found</p>
          <Link href="/marketplace">
            <Button variant="outline">Back to Marketplace</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const watched = isWatched(deal.id);
  const progress = Math.min((deal.raised / deal.targetRaise) * 100, 100);
  const status = statusConfig[deal.status];

  const highlights = [
    "Experienced management team with 3+ successful exits",
    "Proprietary technology with 12 active patents",
    "Strong revenue growth of 180% YoY",
    "Signed LOI with Fortune 500 strategic partner",
    "TAM of $42B with 8% annual growth rate",
  ];

  const documents = [
    { name: "Investment Memorandum", type: "PDF", size: "2.4 MB" },
    { name: "Financial Projections", type: "XLSX", size: "1.1 MB" },
    { name: "Pitch Deck", type: "PDF", size: "8.7 MB" },
    { name: "Due Diligence Report", type: "PDF", size: "4.2 MB" },
  ];

  return (
    <Layout>
      {/* Back nav */}
      <div className="mb-6">
        <Link href="/marketplace">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Marketplace
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {deal.logo}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">{deal.company}</h1>
                    <p className="text-muted-foreground">{deal.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge>{deal.sector}</Badge>
                      <Badge variant="outline">{deal.stage}</Badge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleWatchlist(deal.id)}
                  title={watched ? "Remove from watchlist" : "Add to watchlist"}
                >
                  {watched ? (
                    <BookmarkCheck className="w-4 h-4 text-primary" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{deal.description}</p>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="highlights">Highlights</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { label: "Target IRR", value: `+${deal.irr}%`, color: "text-green-600" },
                      { label: "Target Multiple", value: `${deal.multiple}x` },
                      { label: "Target Raise", value: formatCurrency(deal.targetRaise) },
                      { label: "Amount Raised", value: formatCurrency(deal.raised) },
                      { label: "Min Investment", value: formatCurrency(deal.minInvestment) },
                      { label: "Closing Date", value: formatDate(deal.deadline) },
                      { label: "Total Investors", value: deal.investors.toString() },
                      { label: "Remaining", value: formatCurrency(deal.targetRaise - deal.raised) },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-sm font-semibold ${color ?? ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="highlights" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <ul className="space-y-3">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.name} className="flex items-center justify-between p-3 border border-border rounded-md">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.type} · {doc.size}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Download</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {[
                      { name: "Sarah Chen", role: "CEO & Co-Founder", bio: "Former VP at Google, Stanford MBA." },
                      { name: "Marcus Rivera", role: "CTO & Co-Founder", bio: "Ex-Stripe engineer, MIT CS grad." },
                      { name: "Priya Nair", role: "CFO", bio: "10 years in PE/VC at KKR and Andreessen." },
                    ].map((member) => (
                      <div key={member.name} className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{member.name}</p>
                          <p className="text-xs text-primary">{member.role}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{member.bio}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Funding progress */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Funding Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{formatCurrency(deal.raised)}</span>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  of {formatCurrency(deal.targetRaise)} target
                </p>
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{deal.investors} investors</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{formatDate(deal.deadline)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invest */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Accredited Investors Only</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Minimum investment: <span className="font-semibold">{formatCurrency(deal.minInvestment)}</span>
              </p>
              {deal.status === "open" || deal.status === "closing" ? (
                <Button className="w-full">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Invest Now
                </Button>
              ) : (
                <Button className="w-full" disabled>
                  {deal.status === "funded" ? "Fully Funded" : "Closed"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center mt-3">
                No fees until returns are distributed
              </p>
            </CardContent>
          </Card>

          {/* IRR */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Target IRR</p>
                  <p className="text-2xl font-bold text-green-600">{formatPercent(deal.irr)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target Multiple</p>
                  <p className="text-2xl font-bold">{deal.multiple}x</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default DealRoom;
