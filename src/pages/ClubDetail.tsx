import { useParams, Link } from "wouter";
import { ArrowLeft, Users, TrendingUp, Lock } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { clubs } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

function ClubDetail() {
  const params = useParams<{ id: string }>();
  const club = clubs.find((c) => c.id === params.id);

  if (!club) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-xl font-semibold mb-2">Club not found</p>
          <Link href="/clubs">
            <Button variant="outline">Back to Clubs</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const members = [
    { name: "Jordan Kim", role: "Lead", joined: "2023-01" },
    { name: "Taylor Brooks", role: "Member", joined: "2023-03" },
    { name: "Morgan Davis", role: "Member", joined: "2023-05" },
    { name: "Riley Chen", role: "Member", joined: "2023-08" },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/clubs">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Clubs
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {club.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{club.name}</h1>
                    {club.isPrivate && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Private
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{club.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {club.focus.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{club.members}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">+{club.returns}%</p>
                  <p className="text-xs text-muted-foreground">Avg Returns</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{formatCurrency(club.totalDeployed, true)}</p>
                  <p className="text-xs text-muted-foreground">Deployed</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{formatCurrency(club.minInvestment, true)}</p>
                  <p className="text-xs text-muted-foreground">Min Investment</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {m.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <p className="text-sm font-medium">{m.name}</p>
                    </div>
                    <Badge variant={m.role === "Lead" ? "default" : "secondary"}>{m.role}</Badge>
                  </div>
                ))}
                <Separator />
                <p className="text-xs text-muted-foreground text-center">
                  + {club.members - members.length} more members
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={club.isPrivate ? "" : "border-primary/30 bg-primary/5"}>
            <CardContent className="pt-6">
              {club.isPrivate ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Private Club</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    This club requires approval from existing members. Your request will be reviewed within 48 hours.
                  </p>
                  <Button className="w-full">Request Access</Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium">Open Membership</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Min commitment: <span className="font-semibold">{formatCurrency(club.minInvestment)}</span>
                  </p>
                  <Button className="w-full">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Join Club
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default ClubDetail;
