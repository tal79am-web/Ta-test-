import { Link } from "wouter";
import { TrendingUp, Users, Clock } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant = {
  open: "success" as const,
  closing: "warning" as const,
  closed: "secondary" as const,
  funded: "secondary" as const,
};

function Deals() {
  const { deals } = useApp();

  return (
    <Layout title="All Deals">
      <div className="space-y-3">
        {deals.map((deal) => {
          const progress = Math.min((deal.raised / deal.targetRaise) * 100, 100);
          return (
            <Card key={deal.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Logo + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {deal.logo}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{deal.company}</p>
                        <Badge variant={statusVariant[deal.status]} className="capitalize">
                          {deal.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{deal.name} · {deal.sector}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-sm sm:w-72">
                    <div>
                      <p className="text-xs text-muted-foreground">IRR</p>
                      <p className="font-semibold text-green-600">+{deal.irr}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Multiple</p>
                      <p className="font-semibold">{deal.multiple}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Min</p>
                      <p className="font-semibold">{formatCurrency(deal.minInvestment, true)}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="sm:w-36">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{Math.round(progress)}% funded</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>

                  {/* Meta + action */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{deal.investors}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(deal.deadline)}</span>
                    </div>
                    <Link href={`/deal/${deal.id}`}>
                      <Button size="sm">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}

export default Deals;
