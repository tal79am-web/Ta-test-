import { Link } from "wouter";
import { Bookmark, BookmarkCheck, TrendingUp, Users, Clock } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Deal } from "@/lib/data";

const statusConfig = {
  open: { label: "Open", variant: "success" as const },
  closing: { label: "Closing Soon", variant: "warning" as const },
  closed: { label: "Closed", variant: "secondary" as const },
  funded: { label: "Funded", variant: "secondary" as const },
};

interface DealCardProps {
  deal: Deal;
}

export function DealCard({ deal }: DealCardProps) {
  const { toggleWatchlist, isWatched } = useApp();
  const watched = isWatched(deal.id);
  const progress = (deal.raised / deal.targetRaise) * 100;
  const status = statusConfig[deal.status];

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardContent className="pt-5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
              {deal.logo}
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">{deal.company}</h3>
              <p className="text-xs text-muted-foreground">{deal.sector}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>

        <p className="text-sm font-medium mb-1">{deal.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{deal.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Target IRR</p>
            <p className="text-sm font-semibold text-green-600">+{deal.irr}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Multiple</p>
            <p className="text-sm font-semibold">{deal.multiple}x</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Min Investment</p>
            <p className="text-sm font-semibold">{formatCurrency(deal.minInvestment)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stage</p>
            <p className="text-sm font-semibold">{deal.stage}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-1">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{formatCurrency(deal.raised, true)} raised</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1">
            of {formatCurrency(deal.targetRaise, true)} target
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 pt-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {deal.investors}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(deal.deadline)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => toggleWatchlist(deal.id)}
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            {watched ? (
              <BookmarkCheck className="w-4 h-4 text-primary" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </Button>
          <Link href={`/deal/${deal.id}`}>
            <Button size="sm" className="h-8">
              <TrendingUp className="w-3 h-3 mr-1" />
              View Deal
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
