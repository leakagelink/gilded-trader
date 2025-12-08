import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Shield, TrendingUp, Wallet, LineChart, Globe, Award, CheckCircle, Users, Star, Lock, Zap, Bell, ArrowUp, ArrowDown, X, Newspaper, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Certificate images
import certificate1 from "@/assets/certificate-1.png";
import certificate2 from "@/assets/certificate-2.png";
import certificate3 from "@/assets/certificate-3.png";
import certificate4 from "@/assets/certificate-4.png";

const Index = () => {
  const navigate = useNavigate();
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: number;
    type: string;
    user: string;
    amount: string;
    time: string;
  }>>([]);
  
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    user: string;
  }>({ show: false, message: "", user: "" });

  const [cryptoPrices, setCryptoPrices] = useState<{
    [key: string]: { price: number; change: number; previousPrice: number };
  }>({
    BTCUSDT: { price: 0, change: 0, previousPrice: 0 },
    ETHUSDT: { price: 0, change: 0, previousPrice: 0 },
    BNBUSDT: { price: 0, change: 0, previousPrice: 0 },
  });

  // Fake notification alerts
  useEffect(() => {
    const notifications = [
      { user: "John D.", message: "just deposited $5,000" },
      { user: "Sarah M.", message: "just withdrew $12,500" },
      { user: "Mike R.", message: "opened a BTC position worth $8,200" },
      { user: "Emma W.", message: "made +$3,500 profit on ETH" },
      { user: "David L.", message: "just deposited $6,800" },
      { user: "Lisa P.", message: "just withdrew $9,200" },
      { user: "Alex K.", message: "opened a Gold position worth $15,000" },
    ];

    const showNotification = () => {
      const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];
      setNotification({ show: true, ...randomNotification });
      
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 4000);
    };

    showNotification();
    const interval = setInterval(showNotification, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch real-time crypto prices
  useEffect(() => {
    const fetchCryptoPrices = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-crypto-data');

        if (error) throw error;
        
        if (data?.cryptoData && Array.isArray(data.cryptoData)) {
          setCryptoPrices(prev => {
            const updated: typeof prev = {};
            
            // Filter for BTC, ETH, BNB
            const targetCoins = ['BTC', 'ETH', 'BNB'];
            data.cryptoData
              .filter((coin: any) => targetCoins.includes(coin.symbol))
              .forEach((coin: any) => {
                const symbolKey = `${coin.symbol}USDT`;
                const newPrice = parseFloat(coin.price);
                
                updated[symbolKey] = {
                  price: newPrice,
                  change: prev[symbolKey] ? newPrice - prev[symbolKey].price : 0,
                  previousPrice: prev[symbolKey]?.price || newPrice
                };
              });
            
            return updated;
          });
        }
      } catch (error) {
        console.error('Error fetching crypto prices:', error);
      }
    };

    fetchCryptoPrices();
    const interval = setInterval(fetchCryptoPrices, 1000);

    return () => clearInterval(interval);
  }, []);

  // Generate fake recent activities
  useEffect(() => {
    const activities = [
      { id: 1, type: "Deposit", user: "John D.", amount: "$5,000", time: "2 mins ago" },
      { id: 2, type: "Withdrawal", user: "Sarah M.", amount: "$12,500", time: "5 mins ago" },
      { id: 3, type: "Deposit", user: "Mike R.", amount: "$8,200", time: "8 mins ago" },
      { id: 4, type: "Trade", user: "Emma W.", amount: "$15,000", time: "12 mins ago" },
      { id: 5, type: "Deposit", user: "David L.", amount: "$6,800", time: "15 mins ago" },
    ];
    setRecentActivities(activities);

    // Rotate activities every 5 seconds
    const interval = setInterval(() => {
      setRecentActivities(prev => {
        const newActivity = {
          id: Date.now(),
          type: ["Deposit", "Withdrawal", "Trade"][Math.floor(Math.random() * 3)],
          user: ["Alex K.", "Lisa P.", "Tom H.", "Nina S.", "Ryan B."][Math.floor(Math.random() * 5)],
          amount: `$${(Math.random() * 20000 + 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
          time: "Just now"
        };
        return [newActivity, ...prev.slice(0, 4)];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: "Crypto Trading",
      description: "Trade Bitcoin, Ethereum, and 100+ cryptocurrencies with real-time data"
    },
    {
      icon: Globe,
      title: "Forex Markets",
      description: "Access major currency pairs with competitive spreads and instant execution"
    },
    {
      icon: LineChart,
      title: "Commodities",
      description: "Trade gold, silver, oil, and other commodities with professional tools"
    },
    {
      icon: Shield,
      title: "Secure Platform",
      description: "Bank-level security with KYC verification and encrypted transactions"
    },
    {
      icon: Wallet,
      title: "Digital Wallet",
      description: "Manage your funds securely with instant deposits and withdrawals"
    },
    {
      icon: Award,
      title: "Professional Tools",
      description: "Advanced charts, analytics, and trading indicators for better decisions"
    }
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Notification Alert */}
      {notification.show && (
        <div className="fixed top-20 right-4 z-[100] animate-in slide-in-from-right-full duration-500">
          <Alert className="bg-gradient-to-r from-primary/90 to-accent/90 border-none text-white shadow-2xl backdrop-blur-xl w-80">
            <Bell className="h-5 w-5 animate-pulse" />
            <AlertDescription className="ml-2 font-semibold">
              <span className="font-bold">{notification.user}</span> {notification.message}
            </AlertDescription>
            <button
              onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        </div>
      )}

      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-xl bg-background/80 sticky top-0 z-50 shadow-sm noise">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
              <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105 animate-glow">
                <TrendingUp className="h-5 w-5 sm:h-7 sm:w-7 text-primary-foreground" />
              </div>
              <span className="text-xl sm:text-3xl font-extrabold gradient-text">
                CoinGoldFX
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" onClick={() => navigate("/auth")} className="hover:bg-primary/10 transition-all hidden sm:flex">
                Sign In
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-primary via-primary/95 to-accent hover:shadow-lg hover:scale-105 transition-all duration-300 text-xs sm:text-sm px-3 sm:px-4 relative overflow-hidden group" onClick={() => navigate("/auth")}>
                <span className="relative z-10 flex items-center">
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Start</span>
                  <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Crypto Ticker */}
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border/40 py-2 sm:py-4 overflow-hidden relative">
        <div className="absolute inset-0 shimmer opacity-50" />
        <div className="container mx-auto px-2 sm:px-4 relative">
          <div className="flex items-center justify-center gap-2 sm:gap-8 md:gap-16 overflow-x-auto scrollbar-hide">
            {Object.entries(cryptoPrices).map(([symbol, data]) => {
              const displayName = symbol.replace('USDT', '');
              const isUp = data.change > 0;
              const isDown = data.change < 0;
              
              const coinIcons: { [key: string]: string } = {
                'BTC': '₿',
                'ETH': 'Ξ',
                'BNB': 'B'
              };
              
              return (
                <div
                  key={symbol}
                  className={`flex items-center gap-1.5 sm:gap-3 p-1.5 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-500 flex-shrink-0 glass hover:scale-105 cursor-pointer ${
                    isUp ? 'glow-primary' : isDown ? 'border-red-500/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shadow-lg text-sm sm:text-xl ${isUp || isDown ? 'animate-scale-pulse' : ''}`}>
                      {coinIcons[displayName] || displayName.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold text-xs sm:text-sm">{displayName}</p>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <p className={`font-black text-xs sm:text-lg transition-all duration-300 ${
                          isUp ? 'text-green-600' : isDown ? 'text-red-600' : ''
                        }`}>
                          ${data.price > 0 ? data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </p>
                        {isUp && <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 animate-bounce" />}
                        {isDown && <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 animate-bounce" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-24 md:py-40">
        {/* Animated Background with Floating Orbs */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
          
          {/* Animated Orbs */}
          <div className="absolute top-20 left-10 w-32 sm:w-72 h-32 sm:h-72 bg-primary/30 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-20 right-10 w-40 sm:w-96 h-40 sm:h-96 bg-accent/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[200px] sm:w-[500px] h-[200px] sm:h-[500px] bg-primary/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
          
          {/* Floating Particles */}
          <div className="particles">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="particle bg-primary/20"
                style={{
                  width: `${Math.random() * 10 + 5}px`,
                  height: `${Math.random() * 10 + 5}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${Math.random() * 10 + 5}s`,
                }}
              />
            ))}
          </div>
          
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Floating Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 glass rounded-full px-3 sm:px-6 py-1.5 sm:py-3 mb-4 sm:mb-8 shadow-lg animate-float">
              <div className="relative">
                <Award className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <div className="absolute inset-0 animate-ping">
                  <Award className="h-4 w-4 sm:h-5 sm:w-5 text-primary/50" />
                </div>
              </div>
              <span className="text-xs sm:text-sm font-bold gradient-text">
                #1 Professional Trading Platform
              </span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            
            <h1 className="text-3xl sm:text-6xl md:text-8xl font-black mb-4 sm:mb-8 leading-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Trade With
              <span className="block relative">
                <span className="gradient-text">
                  Confidence
                </span>
                {/* Underline glow */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse" />
              </span>
            </h1>
            
            <p className="text-sm sm:text-xl md:text-2xl text-muted-foreground mb-6 sm:mb-10 max-w-3xl mx-auto leading-relaxed animate-fade-in px-2" style={{ animationDelay: '0.2s' }}>
              Experience professional trading with advanced tools, lightning-fast execution, and institutional-grade security. Join <span className="font-bold text-primary">50,000+</span> successful traders.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-in px-4" style={{ animationDelay: '0.3s' }}>
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-gradient-to-r from-primary via-primary to-accent hover:shadow-2xl hover:scale-105 transition-all duration-300 text-sm sm:text-lg px-6 sm:px-10 py-4 sm:py-6 rounded-xl font-bold group relative overflow-hidden"
                onClick={() => navigate("/auth")}
              >
                <span className="relative z-10 flex items-center">
                  Start Trading Now 
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto text-sm sm:text-lg px-6 sm:px-10 py-4 sm:py-6 rounded-xl border-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 hover:scale-105 transition-all duration-300 backdrop-blur-sm group"
              >
                <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:animate-bounce" />
                View Live Markets
              </Button>
            </div>

            {/* Stats Pills with Animation */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 mt-8 sm:mt-16 animate-fade-in px-2" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full glass hover:scale-105 transition-all cursor-pointer group">
                <CheckCircle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-green-500 group-hover:animate-bounce" />
                <span className="font-semibold text-xs sm:text-base">SSL Secured</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full glass hover:scale-105 transition-all cursor-pointer group">
                <Award className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-accent group-hover:animate-bounce" />
                <span className="font-semibold text-xs sm:text-base">ISO Certified</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full glass hover:scale-105 transition-all cursor-pointer group">
                <Users className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-primary group-hover:animate-bounce" />
                <span className="font-semibold text-xs sm:text-base">50K+ Users</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Crypto Markets */}
      <section className="py-10 sm:py-20 bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden noise">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-20 right-20 w-32 sm:w-64 h-32 sm:h-64 bg-primary/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-20 left-20 w-40 sm:w-80 h-40 sm:h-80 bg-accent/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
        
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-16">
            <Badge className="mb-4 sm:mb-6 glass text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold animate-bounce-in">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" /> Live Markets
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6 animate-fade-in">
              Real-Time Crypto <span className="gradient-text">Markets</span>
            </h2>
            <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in px-4" style={{ animationDelay: '0.1s' }}>
              Track live prices with instant updates every second
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
            {Object.entries(cryptoPrices).map(([symbol, data], index) => {
              const displayName = symbol.replace('USDT', '');
              const isUp = data.change > 0;
              const isDown = data.change < 0;
              
              const coinIcons: { [key: string]: string } = {
                'BTC': '₿',
                'ETH': 'Ξ',
                'BNB': 'B'
              };
              
              return (
                <Card
                  key={symbol}
                  className={`group p-4 sm:p-8 border-2 hover:shadow-2xl transition-all duration-500 rounded-xl sm:rounded-2xl backdrop-blur-sm card-hover animate-fade-in relative overflow-hidden ${
                    isUp 
                      ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30 hover:border-green-500/50' 
                      : isDown 
                      ? 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30 hover:border-red-500/50'
                      : 'bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50'
                  }`}
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {/* Glow effect on hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                    isUp ? 'bg-green-500/5' : isDown ? 'bg-red-500/5' : 'bg-primary/5'
                  }`} />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3 sm:mb-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`h-10 w-10 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-xl sm:text-3xl text-white shadow-xl group-hover:scale-110 transition-transform ${isUp || isDown ? 'animate-scale-pulse' : ''}`}>
                          {coinIcons[displayName] || displayName.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-lg sm:text-2xl font-black">{displayName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">USDT</p>
                        </div>
                      </div>
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all ${
                        isUp ? 'bg-green-500/20' : isDown ? 'bg-red-500/20' : 'bg-muted/20'
                      }`}>
                        {isUp && <ArrowUp className="h-5 w-5 sm:h-8 sm:w-8 text-green-600 animate-bounce" />}
                        {isDown && <ArrowDown className="h-5 w-5 sm:h-8 sm:w-8 text-red-600 animate-bounce" />}
                        {!isUp && !isDown && <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-muted-foreground" />}
                      </div>
                    </div>
                    
                    <div className="space-y-1 sm:space-y-2">
                      <p className={`text-2xl sm:text-4xl font-black transition-all duration-300 ${
                        isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-foreground'
                      }`}>
                        ${data.price > 0 ? data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                      </p>
                      <p className={`text-xs sm:text-sm font-semibold flex items-center gap-1 ${
                        isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-muted-foreground'
                      }`}>
                        {isUp && '+'}{data.change.toFixed(2)} USD
                        {isUp && ' 📈'}
                        {isDown && ' 📉'}
                      </p>
                    </div>

                    <Button 
                      size="sm"
                      className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all group-hover:scale-105 text-xs sm:text-sm relative overflow-hidden"
                      onClick={() => navigate("/auth")}
                    >
                      <span className="relative z-10 flex items-center justify-center">
                        Trade Now <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live Activity Feed */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6 sm:mb-12">
              <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-pulse" /> Real-Time Activity
              </Badge>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-4">
                Live Trading <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Activity</span>
              </h2>
              <p className="text-sm sm:text-xl text-muted-foreground px-2">Join thousands of traders making profitable trades</p>
            </div>
            
            <Card className="p-3 sm:p-8 border-2 border-primary/10 bg-card/80 backdrop-blur-xl shadow-2xl rounded-xl sm:rounded-2xl">
              <div className="space-y-2 sm:space-y-4">
                {recentActivities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2.5 sm:p-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 hover:from-primary/5 hover:to-accent/5 transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-lg animate-in fade-in slide-in-from-top-2"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center gap-2 sm:gap-4">
                      <Avatar className="h-8 w-8 sm:h-12 sm:w-12 ring-2 ring-primary/20">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user}`} alt={activity.user} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-xs sm:text-lg">
                          {activity.user.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm sm:text-lg">{activity.user}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          {activity.type === "Deposit" && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500" />}
                          {activity.type === "Withdrawal" && <Wallet className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-500" />}
                          {activity.type === "Trade" && <LineChart className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-purple-500" />}
                          {activity.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm sm:text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {activity.amount}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live updates every 5 seconds
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Crypto News Section */}
      <section className="py-10 sm:py-20 bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-16">
            <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold animate-bounce-in">
              <Newspaper className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-pulse" /> Latest News
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6 animate-fade-in">
              Crypto Market <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">News</span>
            </h2>
            <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in px-2" style={{ animationDelay: '0.1s' }}>
              Stay updated with the latest cryptocurrency market trends
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 max-w-7xl mx-auto">
            {[
              {
                title: "Bitcoin Surges Past $65,000 Mark",
                excerpt: "Bitcoin has broken through the $65,000 resistance level as institutional adoption continues to grow...",
                category: "Bitcoin",
                time: "2 hours ago",
                trend: "up"
              },
              {
                title: "Ethereum 2.0 Upgrade Shows Promise",
                excerpt: "The latest Ethereum network upgrade demonstrates significant improvements in transaction speed and gas fees...",
                category: "Ethereum",
                time: "5 hours ago",
                trend: "up"
              },
              {
                title: "BNB Chain Announces New DeFi Features",
                excerpt: "Binance Smart Chain unveils revolutionary DeFi protocols aimed at expanding the ecosystem...",
                category: "BNB",
                time: "8 hours ago",
                trend: "neutral"
              },
              {
                title: "Crypto Market Cap Reaches New High",
                excerpt: "Total cryptocurrency market capitalization exceeds $2.8 trillion as bull run continues...",
                category: "Market",
                time: "12 hours ago",
                trend: "up"
              },
              {
                title: "Regulatory Changes Impact Trading",
                excerpt: "New financial regulations bring clarity to cryptocurrency trading and taxation policies...",
                category: "Regulation",
                time: "1 day ago",
                trend: "neutral"
              },
              {
                title: "Altcoins Show Strong Performance",
                excerpt: "Several altcoins demonstrate remarkable growth as investors diversify portfolios...",
                category: "Altcoins",
                time: "1 day ago",
                trend: "up"
              }
            ].map((news, index) => (
              <Card
                key={index}
                className="group p-4 sm:p-6 border-2 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between mb-2 sm:mb-4">
                  <Badge className={`text-xs ${
                    news.trend === 'up' 
                      ? 'bg-green-500/10 text-green-600 border-green-500/30' 
                      : 'bg-muted/50 text-muted-foreground border-border'
                  }`}>
                    {news.category}
                  </Badge>
                  {news.trend === 'up' && <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 animate-bounce" />}
                  {news.trend === 'down' && <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 animate-bounce" />}
                </div>
                
                <h3 className="text-base sm:text-xl font-black mb-2 sm:mb-3 group-hover:text-primary transition-colors line-clamp-2">
                  {news.title}
                </h3>
                
                <p className="text-xs sm:text-base text-muted-foreground mb-3 sm:mb-4 leading-relaxed line-clamp-2 sm:line-clamp-3">
                  {news.excerpt}
                </p>
                
                <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border/50">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{news.time}</p>
                  <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 text-xs sm:text-sm h-7 sm:h-9 px-2 sm:px-3">
                    Read More <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-24 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6">
              Why Choose <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">CoinGoldFX?</span>
            </h2>
            <p className="text-sm sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-2">
              Professional-grade tools trusted by thousands of successful traders worldwide
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group p-3 sm:p-8 hover:shadow-2xl transition-all duration-500 border-2 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="h-10 w-10 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center mb-3 sm:mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-primary/30 group-hover:to-accent/30">
                  <feature.icon className="h-5 w-5 sm:h-8 sm:w-8 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold mb-1 sm:mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-xs sm:text-base text-muted-foreground leading-relaxed line-clamp-3 sm:line-clamp-none">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 sm:py-24 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-16">
            <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold">
              <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 fill-primary" /> Testimonials
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6">
              What Our <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Traders</span> Say
            </h2>
            <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              Join thousands of satisfied traders who trust CoinGoldFX
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 max-w-7xl mx-auto">
            {[
              {
                name: "Michael Chen",
                role: "Day Trader",
                content: "Best trading platform I've used. The real-time data and execution speed are unmatched. Made over $50K in profits last quarter.",
                rating: 5
              },
              {
                name: "Sarah Williams",
                role: "Crypto Investor",
                content: "CoinGoldFX's security features give me peace of mind. The withdrawal process is smooth and customer support is excellent.",
                rating: 5
              },
              {
                name: "David Kumar",
                role: "Forex Trader",
                content: "Professional-grade tools at my fingertips. The leverage options and low spreads make this my go-to platform for forex trading.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <Card 
                key={index} 
                className="group p-4 sm:p-8 border-2 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="flex mb-3 sm:mb-6 gap-0.5 sm:gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 sm:h-6 sm:w-6 fill-accent text-accent animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <p className="text-xs sm:text-lg text-muted-foreground mb-4 sm:mb-6 italic leading-relaxed line-clamp-4 sm:line-clamp-none">"{testimonial.content}"</p>
                <div className="flex items-center gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-border/50">
                  <Avatar className="h-10 w-10 sm:h-14 sm:w-14 ring-2 ring-primary/20">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${testimonial.name}`} alt={testimonial.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-sm sm:text-xl">
                      {testimonial.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-sm sm:text-lg">{testimonial.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-primary via-primary/95 to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-10 right-10 w-32 sm:w-64 h-32 sm:h-64 bg-accent/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-40 sm:w-80 h-40 sm:h-80 bg-primary/30 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8 max-w-6xl mx-auto">
            {[
              { label: "Active Traders", value: "50K+", icon: Users },
              { label: "Daily Volume", value: "$2.5B+", icon: TrendingUp },
              { label: "Markets Available", value: "150+", icon: Globe },
              { label: "Countries Supported", value: "100+", icon: Award }
            ].map((stat, index) => (
              <div 
                key={index} 
                className="text-center p-3 sm:p-8 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300 animate-in fade-in zoom-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <stat.icon className="h-6 w-6 sm:h-10 sm:w-10 text-white mx-auto mb-2 sm:mb-4 animate-pulse" />
                <div className="text-2xl sm:text-5xl font-black text-white mb-1 sm:mb-2 animate-pulse">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-base text-white/90 font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-28 bg-gradient-to-br from-primary via-primary to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-20 left-20 w-40 sm:w-96 h-40 sm:h-96 bg-accent/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-40 sm:w-96 h-40 sm:h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-primary-foreground">
            <h2 className="text-2xl sm:text-5xl md:text-7xl font-black mb-4 sm:mb-8 leading-tight">
              Ready to Start <span className="block">Trading?</span>
            </h2>
            <p className="text-sm sm:text-xl md:text-2xl mb-6 sm:mb-12 opacity-95 leading-relaxed max-w-2xl mx-auto px-2">
              Join 50,000+ successful traders who trust CoinGoldFX. Start with a free account today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-white text-primary hover:bg-white/90 text-sm sm:text-xl px-6 sm:px-12 py-4 sm:py-7 rounded-xl font-bold shadow-2xl hover:scale-105 transition-all duration-300 group"
                onClick={() => navigate("/auth")}
              >
                Create Free Account 
                <ArrowRight className="ml-2 h-4 w-4 sm:h-6 sm:w-6 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto text-sm sm:text-xl px-6 sm:px-12 py-4 sm:py-7 rounded-xl border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 backdrop-blur-sm hover:scale-105 transition-all duration-300"
              >
                <Shield className="mr-2 h-4 w-4 sm:h-6 sm:w-6" />
                Learn About Security
              </Button>
            </div>
            <p className="mt-4 sm:mt-8 text-xs sm:text-base text-white/80 flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> No credit card required • Start in 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="py-12 sm:py-24 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" /> FAQs
              </Badge>
              <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6">
                Frequently Asked <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Questions</span>
              </h2>
              <p className="text-sm sm:text-xl text-muted-foreground px-2">
                Everything you need to know about trading with CoinGoldFX
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-2 sm:space-y-4">
              <AccordionItem 
                value="item-1" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  How do I get started with CoinGoldFX?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Getting started is simple! Click "Get Started" to create your free account. Complete the KYC verification process, 
                  deposit funds using UPI or Net Banking, and you're ready to start trading crypto, forex, and commodities.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-2" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  What are the deposit and withdrawal methods?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  We support multiple payment methods including UPI, Net Banking, and bank transfers. Deposits are typically processed 
                  instantly, while withdrawals are processed within 24-48 hours after admin approval for security purposes.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-3" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  Is my money safe on CoinGoldFX?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Absolutely! We use bank-level SSL encryption, secure cold storage for crypto assets, and implement strict KYC/AML 
                  policies. All funds are segregated and your data is protected with industry-leading security measures.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-4" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  What is leverage trading and how does it work?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Leverage allows you to control larger positions with smaller capital. CoinGoldFX offers leverage up to 100x on 
                  select markets. For example, with 10x leverage and $100, you can open a $1,000 position. However, leverage 
                  amplifies both gains and losses, so trade responsibly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-5" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  Are there any trading fees?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  CoinGoldFX operates on a transparent fee structure. We charge competitive spreads on trades with no hidden fees. 
                  There are no deposit fees, and withdrawal fees vary by payment method. Check our fee schedule in your account 
                  settings for detailed information.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-6" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  Can I trade on mobile?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Yes! CoinGoldFX is fully optimized for mobile devices. Access all trading features, manage positions, and monitor 
                  markets from anywhere using your mobile browser. Our responsive design ensures a seamless trading experience 
                  on any device.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Certificates Section */}
      <section className="py-12 sm:py-20 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs sm:text-sm">
                <Award className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Certified Platform
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">
                Our{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Certifications
                </span>
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                CoinGoldFX is a certified and authorized trading platform with official licenses and certifications
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {[
                { img: certificate1, title: "Trading License Certificate" },
                { img: certificate2, title: "Crypto Trading Authorization" },
                { img: certificate3, title: "Forex Trading Certificate" },
                { img: certificate4, title: "Commodities Trading Certification" },
              ].map((cert, index) => (
                <div 
                  key={index}
                  className="group relative overflow-hidden rounded-xl sm:rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="aspect-[16/11] overflow-hidden">
                    <img 
                      src={cert.img} 
                      alt={cert.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/80 to-transparent p-3 sm:p-4">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">{cert.title}</h3>
                    <p className="text-xs text-muted-foreground">CoinGoldFX Official Certificate</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30 py-8 sm:py-12">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Logo & Brand */}
              <div className="flex flex-col items-center md:items-start gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />
                  </div>
                  <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    CoinGoldFX
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground text-center md:text-left">
                  Your trusted platform for crypto, forex & commodities trading.
                </p>
              </div>

              {/* Office Address */}
              <div className="flex flex-col items-center md:items-start gap-2">
                <h4 className="text-sm sm:text-base font-semibold text-foreground">Office Address</h4>
                <div className="text-xs sm:text-sm text-muted-foreground text-center md:text-left space-y-1">
                  <p>1079, Sector 11</p>
                  <p>Panchkula, Haryana 134117</p>
                  <p>India</p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="flex flex-col items-center md:items-start gap-2">
                <h4 className="text-sm sm:text-base font-semibold text-foreground">Quick Links</h4>
                <div className="flex flex-col items-center md:items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                  <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                  <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                  <a href="#" className="hover:text-primary transition-colors">Support</a>
                </div>
              </div>
            </div>
            
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-border/40 text-center text-xs sm:text-sm text-muted-foreground">
              <p>© 2024 CoinGoldFX. All rights reserved. Trading involves risk.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
