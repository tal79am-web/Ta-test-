import { Layout } from "@/components/Layout";
import { DealCard } from "@/components/DealCard";
import { useApp } from "@/contexts/AppContext";
import { BookMarked } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function Watchlist() {
  const { deals, watchlist } = useApp();
  const watched = deals.filter((d) => watchlist.includes(d.id));

  return (
    <Layout title="Watchlist">
      {watched.length === 0 ? (
        <div className="text-center py-20">
          <BookMarked className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No deals saved</h2>
          <p className="text-muted-foreground mb-6">
            Bookmark deals from the marketplace to track them here.
          </p>
          <Link href="/marketplace">
            <Button>Browse Marketplace</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {watched.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Watchlist;
