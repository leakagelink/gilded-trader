import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Activity } from "lucide-react";
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
  Cell,
  ReferenceLine,
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
  isLive?: boolean;
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
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const prevPriceRef = useRef<number>(0);
  const liveUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Technical indicators state
  const [showMA7, setShowMA7] = useState(true);
  const [showMA25, setShowMA25] = useState(true);
  const [showMA99, setShowMA99] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    fetchRealTimeData();
    
    return () => {
      if (liveUpdateIntervalRef.current) {
        clearInterval(liveUpdateIntervalRef.current);
      }
    };
  }, [user, timeframe, navigate, symbol]);

  useEffect(() => {
    // Start aggressive live updates after data is loaded
    if (chartData.length > 0 && liveCandle) {
      if (liveUpdateIntervalRef.current) {
        clearInterval(liveUpdateIntervalRef.current);
      }
      
      // Update every 1 second for visible live movement
      liveUpdateIntervalRef.current = setInterval(() => {
        updateLiveCandle();
      }, 1000);
    }

    return () => {
      if (liveUpdateIntervalRef.current) {
        clearInterval(liveUpdateIntervalRef.current);
      }
    };
  }, [chartData.length, liveCandle?.timestamp]);

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
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch data. Please try again.');
        return;
      }

      if (data?.candles && data.candles.length > 0) {
        // Show data source to user
        if (data.source === 'fallback') {
          toast.info('Using simulated live data', {
            duration: 2000
          });
        }

        const formattedData: CandleData[] = data.candles.map((candle: any, index: number) => ({
          time: new Date(candle.timestampHuman || candle.timestamp * 1000).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0,
          timestamp: candle.timestamp,
          isLive: index === data.candles.length - 1, // Mark last candle as live
        }));

        setChartData(formattedData);
        
        // Set current price from latest candle or API
        const latestPrice = data.currentPrice || formattedData[formattedData.length - 1]?.close || 0;
        setCurrentPrice(latestPrice);
        prevPriceRef.current = latestPrice;
        
        // Calculate price change
        const firstPrice = formattedData[0]?.open || latestPrice;
        const change = ((latestPrice - firstPrice) / firstPrice) * 100;
        setPriceChange(change);

        // Initialize live candle
        const lastCandle = formattedData[formattedData.length - 1];
        if (lastCandle) {
          setLiveCandle({ ...lastCandle, isLive: true });
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

    // More aggressive volatility for visible movement
    const volatility = liveCandle.close * 0.002; // 0.2% volatility per update
    const randomChange = (Math.random() - 0.5) * volatility * 2;
    const newClose = liveCandle.close + randomChange;
    
    // Update price direction for animation
    const prevPrice = prevPriceRef.current;
    if (newClose > prevPrice) {
      setPriceDirection('up');
    } else if (newClose < prevPrice) {
      setPriceDirection('down');
    }
    prevPriceRef.current = newClose;
    
    const updatedCandle: CandleData = {
      ...liveCandle,
      close: newClose,
      high: Math.max(liveCandle.high, newClose),
      low: Math.min(liveCandle.low, newClose),
      isLive: true,
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

    // Reset direction after animation
    setTimeout(() => setPriceDirection('neutral'), 500);
  };

  // Calculate Simple Moving Average
  const calculateSMA = (data: CandleData[], period: number) => {
    return data.map((item, index) => {
      if (index < period - 1) return null;
      const sum = data.slice(index - period + 1, index + 1).reduce((acc, d) => acc + d.close, 0);
      return sum / period;
    });
  };

  // Calculate RSI
  const calculateRSI = (data: CandleData[], period: number = 14) => {
    const rsi: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        rsi.push(null);
        continue;
      }
      let gains = 0;
      let losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = data[j].close - data[j - 1].close;
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgGain / (avgLoss || 1);
      rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
  };

  // Calculate MACD
  const calculateMACD = (data: CandleData[]) => {
    const ema12 = calculateEMA(data.map(d => d.close), 12);
    const ema26 = calculateEMA(data.map(d => d.close), 26);
    const macdLine = ema12.map((val, i) => val !== null && ema26[i] !== null ? val - ema26[i] : null);
    const signalLine = calculateEMA(macdLine.filter(v => v !== null) as number[], 9);
    return { macdLine, signalLine };
  };

  const calculateEMA = (data: number[], period: number) => {
    const ema: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sum += data[i];
        ema.push(null);
      } else if (i === period - 1) {
        sum += data[i];
        ema.push(sum / period);
      } else {
        const prevEma = ema[i - 1] as number;
        ema.push((data[i] - prevEma) * multiplier + prevEma);
      }
    }
    return ema;
  };

  // Add indicators to chart data
  const enrichDataWithIndicators = (data: CandleData[]) => {
    const ma7 = calculateSMA(data, 7);
    const ma25 = calculateSMA(data, 25);
    const ma99 = calculateSMA(data, 99);
    const rsi = calculateRSI(data);
    const { macdLine, signalLine } = calculateMACD(data);

    return data.map((item, index) => ({
      ...item,
      ma7: ma7[index],
      ma25: ma25[index],
      ma99: ma99[index],
      rsi: rsi[index],
      macd: macdLine[index],
      signal: signalLine[index],
    }));
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

  const CustomCandlestick = ({ data }: { data: any[] }) => {
    const CandleShape = (props: any) => {
      const { x, y, width, height, payload } = props;
      const { open, close, high, low, isLive } = payload;
      
      const isGreen = close >= open;
      const color = isLive ? "#10b981" : (isGreen ? "#10b981" : "#ef4444");
      
      // Calculate positions
      const wickX = x + width / 2;
      const bodyTop = Math.min(open, close);
      const bodyBottom = Math.max(open, close);
      const bodyHeight = Math.abs(close - open);
      
      // Scale for price to Y coordinate
      const getY = (price: number) => {
        const chartHeight = 400;
        const minPrice = Math.min(...data.map(d => d.low));
        const maxPrice = Math.max(...data.map(d => d.high));
        const priceRange = maxPrice - minPrice;
        return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 40) - 20;
      };
      
      return (
        <g className={isLive ? "animate-pulse" : ""}>
          {/* Wick (high to low) */}
          <line
            x1={wickX}
            y1={getY(high)}
            x2={wickX}
            y2={getY(low)}
            stroke={color}
            strokeWidth={1.5}
          />
          {/* Body (open to close) */}
          <rect
            x={x + width * 0.2}
            y={getY(bodyBottom)}
            width={width * 0.6}
            height={Math.max(getY(bodyTop) - getY(bodyBottom), 1)}
            fill={color}
            stroke={color}
            strokeWidth={1}
            opacity={isLive ? 0.9 : 0.8}
          />
          {isLive && (
            <rect
              x={x + width * 0.2}
              y={getY(bodyBottom)}
              width={width * 0.6}
              height={Math.max(getY(bodyTop) - getY(bodyBottom), 1)}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              opacity={0.6}
            />
          )}
        </g>
      );
    };

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <defs>
            <linearGradient id="liveGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis 
            dataKey="time" 
            stroke="#888"
            style={{ fontSize: "10px" }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#888"
            style={{ fontSize: "12px" }}
            domain={['dataMin - 100', 'dataMax + 100']}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: "12px"
            }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                if (!data || typeof data.open === 'undefined' || typeof data.close === 'undefined') {
                  return null;
                }
                const isGreen = data.close >= data.open;
                return (
                  <div className="bg-card border border-border p-3 rounded-lg">
                    {data.isLive && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-green-500 font-semibold">LIVE</span>
                      </div>
                    )}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-medium">{data.time || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Open:</span>
                        <span className="font-medium">${(data.open || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">High:</span>
                        <span className="font-medium text-green-500">${(data.high || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Low:</span>
                        <span className="font-medium text-red-500">${(data.low || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Close:</span>
                        <span className={`font-medium ${isGreen ? 'text-green-500' : 'text-red-500'}`}>
                          ${(data.close || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="close"
            shape={<CandleShape />}
            animationDuration={300}
          />
          {showMA7 && (
            <Line
              type="monotone"
              dataKey="ma7"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="MA(7)"
            />
          )}
          {showMA25 && (
            <Line
              type="monotone"
              dataKey="ma25"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="MA(25)"
            />
          )}
          {showMA99 && (
            <Line
              type="monotone"
              dataKey="ma99"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="MA(99)"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const RSIChart = ({ data }: { data: any[] }) => (
    <ResponsiveContainer width="100%" height={150}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
        <XAxis dataKey="time" stroke="#888" style={{ fontSize: "10px" }} hide />
        <YAxis stroke="#888" style={{ fontSize: "10px" }} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
          }}
        />
        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
        <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="rsi"
          stroke="#a855f7"
          strokeWidth={2}
          dot={false}
          name="RSI(14)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const MACDChart = ({ data }: { data: any[] }) => (
    <ResponsiveContainer width="100%" height={150}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
        <XAxis dataKey="time" stroke="#888" style={{ fontSize: "10px" }} hide />
        <YAxis stroke="#888" style={{ fontSize: "10px" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="macd"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="MACD"
        />
        <Line
          type="monotone"
          dataKey="signal"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          name="Signal"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

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
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4 text-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-semibold">LIVE</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchRealTimeData} disabled={loading}>
            <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        {/* Price Card with Live Animation */}
        <Card className="p-4 bg-gradient-to-br from-card to-muted/50 border-2 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-muted-foreground">Current Price</p>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              </div>
              <h2 
                className={`text-4xl font-bold transition-all duration-300 ${
                  priceDirection === 'up' ? 'text-green-500 scale-110' : 
                  priceDirection === 'down' ? 'text-red-500 scale-110' : ''
                }`}
              >
                ${currentPrice.toFixed(2)}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Updates every second</p>
            </div>
            <div className={`flex flex-col items-end gap-1 transition-all duration-300 ${
              priceChange >= 0 ? "text-green-500" : "text-red-500"
            }`}>
              <div className="flex items-center gap-2">
                {priceChange >= 0 ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
              </div>
              <span className="text-3xl font-bold">{priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%</span>
              <span className="text-xs">24h Change</span>
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

        {/* Technical Indicators Controls */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Technical Indicators</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="ma7" className="text-xs flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-500"></span>
                MA(7)
              </Label>
              <Switch id="ma7" checked={showMA7} onCheckedChange={setShowMA7} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ma25" className="text-xs flex items-center gap-1">
                <span className="w-3 h-0.5 bg-amber-500"></span>
                MA(25)
              </Label>
              <Switch id="ma25" checked={showMA25} onCheckedChange={setShowMA25} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ma99" className="text-xs flex items-center gap-1">
                <span className="w-3 h-0.5 bg-violet-500"></span>
                MA(99)
              </Label>
              <Switch id="ma99" checked={showMA99} onCheckedChange={setShowMA99} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rsi" className="text-xs flex items-center gap-1">
                <span className="w-3 h-0.5 bg-purple-500"></span>
                RSI(14)
              </Label>
              <Switch id="rsi" checked={showRSI} onCheckedChange={setShowRSI} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="macd" className="text-xs">MACD</Label>
              <Switch id="macd" checked={showMACD} onCheckedChange={setShowMACD} />
            </div>
          </div>
        </Card>

        {/* Chart */}
        <Card className="p-4">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Live Candlestick Chart
                </h3>
                <p className="text-sm text-muted-foreground">
                  Real-time price movement • {timeframe.toUpperCase()} interval
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-green-500 font-semibold">Updating Live</span>
              </div>
            </div>
          </div>
          {chartData.length > 0 ? (
            <>
              <CustomCandlestick data={enrichDataWithIndicators(chartData)} />
              {showRSI && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">RSI (Relative Strength Index)</h4>
                  <RSIChart data={enrichDataWithIndicators(chartData)} />
                </div>
              )}
              {showMACD && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">MACD</h4>
                  <MACDChart data={enrichDataWithIndicators(chartData)} />
                </div>
              )}
            </>
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">
                {loading ? "Loading live chart data..." : "No data available"}
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
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-semibold">${currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Total:</span>
                    <span className="font-semibold text-lg">
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
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-semibold">${currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Total:</span>
                    <span className="font-semibold text-lg">
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
