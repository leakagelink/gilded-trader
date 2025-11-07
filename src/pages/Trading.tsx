import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from "recharts";

type Timeframe = "1H" | "4H" | "1D" | "1W" | "1M";

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const Trading = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [chartData, setChartData] = useState<CandleData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    generateChartData();
    
    // Simulate live updates every 3 seconds
    const interval = setInterval(() => {
      updateLivePrice();
    }, 3000);

    return () => clearInterval(interval);
  }, [user, timeframe, navigate]);

  const generateChartData = () => {
    const dataPoints = timeframe === "1H" ? 12 : timeframe === "4H" ? 24 : timeframe === "1D" ? 48 : timeframe === "1W" ? 28 : 30;
    const basePrice = Math.random() * 10000 + 1000;
    
    const data: CandleData[] = [];
    let prevClose = basePrice;

    for (let i = 0; i < dataPoints; i++) {
      const volatility = prevClose * 0.02;
      const open = prevClose;
      const close = open + (Math.random() - 0.5) * volatility * 2;
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;
      const volume = Math.random() * 1000000;

      data.push({
        time: getTimeLabel(i, timeframe),
        open,
        high,
        low,
        close,
        volume,
      });

      prevClose = close;
    }

    setChartData(data);
    setCurrentPrice(data[data.length - 1].close);
    setPriceChange(((data[data.length - 1].close - data[0].open) / data[0].open) * 100);
  };

  const getTimeLabel = (index: number, tf: Timeframe): string => {
    const now = new Date();
    let minutes = 0;

    switch (tf) {
      case "1H":
        minutes = index * 5;
        break;
      case "4H":
        minutes = index * 10;
        break;
      case "1D":
        minutes = index * 30;
        break;
      case "1W":
        minutes = index * 360;
        break;
      case "1M":
        minutes = index * 1440;
        break;
    }

    const time = new Date(now.getTime() - (dataPoints - index) * minutes * 60000);
    return time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const dataPoints = timeframe === "1H" ? 12 : timeframe === "4H" ? 24 : timeframe === "1D" ? 48 : timeframe === "1W" ? 28 : 30;

  const updateLivePrice = () => {
    setChartData((prev) => {
      if (prev.length === 0) return prev;
      
      const lastCandle = prev[prev.length - 1];
      const volatility = lastCandle.close * 0.005;
      const newClose = lastCandle.close + (Math.random() - 0.5) * volatility * 2;
      
      const updatedData = [...prev];
      updatedData[updatedData.length - 1] = {
        ...lastCandle,
        close: newClose,
        high: Math.max(lastCandle.high, newClose),
        low: Math.min(lastCandle.low, newClose),
      };

      setCurrentPrice(newClose);
      setPriceChange(((newClose - prev[0].open) / prev[0].open) * 100);
      
      return updatedData;
    });
  };

  const handleBuy = () => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    toast.success(`Buy order placed for ${buyAmount} ${symbol?.toUpperCase()}`);
    setBuyAmount("");
  };

  const handleSell = () => {
    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    toast.success(`Sell order placed for ${sellAmount} ${symbol?.toUpperCase()}`);
    setSellAmount("");
  };

  const CustomCandlestick = ({ data }: { data: CandleData[] }) => {
    // Add color based on price direction
    const dataWithColor = data.map(candle => ({
      ...candle,
      fill: candle.close >= candle.open ? "#10b981" : "#ef4444"
    }));

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={dataWithColor}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="time" 
            stroke="#888"
            style={{ fontSize: "12px" }}
          />
          <YAxis 
            stroke="#888"
            style={{ fontSize: "12px" }}
            domain={['dataMin - 50', 'dataMax + 50']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
            }}
            formatter={(value: number) => `$${value.toFixed(2)}`}
          />
          <Bar
            dataKey="close"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="high"
            stroke="#888"
            strokeWidth={1}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{symbol?.toUpperCase()}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={generateChartData}>
            <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        {/* Price Card */}
        <Card className="p-4 bg-gradient-to-br from-card to-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <h2 className="text-3xl font-bold">${currentPrice.toFixed(2)}</h2>
            </div>
            <div className={`flex items-center gap-2 ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
              {priceChange >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              <span className="text-2xl font-bold">{priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%</span>
            </div>
          </div>
        </Card>

        {/* Timeframe Filters */}
        <Card className="p-4">
          <div className="flex gap-2 overflow-x-auto">
            {(["1H", "4H", "1D", "1W", "1M"] as Timeframe[]).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf)}
                className="min-w-[60px]"
              >
                {tf}
              </Button>
            ))}
          </div>
        </Card>

        {/* Chart */}
        <Card className="p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Live Candlestick Chart
            </h3>
            <p className="text-sm text-muted-foreground">Real-time price movement</p>
          </div>
          <CustomCandlestick data={chartData} />
        </Card>

        {/* Buy/Sell Section */}
        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="buy-amount">Amount ({symbol?.toUpperCase()})</Label>
                  <Input
                    id="buy-amount"
                    type="number"
                    placeholder="0.00"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Total:</span>
                    <span className="font-semibold">
                      ${buyAmount ? (parseFloat(buyAmount) * currentPrice).toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleBuy}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  size="lg"
                >
                  Buy {symbol?.toUpperCase()}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="sell">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sell-amount">Amount ({symbol?.toUpperCase()})</Label>
                  <Input
                    id="sell-amount"
                    type="number"
                    placeholder="0.00"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Total:</span>
                    <span className="font-semibold">
                      ${sellAmount ? (parseFloat(sellAmount) * currentPrice).toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleSell}
                  className="w-full bg-red-500 hover:bg-red-600 text-white"
                  size="lg"
                >
                  Sell {symbol?.toUpperCase()}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default Trading;
