import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, TrendingUp, Bell, Shield, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

const Settings = () => {
  const navigate = useNavigate();

  const handleSave = () => {
    toast.success("Settings saved successfully!");
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
              CoinGoldFX
            </span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your preferences and security</p>
        </div>

        <div className="space-y-6">
          {/* Notifications */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notif">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch id="email-notif" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="trade-alerts">Trade Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified about trade executions</p>
                </div>
                <Switch id="trade-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="price-alerts">Price Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notifications for price movements</p>
                </div>
                <Switch id="price-alerts" />
              </div>
            </div>
          </Card>

          {/* Security */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Security</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="2fa">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Add extra security to your account</p>
                </div>
                <Switch id="2fa" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="biometric">Biometric Login</Label>
                  <p className="text-sm text-muted-foreground">Use fingerprint or face ID</p>
                </div>
                <Switch id="biometric" />
              </div>
            </div>
          </Card>

          {/* Privacy */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Privacy</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="profile-public">Public Profile</Label>
                  <p className="text-sm text-muted-foreground">Make your profile visible to others</p>
                </div>
                <Switch id="profile-public" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="trade-history">Show Trade History</Label>
                  <p className="text-sm text-muted-foreground">Display your trading activity</p>
                </div>
                <Switch id="trade-history" />
              </div>
            </div>
          </Card>

          <Button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
          >
            Save All Settings
          </Button>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};

export default Settings;
