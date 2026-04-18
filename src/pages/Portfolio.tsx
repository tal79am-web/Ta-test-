import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

function Portfolio() {
  const { portfolio } = useApp();

  const totalInvested = portfolio.reduce((s, h) => s + h.invested, 0);
  const totalValue = portfolio.reduce((s, h) => s + h.currentValue, 0);
  const gain = totalValue - totalInvested;
  const gainPct = ((gain / totalInvested) * 100).toFixed(1);

  const statusVariant = {
    active: "success" as const,
    exited: "secondary" as const,
    pending: "warning" as const,
  };

  return (
    <Layout title="Portfolio">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Invested", value: formatCurrency(totalInvested) },
          { label: "Current Value", value: formatCurrency(totalValue) },
          { label: "Unrealized Gain", value: formatCurrency(gain), highlight: gain >= 0 },
          { label: "Total Return", value: `${gain >= 0 ? "+" : ""}${gainPct}%`, highlight: gain >= 0 },
        ].map(({ label, value, highlight }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold ${highlight !== undefined ? (highlight ? "text-green-600" : "text-red-500") : ""}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Holdings table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground text-xs">
                  <th className="pb-2 font-medium">Company</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Invested</th>
                  <th className="pb-2 font-medium">Current Value</th>
                  <th className="pb-2 font-medium">IRR</th>
                  <th className="pb-2 font-medium">Multiple</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3">
                      <p className="font-medium">{h.company}</p>
                      <p className="text-xs text-muted-foreground">{h.dealName}</p>
                    </td>
                    <td className="py-3 text-muted-foreground">{h.stage}</td>
                    <td className="py-3">{formatCurrency(h.invested)}</td>
                    <td className="py-3 font-medium">{formatCurrency(h.currentValue)}</td>
                    <td className={`py-3 font-semibold ${h.irr >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {formatPercent(h.irr)}
                    </td>
                    <td className="py-3">{h.multiple}x</td>
                    <td className="py-3 text-muted-foreground">{formatDate(h.date)}</td>
                    <td className="py-3">
                      <Badge variant={statusVariant[h.status]} className="capitalize">
                        {h.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}

export default Portfolio;
