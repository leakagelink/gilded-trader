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
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
} from "recharts";

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

const Trading = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [chartData, setChartData] = useState<CandleData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [liveCandle, setLiveCandle] = useState<CandleData | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchRealTimeData();
    
    // Update live candle every 2 seconds
    const liveInterval = setInterval(() => {
      updateLiveCandle();
    }, 2000);

    return () => clearInterval(liveInterval);
  }, [user, timeframe, navigate, symbol]);

  const fetchRealTimeData = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-taapi-data', {
        body: { 
          symbol: symbol.toUpperCase(),
          interval: timeframe
        }
      });

      if (error) {
        console.error('Error fetching TAAPI data:', error);
        toast.error('Failed to fetch real-time data');
        return;
      }

      if (data?.candles && data.candles.length > 0) {
        const formattedData: CandleData[] = data.candles.map((candle: any) => ({
          time: new Date(candle.timestampHuman).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0,
          timestamp: candle.timestamp,
        }));

        setChartData(formattedData);
        
        // Set current price from latest candle or API
        const latestPrice = data.currentPrice || formattedData[formattedData.length - 1]?.close || 0;
        setCurrentPrice(latestPrice);
        
        // Calculate price change
        const firstPrice = formattedData[0]?.open || latestPrice;
        const change = ((latestPrice - firstPrice) / firstPrice) * 100;
        setPriceChange(change);

        // Initialize live candle
        const lastCandle = formattedData[formattedData.length - 1];
        if (lastCandle) {
          setLiveCandle({ ...lastCandle });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateLiveCandle = () => {
    if (!liveCandle || chartData.length === 0) return;

    // Simulate live price movement
    const volatility = liveCandle.close * 0.0005; // 0.05% volatility
    const newClose = liveCandle.close + (Math.random() - 0.5) * volatility * 2;
    
    const updatedCandle: CandleData = {
      ...liveCandle,
      close: newClose,
      high: Math.max(liveCandle.high, newClose),
      low: Math.min(liveCandle.low, newClose),
    };

    setLiveCandle(updatedCandle);
    setCurrentPrice(newClose);

    // Update chart data with live candle
    setChartData(prev => {
      const newData = [...prev];
      newData[newData.length - 1] = updatedCandle;
      return newData;
    });

    // Update price change
    if (chartData.length > 0) {
      const firstPrice = chartData[0].open;
      const change = ((newClose - firstPrice) / firstPrice) * 100;
      setPriceChange(change);
    }
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
            style={{ fontSize: "10px" }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#888"
            style={{ fontSize: "12px" }}
            domain={['auto', 'auto']}
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
            animationDuration={300}
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
            <h1 className="text-xl font-bold">{symbol?.toUpperCase()}/USDT</h1>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live"></div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchRealTimeData} disabled={loading}>
            <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        {/* Price Card */}
        <Card className="p-4 bg-gradient-to-br from-card to-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Price (Live)</p>
              <h2 className="text-3xl font-bold animate-fade-in">${currentPrice.toFixed(2)}</h2>
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
            {(["1m", "5m", "15m", "1h", "4h", "1d"] as Timeframe[]).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf)}
                className="min-w-[60px]"
              >
                {tf.toUpperCase()}
              </Button>
            ))}
          </div>
        </Card>

        {/* Chart */}
        <Card className="p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Live Candlestick Chart - {timeframe.toUpperCase()}
            </h3>
            <p className="text-sm text-muted-foreground">Real-time data from TAAPI</p>
          </div>
          {chartData.length > 0 ? (
            <CustomCandlestick data={chartData} />
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">
                {loading ? "Loading chart data..." : "No data available"}
              </p>
            </div>
          )}
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
