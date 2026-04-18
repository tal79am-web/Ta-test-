import { useState } from "react";
import { useLocation } from "wouter";
import { CircleDollarSign, Eye, EyeOff, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useApp } from "@/contexts/AppContext";

const demoAccounts = [
  { label: "Investor", email: "investor@demo.com", role: "investor" },
  { label: "Admin", email: "admin@demo.com", role: "admin" },
  { label: "Issuer", email: "issuer@demo.com", role: "issuer" },
  { label: "Advisor", email: "advisor@demo.com", role: "advisor" },
];

function Login() {
  const { login } = useApp();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = login(email, password);
      if (result.ok) {
        navigate("/");
      } else {
        setError(result.error ?? "Login failed.");
      }
      setLoading(false);
    }, 600);
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("demo1234");
    setError("");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CircleDollarSign className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">InvestPro</h1>
          <p className="text-muted-foreground mt-1">Private Investment Platform</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <h2 className="text-xl font-semibold text-center">Sign in to your account</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {}}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <Separator className="my-5" />

            {/* Demo accounts */}
            <div>
              <p className="text-xs text-muted-foreground text-center mb-3">
                Try a demo account — password is <span className="font-mono font-semibold">demo1234</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account.email)}
                    className="flex items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-accent hover:border-primary/30 transition-colors text-left group"
                  >
                    <div>
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">
                        {account.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{account.email}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {account.role}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-5">
              Don't have an account?{" "}
              <button className="text-primary hover:underline font-medium">
                Sign up
              </button>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          For accredited investors only · SEC Rule 506(c)
        </p>
      </div>
    </div>
  );
}

export default Login;
