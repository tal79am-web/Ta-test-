import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "Which deals have the highest projected IRR?",
  "Analyze my portfolio diversification",
  "Explain the risks in the TechVision AI deal",
  "How should I allocate my $75K balance?",
  "What's the difference between IRR and multiple?",
];

const mockResponses: Record<string, string> = {
  default: "I can help you analyze deals, review your portfolio, explain investment concepts, and identify opportunities. What would you like to know?",
  irr: "Based on current listings, **HealthSync** leads with a targeted 35% IRR, followed by **FinEdge** at 31% and **TechVision AI** at 28%. Keep in mind these are projections — early-stage deals carry higher risk alongside the higher target returns.",
  portfolio: "Your portfolio is concentrated in tech (60%) with early-stage exposure. You have $75K in dry powder. Consider diversifying into Real Estate (Urban Capital Partners Fund II) or Clean Energy to balance risk. Your current blended IRR across active positions is approximately 18.7%.",
  allocate: "With $75K available, here's a suggested allocation:\n\n• **$25K** — HealthSync (Seed, high upside)\n• **$25K** — TechVision AI (Series B, strong team)\n• **$25K** — Reserve for next closing deal\n\nThis maintains portfolio diversity while targeting 30%+ blended IRR.",
  risk: "TechVision AI's key risks include: (1) Semiconductor competition from Nvidia and Intel, (2) Hardware commoditization risk, (3) Series B valuation may be stretched at 18x ARR. Mitigants: $8M in bookings, 4 signed enterprise contracts, and 3 pending chip design partnerships.",
  concept: "**IRR** (Internal Rate of Return) is the annualized return rate. **Multiple** is the total money returned vs. invested (e.g., 3x = tripled your money). A high IRR with a low multiple means quick returns; a high multiple with lower IRR means longer hold but more total profit. Both matter — the right balance depends on your time horizon.",
};

function getResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("irr") && lower.includes("highest")) return mockResponses.irr;
  if (lower.includes("portfolio") || lower.includes("diversif")) return mockResponses.portfolio;
  if (lower.includes("allocat") || lower.includes("75k") || lower.includes("balance")) return mockResponses.allocate;
  if (lower.includes("risk") || lower.includes("techvision")) return mockResponses.risk;
  if (lower.includes("difference") || lower.includes("multiple") || lower.includes("explain")) return mockResponses.concept;
  return mockResponses.default;
}

function Copilot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI Investment Copilot. I can help you analyze deals, optimize your portfolio, explain financial concepts, and identify opportunities. What would you like to explore?",
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(text?: string) {
    const message = text ?? input.trim();
    if (!message) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getResponse(message),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 800);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <Layout title="AI Copilot">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Powered by AI</p>
            <p className="text-xs text-muted-foreground">Investment analysis & portfolio insights</p>
          </div>
        </div>

        {/* Chat window */}
        <Card className="mb-4">
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex items-start gap-3", msg.role === "user" && "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                        msg.role === "assistant" ? "bg-primary" : "bg-muted"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                        msg.role === "assistant"
                          ? "bg-muted text-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent hover:text-foreground transition-colors text-muted-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask about deals, portfolio, strategies..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1"
          />
          <Button onClick={() => send()} disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Layout>
  );
}

export default Copilot;
