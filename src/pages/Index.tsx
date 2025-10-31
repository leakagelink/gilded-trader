import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Shield, TrendingUp, Wallet, LineChart, Globe, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                TradePro
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
              <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary" onClick={() => navigate("/auth")}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-6">
              <Award className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Professional Trading Platform</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Trade Crypto, Forex & 
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> Commodities</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Experience professional trading with advanced tools, real-time data, and secure transactions. Start your journey today.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                Start Trading <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose TradePro?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional tools and features designed for serious traders
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              { label: "Active Traders", value: "50K+" },
              { label: "Daily Volume", value: "$2.5B+" },
              { label: "Markets Available", value: "150+" },
              { label: "Countries Supported", value: "100+" }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary/90 to-accent">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-primary-foreground">
            <h2 className="text-4xl font-bold mb-6">Ready to Start Trading?</h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of traders who trust TradePro for their trading needs
            </p>
            <Button 
              size="lg" 
              className="bg-background text-foreground hover:bg-background/90 text-lg px-8"
              onClick={() => navigate("/auth")}
            >
              Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 TradePro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
