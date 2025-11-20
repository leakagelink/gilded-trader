import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Activity, ChevronLeft, ChevronRight, ShoppingCart, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "recharts";

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

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
  const location = useLocation();
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [chartData, setChartData] = useState<CandleData[]>([]);
  
  // Safely parse initial price - handle both crypto ($123.45) and forex (1.5378) formats
  const parseInitialPrice = (priceStr: string | undefined): number => {
    if (!priceStr) return 0;
    const cleanPrice = String(priceStr).replace(/[$,]/g, '');
    const parsed = parseFloat(cleanPrice);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const initialPrice = parseInitialPrice(location.state?.price);
  const tradingName = location.state?.name || `${symbol?.toUpperCase()}`;
  const tradingIcon = location.state?.icon || location.state?.logo;
  
  const [currentPrice, setCurrentPrice] = useState<number>(initialPrice);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [liveCandle, setLiveCandle] = useState<CandleData | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [swipeIndicator, setSwipeIndicator] = useState<'left' | 'right' | null>(null);
  const prevPriceRef = useRef<number>(0);
  const liveUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showLongDialog, setShowLongDialog] = useState(false);
  const [showShortDialog, setShowShortDialog] = useState(false);
  const [tradeAmount, setTradeAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [chartScale, setChartScale] = useState(1);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartDistance = useRef<number>(0);

  // Swipe gesture handlers
  const navigateTimeframe = (direction: 'left' | 'right') => {
    const currentIndex = TIMEFRAMES.indexOf(timeframe);
    let newIndex: number;
    
    if (direction === 'left') {
      // Swipe left = next timeframe
      newIndex = currentIndex < TIMEFRAMES.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      // Swipe right = previous timeframe
      newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    }

    if (newIndex !== currentIndex) {
      setTimeframe(TIMEFRAMES[newIndex]);
      setSwipeIndicator(direction);
      toast.success(`Switched to ${TIMEFRAMES[newIndex].toUpperCase()} timeframe`, {
        duration: 1500,
      });
      
      // Clear indicator after animation
      setTimeout(() => setSwipeIndicator(null), 500);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => navigateTimeframe('left'),
    onSwipedRight: () => navigateTimeframe('right'),
    trackMouse: false, // Only track touch, not mouse
    trackTouch: true,
    delta: 50, // Minimum swipe distance
    preventScrollOnSwipe: false,
  });

  // Pinch to zoom handlers
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchStartDistance.current = getTouchDistance(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance.current > 0) {
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / touchStartDistance.current;
      const newScale = Math.min(Math.max(chartScale * scaleChange, 0.5), 3);
      setChartScale(newScale);
      touchStartDistance.current = currentDistance;
    }
  };

  const handleTouchEnd = () => {
    touchStartDistance.current = 0;
  };

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

  // Check if symbol is a forex pair
  const isForexPair = (sym: string) => {
    const forexSymbols = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'NZD', 'SGD'];
    return forexSymbols.includes(sym.toUpperCase());
  };

  const fetchRealTimeData = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      
      // Determine which API to use based on symbol type
      const isForex = isForexPair(symbol);
      const functionName = isForex ? 'fetch-forex-chart-data' : 'fetch-taapi-data';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
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
        
        // Set current price from latest candle or API - ensure it's a valid number
        const rawPrice = data.currentPrice || formattedData[formattedData.length - 1]?.close || 0;
        const latestPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice)) || 0;
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

  const handleOpenPosition = async (type: 'long' | 'short') => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const amount = parseFloat(tradeAmount);
      const margin = (amount * currentPrice) / leverage;

      const { error } = await supabase.from('positions').insert({
        user_id: user?.id,
        symbol: symbol?.toUpperCase(),
        position_type: type,
        amount: amount,
        entry_price: currentPrice,
        current_price: currentPrice,
        leverage: leverage,
        margin: margin,
        status: 'open'
      });

      if (error) throw error;

      toast.success(`${type.toUpperCase()} position opened: ${tradeAmount} ${symbol?.toUpperCase()} @ ${leverage}x leverage`);
      setTradeAmount("");
      setShowLongDialog(false);
      setShowShortDialog(false);
    } catch (error) {
      console.error('Error opening position:', error);
      toast.error('Failed to open position');
    }
  };

  const CustomCandlestick = ({ data }: { data: CandleData[] }) => {
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
                const data = payload[0]?.payload ?? {};
                const o = Number(data?.open ?? 0);
                const h = Number(data?.high ?? 0);
                const l = Number(data?.low ?? 0);
                const c = Number(data?.close ?? 0);
                const isGreen = c >= o;
                return (
                  <div className="bg-card border border-border p-3 rounded-lg">
                    {data?.isLive && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-green-500 font-semibold">LIVE</span>
                      </div>
                    )}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-medium">{data?.time ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Open:</span>
                        <span className="font-medium">${o.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">High:</span>
                        <span className="font-medium text-green-500">${h.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Low:</span>
                        <span className="font-medium text-red-500">${l.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Close:</span>
                        <span className={`font-medium ${isGreen ? 'text-green-500' : 'text-red-500'}`}>
                          ${c.toFixed(2)}
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
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {tradingIcon && (
              typeof tradingIcon === 'string' && tradingIcon.startsWith('http') ? (
                <img src={tradingIcon} alt={tradingName} className="h-6 w-6 rounded-full" />
              ) : (
                <span className="text-2xl">{tradingIcon}</span>
              )
            )}
            <h1 className="text-xl font-bold">{tradingName}</h1>
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
                className={`text-2xl sm:text-3xl md:text-4xl font-bold transition-all duration-300 ${
                  priceDirection === 'up' ? 'text-green-500 scale-110' : 
                  priceDirection === 'down' ? 'text-red-500 scale-110' : ''
                }`}
              >
                ${typeof currentPrice === 'number' ? currentPrice.toFixed(2) : '0.00'}
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
        <Card className="p-3 sm:p-4 relative overflow-hidden">
          {/* Swipe Indicators */}
          {swipeIndicator && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-300 ${
                swipeIndicator === 'left' 
                  ? 'right-4 animate-fade-in' 
                  : 'left-4 animate-fade-in'
              }`}
            >
              <div className="bg-primary/20 rounded-full p-2 backdrop-blur-sm">
                {swipeIndicator === 'left' ? (
                  <ChevronRight className="h-6 w-6 text-primary" />
                ) : (
                  <ChevronLeft className="h-6 w-6 text-primary" />
                )}
              </div>
            </div>
          )}
          
          <div className="text-center mb-2 text-xs text-muted-foreground sm:hidden">
            👉 Swipe left/right to change timeframe
          </div>
          
          <div 
            {...swipeHandlers}
            className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 touch-pan-x"
          >
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf)}
                className={`min-w-[50px] sm:min-w-[60px] text-xs sm:text-sm flex-shrink-0 transition-all duration-300 ${
                  timeframe === tf ? 'scale-110 shadow-lg' : ''
                }`}
              >
                {tf.toUpperCase()}
              </Button>
            ))}
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
                  Real-time price movement • {timeframe.toUpperCase()} interval • Pinch to zoom
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-green-500 font-semibold">Updating Live</span>
              </div>
            </div>
          </div>
          <div 
            ref={chartContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ transform: `scale(${chartScale})`, transformOrigin: 'center', transition: 'transform 0.1s' }}
          >
            {chartData.length > 0 ? (
              <CustomCandlestick data={chartData} />
            ) : (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">
                  {loading ? "Loading live chart data..." : "No data available"}
                </p>
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Sticky Bottom Long/Short Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-background/95 backdrop-blur-lg border-t border-border/40 p-3 sm:p-4 z-40 shadow-lg">
        <div className="container mx-auto flex gap-2 sm:gap-3 max-w-screen-lg">
          <Button
            onClick={() => setShowLongDialog(true)}
            className="flex-1 h-12 sm:h-14 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-sm sm:text-base md:text-lg shadow-lg touch-manipulation active:scale-95 transition-transform"
            size="lg"
          >
            <TrendingUp className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            LONG
          </Button>
          <Button
            onClick={() => setShowShortDialog(true)}
            className="flex-1 h-12 sm:h-14 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold text-sm sm:text-base md:text-lg shadow-lg touch-manipulation active:scale-95 transition-transform"
            size="lg"
          >
            <TrendingDown className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            SHORT
          </Button>
        </div>
      </div>

      {/* Long Position Dialog */}
      <Dialog open={showLongDialog} onOpenChange={setShowLongDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <TrendingUp className="h-5 w-5" />
              Open LONG Position
            </DialogTitle>
            <DialogDescription>
              Buy {symbol?.toUpperCase()} with leverage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="long-amount">Amount ({symbol?.toUpperCase()})</Label>
              <Input
                id="long-amount"
                type="number"
                placeholder="0.00"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="leverage">Leverage: {leverage}x</Label>
              <div className="flex items-center gap-4 mt-2">
                <Input
                  id="leverage"
                  type="range"
                  min="1"
                  max="100"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="font-bold text-lg w-12 text-right">{leverage}x</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1x</span>
                <span>100x</span>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="font-semibold">${typeof currentPrice === 'number' ? currentPrice.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin Required:</span>
                <span className="font-semibold">
                  ${tradeAmount ? ((parseFloat(tradeAmount) * currentPrice) / leverage).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Position Value:</span>
                <span className="font-semibold text-lg">
                  ${tradeAmount ? (parseFloat(tradeAmount) * currentPrice).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
            <Button
              onClick={() => handleOpenPosition('long')}
              className="w-full bg-green-500 hover:bg-green-600 text-white h-12"
              size="lg"
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              Open LONG Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Short Position Dialog */}
      <Dialog open={showShortDialog} onOpenChange={setShowShortDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <TrendingDown className="h-5 w-5" />
              Open SHORT Position
            </DialogTitle>
            <DialogDescription>
              Sell {symbol?.toUpperCase()} with leverage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="short-amount">Amount ({symbol?.toUpperCase()})</Label>
              <Input
                id="short-amount"
                type="number"
                placeholder="0.00"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="leverage-short">Leverage: {leverage}x</Label>
              <div className="flex items-center gap-4 mt-2">
                <Input
                  id="leverage-short"
                  type="range"
                  min="1"
                  max="100"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="font-bold text-lg w-12 text-right">{leverage}x</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1x</span>
                <span>100x</span>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="font-semibold">${typeof currentPrice === 'number' ? currentPrice.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin Required:</span>
                <span className="font-semibold">
                  ${tradeAmount ? ((parseFloat(tradeAmount) * currentPrice) / leverage).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Position Value:</span>
                <span className="font-semibold text-lg">
                  ${tradeAmount ? (parseFloat(tradeAmount) * currentPrice).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
            <Button
              onClick={() => handleOpenPosition('short')}
              className="w-full bg-red-500 hover:bg-red-600 text-white h-12"
              size="lg"
            >
              <TrendingDown className="mr-2 h-5 w-5" />
              Open SHORT Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Trading;
