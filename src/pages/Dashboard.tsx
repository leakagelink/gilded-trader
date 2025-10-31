import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Wallet, User, Settings, FileCheck, Menu, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TradingList from "@/components/TradingList";

const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const cryptoData = [
    { name: "Bitcoin", symbol: "BTC", price: "$43,250.00", change: "+2.5%", isPositive: true },
    { name: "Ethereum", symbol: "ETH", price: "$2,280.50", change: "+1.8%", isPositive: true },
    { name: "Ripple", symbol: "XRP", price: "$0.62", change: "-0.5%", isPositive: false },
    { name: "Cardano", symbol: "ADA", price: "$0.48", change: "+3.2%", isPositive: true },
    { name: "Solana", symbol: "SOL", price: "$98.75", change: "+5.1%", isPositive: true },
  ];

  const forexData = [
    { name: "EUR/USD", symbol: "EUR", price: "1.0925", change: "+0.15%", isPositive: true },
    { name: "GBP/USD", symbol: "GBP", price: "1.2750", change: "-0.08%", isPositive: false },
    { name: "USD/JPY", symbol: "JPY", price: "148.50", change: "+0.22%", isPositive: true },
    { name: "AUD/USD", symbol: "AUD", price: "0.6580", change: "+0.10%", isPositive: true },
    { name: "USD/CAD", symbol: "CAD", price: "1.3420", change: "-0.12%", isPositive: false },
  ];

  const commoditiesData = [
    { name: "Gold", symbol: "XAU", price: "$2,050.00", change: "+1.2%", isPositive: true },
    { name: "Silver", symbol: "XAG", price: "$24.50", change: "+0.8%", isPositive: true },
    { name: "Crude Oil", symbol: "WTI", price: "$78.50", change: "-0.5%", isPositive: false },
    { name: "Natural Gas", symbol: "NG", price: "$2.85", change: "+2.1%", isPositive: true },
    { name: "Copper", symbol: "HG", price: "$3.85", change: "+1.5%", isPositive: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                TradePro
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/wallet")}>
              <Wallet className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
              <User className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 overflow-hidden border-r border-border/40 bg-card/50`}>
          <nav className="p-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/dashboard")}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Trading
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/wallet")}>
              <Wallet className="mr-2 h-4 w-4" />
              Wallet
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/kyc")}>
              <FileCheck className="mr-2 h-4 w-4" />
              KYC Verification
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Trading Dashboard</h1>
              <p className="text-muted-foreground">Monitor and trade across multiple markets</p>
            </div>

            <Tabs defaultValue="crypto" className="w-full">
              <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
                <TabsTrigger value="crypto">Crypto</TabsTrigger>
                <TabsTrigger value="forex">Forex</TabsTrigger>
                <TabsTrigger value="commodities">Commodities</TabsTrigger>
              </TabsList>

              <TabsContent value="crypto">
                <Card className="p-6">
                  <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    Cryptocurrency Markets
                  </h2>
                  <TradingList data={cryptoData} />
                </Card>
              </TabsContent>

              <TabsContent value="forex">
                <Card className="p-6">
                  <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    Forex Markets
                  </h2>
                  <TradingList data={forexData} />
                </Card>
              </TabsContent>

              <TabsContent value="commodities">
                <Card className="p-6">
                  <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    Commodities Markets
                  </h2>
                  <TradingList data={commoditiesData} />
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
