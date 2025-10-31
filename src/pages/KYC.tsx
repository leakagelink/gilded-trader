import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCheck, TrendingUp, Upload, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const KYC = () => {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("KYC documents submitted for verification!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TradePro
            </span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <FileCheck className="h-8 w-8" />
            KYC Verification
          </h1>
          <p className="text-muted-foreground">Complete your identity verification to unlock all features</p>
        </div>

        {/* Verification Steps */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { step: "1", title: "Personal Info", completed: true },
            { step: "2", title: "Upload Documents", completed: false },
            { step: "3", title: "Verification", completed: false },
          ].map((item, index) => (
            <Card key={index} className={`p-4 text-center ${item.completed ? 'bg-primary/10 border-primary' : ''}`}>
              <div className={`h-10 w-10 rounded-full mx-auto mb-2 flex items-center justify-center ${item.completed ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {item.completed ? <CheckCircle className="h-5 w-5" /> : item.step}
              </div>
              <div className="font-semibold">{item.title}</div>
            </Card>
          ))}
        </div>

        {/* KYC Form */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-6">Personal Information</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input id="first-name" type="text" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input id="last-name" type="text" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="in">India</SelectItem>
                  <SelectItem value="ca">Canada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" type="text" required />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" type="text" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal Code</Label>
                <Input id="postal" type="text" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id-type">ID Document Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="license">Driver's License</SelectItem>
                  <SelectItem value="id-card">National ID Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload Documents</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, JPG or PNG (max. 5MB)
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
            >
              Submit for Verification
            </Button>
          </form>
        </Card>

        <Card className="p-6 bg-muted/30">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Why KYC is Important
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Ensures platform security and prevents fraud</li>
            <li>• Complies with international regulations</li>
            <li>• Unlocks higher trading limits</li>
            <li>• Enables faster withdrawals</li>
          </ul>
        </Card>
      </main>
    </div>
  );
};

export default KYC;
