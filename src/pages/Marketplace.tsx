import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { DealCard } from "@/components/DealCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import type { Deal } from "@/lib/data";

const sectors = ["All", "Artificial Intelligence", "Clean Energy", "HealthTech", "Logistics", "FinTech", "Real Estate"];
const stages = ["All", "Seed", "Series A", "Series B", "Bridge", "Pre-IPO", "Fund"];
const statuses = ["All", "open", "closing", "funded", "closed"];

function Marketplace() {
  const { deals } = useApp();
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");
  const [stage, setStage] = useState("All");
  const [status, setStatus] = useState("All");
  const [sortBy, setSortBy] = useState<"irr" | "raised" | "deadline">("irr");

  const filtered = deals
    .filter((d) => {
      const matchSearch =
        d.company.toLowerCase().includes(search.toLowerCase()) ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.sector.toLowerCase().includes(search.toLowerCase());
      const matchSector = sector === "All" || d.sector === sector;
      const matchStage = stage === "All" || d.stage === stage;
      const matchStatus = status === "All" || d.status === status;
      return matchSearch && matchSector && matchStage && matchStatus;
    })
    .sort((a: Deal, b: Deal) => {
      if (sortBy === "irr") return b.irr - a.irr;
      if (sortBy === "raised") return b.raised / b.targetRaise - a.raised / a.targetRaise;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  return (
    <Layout title="Marketplace">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search deals, companies, sectors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            {sectors.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="irr">Highest IRR</SelectItem>
            <SelectItem value="raised">% Funded</SelectItem>
            <SelectItem value="deadline">Closing Soon</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setSearch(""); setSector("All"); setStage("All"); setStatus("All"); }}
          title="Clear filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-muted-foreground">
          {filtered.length} deal{filtered.length !== 1 ? "s" : ""} found
        </p>
        {(sector !== "All" || stage !== "All" || status !== "All" || search) && (
          <div className="flex flex-wrap gap-1">
            {sector !== "All" && <Badge variant="secondary">{sector}</Badge>}
            {stage !== "All" && <Badge variant="secondary">{stage}</Badge>}
            {status !== "All" && <Badge variant="secondary" className="capitalize">{status}</Badge>}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No deals found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Marketplace;
