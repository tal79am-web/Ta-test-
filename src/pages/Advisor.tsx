import { TrendingUp, Users, Calendar, MessageSquare, Star } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const advisors = [
  {
    id: "a1",
    name: "Dr. Rachel Hoffman",
    title: "Senior Portfolio Strategist",
    avatar: "RH",
    specialties: ["PE", "Venture", "Real Estate"],
    clients: 24,
    rating: 4.9,
    experience: "15 years",
    available: true,
    bio: "Former Goldman Sachs MD with $2B+ in deal experience across private equity and venture.",
  },
  {
    id: "a2",
    name: "James Nakamura",
    title: "Impact Investing Specialist",
    avatar: "JN",
    specialties: ["ESG", "Clean Energy", "Healthcare"],
    clients: 18,
    rating: 4.8,
    experience: "12 years",
    available: true,
    bio: "Formerly at TPG Rise and Breakthrough Energy Ventures. Focuses on impact-first portfolios.",
  },
  {
    id: "a3",
    name: "Amara Osei",
    title: "Growth Equity Advisor",
    avatar: "AO",
    specialties: ["SaaS", "FinTech", "AI"],
    clients: 31,
    rating: 4.7,
    experience: "10 years",
    available: false,
    bio: "Previously at Sequoia Capital and a16z. Expert in Series A-C growth investments.",
  },
];

const sessions = [
  { advisor: "Dr. Rachel Hoffman", date: "2026-04-22", time: "2:00 PM EST", topic: "Portfolio Review" },
  { advisor: "James Nakamura", date: "2026-05-01", time: "11:00 AM EST", topic: "ESG Opportunities" },
];

function Advisor() {
  return (
    <Layout title="Advisor Network">
      <p className="text-muted-foreground mb-6">
        Work with experienced investment advisors to build and optimize your private investment strategy.
      </p>

      {/* Upcoming sessions */}
      {sessions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Upcoming Sessions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((s, i) => (
              <Card key={i} className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.topic}</p>
                      <p className="text-xs text-muted-foreground">with {s.advisor}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                        <Calendar className="w-3 h-3" />
                        <span>{s.date} · {s.time}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Reschedule</Button>
                      <Button size="sm">Join</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Advisor cards */}
      <h2 className="text-lg font-semibold mb-3">Find an Advisor</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {advisors.map((advisor) => (
          <Card key={advisor.id} className="flex flex-col hover:shadow-md transition-shadow">
            <CardContent className="pt-5 flex-1">
              <div className="flex items-start gap-3 mb-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {advisor.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{advisor.name}</p>
                    <Badge variant={advisor.available ? "success" : "secondary"} className="text-[10px] py-0">
                      {advisor.available ? "Available" : "Waitlist"}
                    </Badge>
                  </div>
                  <p className="text-xs text-primary">{advisor.title}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{advisor.bio}</p>

              <div className="flex flex-wrap gap-1 mb-3">
                {advisor.specialties.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>

              <Separator className="my-3" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Clients</p>
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <p className="text-sm font-semibold">{advisor.clients}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <p className="text-sm font-semibold">{advisor.rating}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Experience</p>
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <p className="text-sm font-semibold">{advisor.experience}</p>
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="p-4 pt-0 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <MessageSquare className="w-3 h-3 mr-1" />
                Message
              </Button>
              <Button size="sm" className="flex-1" disabled={!advisor.available}>
                <Calendar className="w-3 h-3 mr-1" />
                {advisor.available ? "Book" : "Waitlist"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  );
}

export default Advisor;
