import { Link } from "wouter";
import { Lock, Users, TrendingUp } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clubs } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

function Clubs() {
  return (
    <Layout title="Investment Clubs">
      <p className="text-muted-foreground mb-6">
        Join co-investment clubs to collaborate with like-minded investors and access exclusive deal flow.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clubs.map((club) => (
          <Card key={club.id} className="flex flex-col hover:shadow-md transition-shadow">
            <CardContent className="pt-5 flex-1">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {club.avatar}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{club.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      {club.isPrivate ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Private
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Open</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{club.description}</p>

              <div className="flex flex-wrap gap-1 mb-4">
                {club.focus.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Members</p>
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {club.members}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Returns</p>
                  <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{club.returns}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Min Investment</p>
                  <p className="text-sm font-semibold">{formatCurrency(club.minInvestment)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Deployed</p>
                  <p className="text-sm font-semibold">{formatCurrency(club.totalDeployed, true)}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/clubs/${club.id}`} className="w-full">
                <Button className="w-full" variant={club.isPrivate ? "outline" : "default"}>
                  {club.isPrivate ? "Request Access" : "Join Club"}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </Layout>
  );
}

export default Clubs;
