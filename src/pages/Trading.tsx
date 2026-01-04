import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Activity, ChevronLeft, ChevronRight, ShoppingCart, DollarSign, ExternalLink } from "lucide-react";
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
  const currencySymbol = location.state?.currencySymbol || '$';
  
  const [currentPrice, setCurrentPrice] = useState<number>(0); // Start with 0, will be set from API
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [liveCandle, setLiveCandle] = useState<CandleData | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [swipeIndicator, setSwipeIndicator] = useState<'left' | 'right' | null>(null);
  const prevPriceRef = useRef<number>(0);
  const liveUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showLongDialog, setShowLongDialog] = useState(false);
  const [showShortDialog, setShowShortDialog] = useState(false);
  const [tradeAmount, setTradeAmount] = useState(""); // USD amount
  const [leverage, setLeverage] = useState(1);
  const [chartScale, setChartScale] = useState(1);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartDistance = useRef<number>(0);

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    if (!user?.id) return;
    
    const { data: wallet, error } = await supabase
      .from('user_wallets')
      .select('balance')
      .eq('user_id', user.id)
      .eq('currency', 'USD')
      .maybeSingle();
    
    if (!error && wallet) {
      setWalletBalance(wallet.balance || 0);
    }
  };

  // Fetch balance when dialogs open
  useEffect(() => {
    if (showLongDialog || showShortDialog) {
      fetchWalletBalance();
    }
  }, [showLongDialog, showShortDialog]);

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

  // Check if symbol is a commodity
  const isCommodity = (sym: string) => {
    const commoditySymbols = ['XAU', 'XAG', 'WTI', 'NG', 'HG', 'XPT', 'XPD', 'BRENT'];
    return commoditySymbols.includes(sym.toUpperCase());
  };

  // Generate TradingView URL based on symbol type
  const getTradingViewUrl = () => {
    const sym = symbol?.toUpperCase() || 'BTC';
    
    if (isForexPair(sym)) {
      // Forex pairs - use FX exchange
      return `https://www.tradingview.com/chart/?symbol=FX%3A${sym}USD`;
    } else if (isCommodity(sym)) {
      // Commodities
      const commodityMap: Record<string, string> = {
        'XAU': 'OANDA:XAUUSD',
        'XAG': 'OANDA:XAGUSD',
        'WTI': 'NYMEX:CL1!',
        'NG': 'NYMEX:NG1!',
        'HG': 'COMEX:HG1!',
        'XPT': 'OANDA:XPTUSD',
        'XPD': 'OANDA:XPDUSD',
        'BRENT': 'ICEEUR:BRN1!',
      };
      const tradingViewSymbol = commodityMap[sym] || `TVC:${sym}`;
      return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`;
    } else {
      // Crypto - use BINANCE exchange
      return `https://www.tradingview.com/chart/?symbol=BINANCE%3A${sym}USDT`;
    }
  };

  const fetchRealTimeData = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      
      // Determine which API to use based on symbol type
      const isForex = isForexPair(symbol);
      
      // For crypto, first get the real current price from CoinMarketCap
      let realCurrentPrice = 0; // Start with 0, only use API price
      
      if (!isForex) {
        try {
          const { data: cryptoData, error: cryptoError } = await supabase.functions.invoke('fetch-crypto-data');
          
          if (!cryptoError && cryptoData?.cryptoData) {
            const coin = cryptoData.cryptoData.find((c: any) => c.symbol.toUpperCase() === symbol.toUpperCase());
            if (coin) {
              realCurrentPrice = parseFloat(coin.price);
              console.log('Real CoinMarketCap price for', symbol, ':', realCurrentPrice);
            }
          }
        } catch (err) {
          console.error('Error fetching real crypto price:', err);
        }
      }
      
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
        console.log('Chart data received:', {
          candleCount: data.candles.length,
          currentPrice: data.currentPrice,
          source: data.source,
          realCurrentPrice,
          isForex
        });
        
        // For crypto using fallback data, adjust candles to match real CoinMarketCap price
        let adjustedCandles = data.candles;
        if (!isForex && data.source === 'fallback' && realCurrentPrice > 0) {
          // Calculate adjustment ratio based on real vs fallback price
          const fallbackPrice = data.currentPrice || data.candles[data.candles.length - 1]?.close;
          const adjustmentRatio = realCurrentPrice / fallbackPrice;
          
          console.log('Adjusting fallback candles to real price:', {
            fallbackPrice,
            realCurrentPrice,
            adjustmentRatio
          });
          
          // Adjust all candle prices to match real market price
          adjustedCandles = data.candles.map((candle: any) => ({
            ...candle,
            open: candle.open * adjustmentRatio,
            high: candle.high * adjustmentRatio,
            low: candle.low * adjustmentRatio,
            close: candle.close * adjustmentRatio,
          }));
        }

        const formattedData: CandleData[] = adjustedCandles.map((candle: any, index: number) => {
          // Ensure all candle values are valid numbers
          const open = typeof candle.open === 'number' ? candle.open : parseFloat(candle.open) || 0;
          const high = typeof candle.high === 'number' ? candle.high : parseFloat(candle.high) || 0;
          const low = typeof candle.low === 'number' ? candle.low : parseFloat(candle.low) || 0;
          const close = typeof candle.close === 'number' ? candle.close : parseFloat(candle.close) || 0;
          
          return {
            time: new Date(candle.timestampHuman || candle.timestamp * 1000).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            open,
            high,
            low,
            close,
            volume: candle.volume || 0,
            timestamp: candle.timestamp,
            isLive: index === adjustedCandles.length - 1, // Mark last candle as live
          };
        });

        setChartData(formattedData);
        
        // Set current price - for crypto ONLY use CoinMarketCap price, for forex use API price
        let latestPrice = 0;
        
        if (isForex) {
          // For forex, use the chart data price
          const rawPrice = data.currentPrice || formattedData[formattedData.length - 1]?.close || 0;
          latestPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice)) || 0;
        } else {
          // For crypto, ONLY use CoinMarketCap real price - don't show fake TAAPI price
          if (realCurrentPrice > 0) {
            latestPrice = realCurrentPrice;
          } else {
            // If CoinMarketCap failed, don't show any price - keep loading
            console.error('Failed to get real crypto price from CoinMarketCap');
            toast.error('Failed to fetch real-time price. Please refresh.');
            setLoading(false);
            return;
          }
        }
        
        console.log('Setting current price:', {
          latestPrice,
          realCurrentPrice,
          isForex,
          isValid: latestPrice > 0
        });
        
        if (latestPrice > 0) {
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
      } else {
        console.error('No candle data received');
        toast.error('No data available for this symbol');
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

    // Ensure liveCandle.close is a valid number
    const currentClose = typeof liveCandle.close === 'number' && !isNaN(liveCandle.close) && liveCandle.close > 0 
      ? liveCandle.close 
      : currentPrice || 1;

    // More aggressive volatility for visible movement
    const volatility = currentClose * 0.002; // 0.2% volatility per update
    const randomChange = (Math.random() - 0.5) * volatility * 2;
    const newClose = currentClose + randomChange;
    
    // Validate newClose is a valid number
    if (!isFinite(newClose) || newClose <= 0) {
      console.error('Invalid newClose value:', newClose);
      return;
    }
    
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
      high: Math.max(liveCandle.high || newClose, newClose),
      low: Math.min(liveCandle.low || newClose, newClose),
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
      toast.error("Please enter a valid USD amount");
      return;
    }

    try {
      const usdAmount = parseFloat(tradeAmount); // User enters USD amount
      const margin = usdAmount / leverage; // Margin is the USD amount divided by leverage
      const assetQuantity = usdAmount / currentPrice; // Calculate asset quantity from USD

      // Check wallet balance first
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .maybeSingle();

      if (walletError) {
        toast.error('Failed to check wallet balance');
        return;
      }

      const currentBalance = wallet?.balance || 0;
      
      if (currentBalance < margin) {
        toast.error(`Insufficient balance. Required: $${margin.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
        return;
      }

      // Deduct margin from wallet
      const { error: updateError } = await supabase
        .from('user_wallets')
        .update({ balance: currentBalance - margin })
        .eq('user_id', user?.id)
        .eq('currency', 'USD');

      if (updateError) throw updateError;

      // Open position - amount is asset quantity, margin is USD
      const { error } = await supabase.from('positions').insert({
        user_id: user?.id,
        symbol: symbol?.toUpperCase(),
        position_type: type,
        amount: assetQuantity, // Store asset quantity
        entry_price: currentPrice,
        current_price: currentPrice,
        leverage: leverage,
        margin: margin, // USD margin
        status: 'open'
      });

      if (error) {
        // Rollback wallet deduction if position creation fails
        await supabase
          .from('user_wallets')
          .update({ balance: currentBalance })
          .eq('user_id', user?.id)
          .eq('currency', 'USD');
        throw error;
      }

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        user_id: user?.id,
        type: 'trade',
        amount: margin,
        currency: 'USD',
        status: 'Completed',
        reference_id: null
      });

      toast.success(`${type.toUpperCase()} position opened: $${usdAmount.toFixed(2)} (${assetQuantity.toFixed(6)} ${symbol?.toUpperCase()}). Margin: $${margin.toFixed(2)}`);
      setTradeAmount("");
      setShowLongDialog(false);
      setShowShortDialog(false);
      fetchWalletBalance(); // Refresh balance
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
                        <span className="font-medium">{currencySymbol}{o.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">High:</span>
                        <span className="font-medium text-green-500">{currencySymbol}{h.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Low:</span>
                        <span className="font-medium text-red-500">{currencySymbol}{l.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Close:</span>
                        <span className={`font-medium ${isGreen ? 'text-green-500' : 'text-red-500'}`}>
                          {currencySymbol}{c.toFixed(2)}
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
              {loading || currentPrice === 0 ? (
                <div className="h-10 w-32 bg-muted animate-pulse rounded-md"></div>
              ) : (
                <h2 
                  className={`text-2xl sm:text-3xl md:text-4xl font-bold transition-all duration-300 ${
                    priceDirection === 'up' ? 'text-green-500 scale-110' : 
                    priceDirection === 'down' ? 'text-red-500 scale-110' : ''
                  }`}
                >
                  {currencySymbol}{currentPrice.toFixed(2)}
                </h2>
              )}
              <p className="text-xs text-muted-foreground mt-1">Updates every second</p>
            </div>
            {loading || currentPrice === 0 ? (
              <div className="flex flex-col items-end gap-2">
                <div className="h-8 w-8 bg-muted animate-pulse rounded-md"></div>
                <div className="h-8 w-20 bg-muted animate-pulse rounded-md"></div>
              </div>
            ) : (
              <div className={`flex flex-col items-end gap-1 transition-all duration-300 ${
                priceChange >= 0 ? "text-green-500" : "text-red-500"
              }`}>
                <div className="flex items-center gap-2">
                  {priceChange >= 0 ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
                </div>
                <span className="text-3xl font-bold">{priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%</span>
                <span className="text-xs">24h Change</span>
              </div>
            )}
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
          
          {/* View Full Chart Link */}
          <div className="mt-4 flex justify-center">
            <a
              href={getTradingViewUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-medium text-sm transition-all hover:scale-105"
            >
              <ExternalLink className="h-4 w-4" />
              View Full Chart on TradingView
            </a>
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
              Buy {symbol?.toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Available Balance */}
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Balance:</span>
                <span className="font-bold text-lg text-primary">${walletBalance.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="long-amount">Trade Amount (USD)</Label>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="long-amount"
                  type="number"
                  placeholder="Enter USD amount (e.g., 20, 50, 100)"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Enter the amount in USD you want to trade</p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="font-semibold">{currencySymbol}{typeof currentPrice === 'number' ? currentPrice.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Asset Quantity:</span>
                <span className="font-semibold">
                  {tradeAmount && currentPrice > 0 ? (parseFloat(tradeAmount) / currentPrice).toFixed(6) : "0.000000"} {symbol?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin Required:</span>
                <span className="font-semibold">
                  ${tradeAmount ? (parseFloat(tradeAmount) / leverage).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Position Value:</span>
                <span className="font-semibold text-lg text-green-500">
                  ${tradeAmount ? parseFloat(tradeAmount).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
            <Button
              onClick={() => handleOpenPosition('long')}
              className="w-full bg-green-500 hover:bg-green-600 text-white h-12"
              size="lg"
              disabled={!tradeAmount || parseFloat(tradeAmount) <= 0 || parseFloat(tradeAmount) / leverage > walletBalance}
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
              Sell {symbol?.toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Available Balance */}
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Balance:</span>
                <span className="font-bold text-lg text-primary">${walletBalance.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="short-amount">Trade Amount (USD)</Label>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="short-amount"
                  type="number"
                  placeholder="Enter USD amount (e.g., 20, 50, 100)"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Enter the amount in USD you want to trade</p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="font-semibold">{currencySymbol}{typeof currentPrice === 'number' ? currentPrice.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Asset Quantity:</span>
                <span className="font-semibold">
                  {tradeAmount && currentPrice > 0 ? (parseFloat(tradeAmount) / currentPrice).toFixed(6) : "0.000000"} {symbol?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin Required:</span>
                <span className="font-semibold">
                  ${tradeAmount ? (parseFloat(tradeAmount) / leverage).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Position Value:</span>
                <span className="font-semibold text-lg text-red-500">
                  ${tradeAmount ? parseFloat(tradeAmount).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
            <Button
              onClick={() => handleOpenPosition('short')}
              className="w-full bg-red-500 hover:bg-red-600 text-white h-12"
              size="lg"
              disabled={!tradeAmount || parseFloat(tradeAmount) <= 0 || parseFloat(tradeAmount) / leverage > walletBalance}
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
