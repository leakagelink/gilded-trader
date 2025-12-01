import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Shield, TrendingUp, Wallet, LineChart, Globe, Award, CheckCircle, Users, Star, Lock, Zap, Bell, ArrowUp, ArrowDown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
        const { data, error } = await supabase.functions.invoke('fetch-crypto-data', {
          body: { symbols: ['BTC', 'ETH', 'BNB'] }
        });

        if (error) throw error;
        
        if (data?.prices) {
          setCryptoPrices(prev => {
            const updated: typeof prev = {};
            Object.entries(data.prices).forEach(([symbol, priceData]: [string, any]) => {
              const symbolKey = `${symbol}USDT`;
              updated[symbolKey] = {
                price: priceData.price,
                change: prev[symbolKey] ? priceData.price - prev[symbolKey].price : 0,
                previousPrice: prev[symbolKey]?.price || priceData.price
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
      <nav className="border-b border-border/40 backdrop-blur-xl bg-background/80 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <TrendingUp className="h-7 w-7 text-primary-foreground animate-pulse" />
              </div>
              <span className="text-3xl font-extrabold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                TradePro
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate("/auth")} className="hover:bg-primary/10 transition-all">
                Sign In
              </Button>
              <Button className="bg-gradient-to-r from-primary via-primary/95 to-accent hover:shadow-lg hover:scale-105 transition-all duration-300" onClick={() => navigate("/auth")}>
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Crypto Ticker */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-border/40 py-4 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-8 md:gap-16">
            {Object.entries(cryptoPrices).map(([symbol, data]) => {
              const displayName = symbol.replace('USDT', '');
              const isUp = data.change > 0;
              const isDown = data.change < 0;
              
              return (
                <div
                  key={symbol}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${
                    isUp ? 'animate-pulse bg-green-500/10' : isDown ? 'animate-pulse bg-red-500/10' : 'bg-muted/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shadow-lg">
                      {displayName.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{displayName}</p>
                      <div className="flex items-center gap-1">
                        <p className={`font-black text-lg transition-all duration-300 ${
                          isUp ? 'text-green-600 scale-110' : isDown ? 'text-red-600 scale-110' : ''
                        }`}>
                          ${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {isUp && <ArrowUp className="h-4 w-4 text-green-600 animate-bounce" />}
                        {isDown && <ArrowDown className="h-4 w-4 text-red-600 animate-bounce" />}
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
      <section className="relative overflow-hidden py-24 md:py-40">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-full px-5 py-2.5 mb-8 backdrop-blur-sm shadow-lg animate-fade-in">
              <Award className="h-5 w-5 text-primary animate-pulse" />
              <span className="text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                #1 Professional Trading Platform
              </span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black mb-8 leading-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Trade With
              <span className="block bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent animate-pulse">
                Confidence
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Experience professional trading with advanced tools, lightning-fast execution, and institutional-grade security. Join 50,000+ successful traders.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary via-primary to-accent hover:shadow-2xl hover:scale-105 transition-all duration-300 text-lg px-10 py-6 rounded-xl font-bold group"
                onClick={() => navigate("/auth")}
              >
                Start Trading Now 
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-10 py-6 rounded-xl border-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
              >
                <TrendingUp className="mr-2 h-5 w-5" />
                View Live Markets
              </Button>
            </div>

            {/* Stats Pills */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-16 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-sm">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">SSL Secured</span>
              </div>
              <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 backdrop-blur-sm">
                <Award className="h-5 w-5 text-accent" />
                <span className="font-semibold">ISO Certified</span>
              </div>
              <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 backdrop-blur-sm">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-semibold">50K+ Active Users</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Crypto Markets */}
      <section className="py-20 bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-4 py-2 text-sm font-semibold animate-bounce-in">
              <TrendingUp className="h-4 w-4 mr-2 animate-pulse" /> Live Markets
            </Badge>
            <h2 className="text-4xl md:text-6xl font-black mb-6 animate-fade-in">
              Real-Time Crypto <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Markets</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Track live prices with instant updates every second
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {Object.entries(cryptoPrices).map(([symbol, data], index) => {
              const displayName = symbol.replace('USDT', '');
              const isUp = data.change > 0;
              const isDown = data.change < 0;
              
              return (
                <Card
                  key={symbol}
                  className={`group p-8 border-2 hover:shadow-2xl transition-all duration-500 rounded-2xl backdrop-blur-sm hover:scale-105 animate-fade-in ${
                    isUp 
                      ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30 hover:border-green-500/50' 
                      : isDown 
                      ? 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30 hover:border-red-500/50'
                      : 'bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50'
                  }`}
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-2xl text-white shadow-xl group-hover:scale-110 transition-transform">
                        {displayName.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-2xl font-black">{displayName}</p>
                        <p className="text-sm text-muted-foreground">USDT</p>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl transition-all ${
                      isUp ? 'bg-green-500/20 animate-pulse' : isDown ? 'bg-red-500/20 animate-pulse' : 'bg-muted/20'
                    }`}>
                      {isUp && <ArrowUp className="h-8 w-8 text-green-600 animate-bounce" />}
                      {isDown && <ArrowDown className="h-8 w-8 text-red-600 animate-bounce" />}
                      {!isUp && !isDown && <TrendingUp className="h-8 w-8 text-muted-foreground" />}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className={`text-4xl font-black transition-all duration-300 ${
                      isUp ? 'text-green-600 scale-110' : isDown ? 'text-red-600 scale-110' : 'text-foreground'
                    }`}>
                      ${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-sm font-semibold flex items-center gap-1 ${
                      isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {isUp && '+'}{data.change.toFixed(2)} USD
                      {isUp && ' 📈'}
                      {isDown && ' 📉'}
                    </p>
                  </div>

                  <Button 
                    className="w-full mt-6 bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all group-hover:scale-105"
                    onClick={() => navigate("/auth")}
                  >
                    Trade Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live Activity Feed */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-4 py-2 text-sm font-semibold">
                <Zap className="h-4 w-4 mr-2 animate-pulse" /> Real-Time Activity
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Live Trading <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Activity</span>
              </h2>
              <p className="text-xl text-muted-foreground">Join thousands of traders making profitable trades every minute</p>
            </div>
            
            <Card className="p-8 border-2 border-primary/10 bg-card/80 backdrop-blur-xl shadow-2xl rounded-2xl">
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 hover:from-primary/5 hover:to-accent/5 transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-lg animate-in fade-in slide-in-from-top-2 hover:scale-[1.02]"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 bg-gradient-to-br from-primary to-accent ring-2 ring-primary/20">
                        <AvatarFallback className="text-primary-foreground font-bold text-lg">
                          {activity.user.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-lg">{activity.user}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          {activity.type === "Deposit" && <TrendingUp className="h-3 w-3 text-green-500" />}
                          {activity.type === "Withdrawal" && <Wallet className="h-3 w-3 text-blue-500" />}
                          {activity.type === "Trade" && <LineChart className="h-3 w-3 text-purple-500" />}
                          {activity.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {activity.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live updates every 5 seconds
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              Why Choose <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">TradePro?</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Professional-grade tools trusted by thousands of successful traders worldwide
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group p-8 hover:shadow-2xl transition-all duration-500 border-2 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm rounded-2xl hover:scale-105 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-primary/30 group-hover:to-accent/30">
                  <feature.icon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-4 py-2 text-sm font-semibold">
              <Star className="h-4 w-4 mr-2 fill-primary" /> Testimonials
            </Badge>
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              What Our <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Traders</span> Say
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of satisfied traders who trust TradePro
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
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
                content: "TradePro's security features give me peace of mind. The withdrawal process is smooth and customer support is excellent.",
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
                className="group p-8 border-2 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm rounded-2xl hover:shadow-2xl transition-all duration-500 hover:scale-105 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="flex mb-6 gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-6 w-6 fill-accent text-accent animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic leading-relaxed text-lg">"{testimonial.content}"</p>
                <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                  <Avatar className="h-14 w-14 bg-gradient-to-br from-primary to-accent ring-2 ring-primary/20">
                    <AvatarFallback className="text-primary-foreground font-bold text-xl">
                      {testimonial.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary/95 to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-10 right-10 w-64 h-64 bg-accent/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-primary/30 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { label: "Active Traders", value: "50K+", icon: Users },
              { label: "Daily Volume", value: "$2.5B+", icon: TrendingUp },
              { label: "Markets Available", value: "150+", icon: Globe },
              { label: "Countries Supported", value: "100+", icon: Award }
            ].map((stat, index) => (
              <div 
                key={index} 
                className="text-center p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-2xl animate-in fade-in zoom-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <stat.icon className="h-10 w-10 text-white mx-auto mb-4 animate-pulse" />
                <div className="text-5xl font-black text-white mb-2 animate-pulse">
                  {stat.value}
                </div>
                <div className="text-white/90 font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28 bg-gradient-to-br from-primary via-primary to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-20 left-20 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-primary-foreground">
            <h2 className="text-5xl md:text-7xl font-black mb-8 leading-tight">
              Ready to Start <span className="block">Trading?</span>
            </h2>
            <p className="text-xl md:text-2xl mb-12 opacity-95 leading-relaxed max-w-2xl mx-auto">
              Join 50,000+ successful traders who trust TradePro. Start with a free account today and access professional trading tools instantly.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 text-xl px-12 py-7 rounded-xl font-bold shadow-2xl hover:scale-105 transition-all duration-300 group"
                onClick={() => navigate("/auth")}
              >
                Create Free Account 
                <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-xl px-12 py-7 rounded-xl border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 backdrop-blur-sm hover:scale-105 transition-all duration-300"
              >
                <Shield className="mr-2 h-6 w-6" />
                Learn About Security
              </Button>
            </div>
            <p className="mt-8 text-white/80 flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" /> No credit card required • Start in 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="py-24 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-4 py-2 text-sm font-semibold">
                <CheckCircle className="h-4 w-4 mr-2" /> FAQs
              </Badge>
              <h2 className="text-4xl md:text-6xl font-black mb-6">
                Frequently Asked <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Questions</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Everything you need to know about trading with TradePro
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem 
                value="item-1" 
                className="border-2 border-border/50 rounded-2xl px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-lg font-bold hover:text-primary">
                  How do I get started with TradePro?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Getting started is simple! Click "Get Started" to create your free account. Complete the KYC verification process, 
                  deposit funds using UPI or Net Banking, and you're ready to start trading crypto, forex, and commodities.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-2" 
                className="border-2 border-border/50 rounded-2xl px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-lg font-bold hover:text-primary">
                  What are the deposit and withdrawal methods?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  We support multiple payment methods including UPI, Net Banking, and bank transfers. Deposits are typically processed 
                  instantly, while withdrawals are processed within 24-48 hours after admin approval for security purposes.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-3" 
                className="border-2 border-border/50 rounded-2xl px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-lg font-bold hover:text-primary">
                  Is my money safe on TradePro?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Absolutely! We use bank-level SSL encryption, secure cold storage for crypto assets, and implement strict KYC/AML 
                  policies. All funds are segregated and your data is protected with industry-leading security measures.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-4" 
                className="border-2 border-border/50 rounded-2xl px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-lg font-bold hover:text-primary">
                  What is leverage trading and how does it work?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Leverage allows you to control larger positions with smaller capital. TradePro offers leverage up to 100x on 
                  select markets. For example, with 10x leverage and $100, you can open a $1,000 position. However, leverage 
                  amplifies both gains and losses, so trade responsibly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-5" 
                className="border-2 border-border/50 rounded-2xl px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-lg font-bold hover:text-primary">
                  Are there any trading fees?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  TradePro operates on a transparent fee structure. We charge competitive spreads on trades with no hidden fees. 
                  There are no deposit fees, and withdrawal fees vary by payment method. Check our fee schedule in your account 
                  settings for detailed information.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-6" 
                className="border-2 border-border/50 rounded-2xl px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-lg font-bold hover:text-primary">
                  Can I trade on mobile?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Yes! TradePro is fully optimized for mobile devices. Access all trading features, manage positions, and monitor 
                  markets from anywhere using your mobile browser. Our responsive design ensures a seamless trading experience 
                  on any device.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  TradePro
                </span>
              </div>
              <div className="flex items-center gap-8 text-sm text-muted-foreground">
                <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-primary transition-colors">Support</a>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
              <p>© 2024 TradePro. All rights reserved. Trading involves risk. Only invest what you can afford to lose.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
