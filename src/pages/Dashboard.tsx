import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Wallet, User, Settings, FileCheck, Menu, LogOut, Bitcoin, DollarSign, Euro, PoundSterling, Coins, Gem, Droplet, Flame, RotateCcw, Shield, Search, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import TradingList from "@/components/TradingList";
import BottomNav from "@/components/BottomNav";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cryptoData, setCryptoData] = useState([
    { name: "Bitcoin", symbol: "BTC", price: "$43,250.00", change: "+2.5%", isPositive: true, icon: Bitcoin },
    { name: "Ethereum", symbol: "ETH", price: "$2,280.50", change: "+1.8%", isPositive: true, icon: Coins },
    { name: "Ripple", symbol: "XRP", price: "$0.62", change: "-0.5%", isPositive: false, icon: Coins },
    { name: "Cardano", symbol: "ADA", price: "$0.48", change: "+3.2%", isPositive: true, icon: Coins },
    { name: "Solana", symbol: "SOL", price: "$98.75", change: "+5.1%", isPositive: true, icon: Coins },
  ]);
  const [forexData, setForexData] = useState([
    { name: "EUR/USD", symbol: "EUR", price: "1.0925", change: "+0.15%", isPositive: true, icon: "🇪🇺" },
    { name: "GBP/USD", symbol: "GBP", price: "1.2750", change: "-0.08%", isPositive: false, icon: "🇬🇧" },
    { name: "USD/JPY", symbol: "JPY", price: "148.50", change: "+0.22%", isPositive: true, icon: "🇯🇵" },
  ]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCryptoData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-crypto-data');
      
      if (error) {
        console.error('Error fetching crypto data:', error);
        return;
      }
      
      if (data?.cryptoData) {
        setCryptoData(data.cryptoData);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchForexData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-forex-data');
      
      if (error) {
        console.error('Error fetching forex data:', error);
        return;
      }
      
      if (data?.forexData) {
        setForexData(data.forexData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchCryptoData();
      fetchForexData();
      checkAdminStatus();
      
      // Auto-refresh every 30 seconds for live data
      const refreshInterval = setInterval(() => {
        fetchCryptoData();
        fetchForexData();
      }, 30000);

      return () => clearInterval(refreshInterval);
    }
  }, [user, authLoading, navigate]);

  const checkAdminStatus = async () => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };


  const commoditiesData = [
    { name: "Gold", symbol: "XAU", price: "$2,050.00", change: "+1.2%", isPositive: true, icon: Gem },
    { name: "Silver", symbol: "XAG", price: "$24.50", change: "+0.8%", isPositive: true, icon: Gem },
    { name: "Crude Oil", symbol: "WTI", price: "$78.50", change: "-0.5%", isPositive: false, icon: Droplet },
    { name: "Natural Gas", symbol: "NG", price: "$2.85", change: "+2.1%", isPositive: true, icon: Flame },
    { name: "Copper", symbol: "HG", price: "$3.85", change: "+1.5%", isPositive: true, icon: Coins },
  ];

  const filterData = <T extends { name: string; symbol: string }>(data: T[]) => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase().trim();
    return data.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.symbol.toLowerCase().includes(query)
    );
  };

  const filteredCryptoData = filterData(cryptoData);
  const filteredForexData = filterData(forexData);
  const filteredCommoditiesData = filterData(commoditiesData);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/95 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-tight">
                CoinGoldFX
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/admin")} title="Admin Dashboard">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/wallet")}>
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/profile")}>
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={signOut} title="Sign Out">
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 overflow-hidden border-r border-border/40 bg-card/50 hidden sm:block`}>
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
        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20">
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 sm:mb-6 md:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Trading Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Monitor and trade across multiple markets</p>
            </div>

            {/* Search Bar */}
            <div className="mb-4 sm:mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 sm:pl-12 h-10 sm:h-12 text-sm sm:text-base"
                />
              </div>
            </div>

            <Tabs defaultValue="crypto" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6 h-auto p-1 bg-gradient-to-r from-card to-muted/50 backdrop-blur-sm">
                <TabsTrigger 
                  value="crypto" 
                  className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold"
                >
                  Crypto
                </TabsTrigger>
                <TabsTrigger 
                  value="forex"
                  className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold"
                >
                  Forex
                </TabsTrigger>
                <TabsTrigger 
                  value="commodities"
                  className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold"
                >
                  Commodities
                </TabsTrigger>
              </TabsList>

              <TabsContent value="crypto">
                <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold flex items-center gap-2 mb-0">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      Cryptocurrency Markets
                    </span>
                  </h2>
                  <Button variant="ghost" size="icon" onClick={fetchCryptoData} aria-label="Refresh markets" title="Refresh markets">
                    <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <div className="max-h-[600px] overflow-y-auto scrollbar-hide">
                  {filteredCryptoData.length > 0 ? (
                    <TradingList data={filteredCryptoData} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No cryptocurrencies found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="forex">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 md:mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Forex Markets
                  </span>
                </h2>
                {filteredForexData.length > 0 ? (
                  <TradingList data={filteredForexData} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No forex pairs found matching "{searchQuery}"
                  </div>
                )}
              </TabsContent>

              <TabsContent value="commodities">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 md:mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Commodities Markets
                  </span>
                </h2>
                {filteredCommoditiesData.length > 0 ? (
                  <TradingList data={filteredCommoditiesData} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No commodities found matching "{searchQuery}"
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};

export default Dashboard;
