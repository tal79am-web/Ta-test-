import { useState } from "react";
import { CheckCircle, ChevronRight, User, Shield, FileText, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, title: "Personal Info", icon: User, description: "Tell us about yourself" },
  { id: 2, title: "Accreditation", icon: Shield, description: "Verify investor status" },
  { id: 3, title: "KYC/AML", icon: FileText, description: "Identity verification" },
  { id: 4, title: "Funding", icon: CreditCard, description: "Link your account" },
];

function Onboarding() {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);

  function nextStep() {
    if (!completed.includes(step)) setCompleted((p) => [...p, step]);
    if (step < steps.length) setStep(step + 1);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-xl">IP</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to InvestPro</h1>
          <p className="text-muted-foreground">Complete your profile to start investing</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => completed.includes(s.id) && setStep(s.id)}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  completed.includes(s.id)
                    ? "bg-green-500 text-white cursor-pointer"
                    : s.id === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {completed.includes(s.id) ? <CheckCircle className="w-4 h-4" /> : s.id}
              </button>
              {i < steps.length - 1 && (
                <div className={cn("w-12 h-0.5 mx-1", completed.includes(s.id) ? "bg-green-500" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {(() => { const Icon = steps[step - 1].icon; return <Icon className="w-5 h-5 text-primary" />; })()}
              <div>
                <CardTitle>{steps[step - 1].title}</CardTitle>
                <p className="text-sm text-muted-foreground">{steps[step - 1].description}</p>
              </div>
              <Badge variant="secondary" className="ml-auto">Step {step} of {steps.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="Alex" defaultValue="Alex" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Morgan" defaultValue="Morgan" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="alex@example.com" defaultValue="alex.morgan@example.com" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="country">Country of Residence</Label>
                  <Input id="country" placeholder="United States" defaultValue="United States" className="mt-1" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To invest on InvestPro, you must qualify as an accredited investor under SEC Rule 501.
                </p>
                {[
                  "Annual income exceeding $200K (or $300K joint) in each of the past 2 years",
                  "Net worth over $1M, excluding primary residence",
                  "Licensed financial professional (Series 7, 65, or 82)",
                  "Entity with assets over $5M",
                ].map((criterion) => (
                  <label key={criterion} className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="accreditation" className="mt-1 accent-primary" />
                    <span className="text-sm">{criterion}</span>
                  </label>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a government-issued ID and a selfie to verify your identity.
                </p>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">Passport or Driver's License</p>
                  <p className="text-xs text-muted-foreground">Drag & drop or click to upload</p>
                  <Button variant="outline" size="sm" className="mt-3">Select File</Button>
                </div>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">Selfie Photo</p>
                  <p className="text-xs text-muted-foreground">Clear, well-lit photo of your face</p>
                  <Button variant="outline" size="sm" className="mt-3">Take Photo</Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Link a bank account or wire transfer details to fund investments.
                </p>
                <div>
                  <Label htmlFor="accountName">Account Holder Name</Label>
                  <Input id="accountName" placeholder="Alex Morgan" defaultValue="Alex Morgan" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="routing">Routing Number</Label>
                  <Input id="routing" placeholder="021000021" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="account">Account Number</Label>
                  <Input id="account" placeholder="••••••••1234" className="mt-1" />
                </div>

                {step === steps.length && completed.length === steps.length - 1 && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <p className="text-sm font-medium">All steps completed! Your account is ready.</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                Back
              </Button>
              <Button onClick={nextStep}>
                {step === steps.length ? "Finish Setup" : "Continue"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Onboarding;
