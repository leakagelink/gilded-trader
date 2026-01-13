import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, X, RefreshCcw, ArrowUp, ArrowDown, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BottomNav from "@/components/BottomNav";

interface Position {
  id: string;
  symbol: string;
  position_type: 'long' | 'short';
  amount: number;
  entry_price: number;
  current_price: number;
  leverage: number;
  margin: number;
  pnl: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
  close_price?: number;
  price_mode?: string;
}

const Positions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [closePositionId, setClosePositionId] = useState<string | null>(null);
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [closedSuccessId, setClosedSuccessId] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<Record<string, { direction: 'up' | 'down' | 'none'; flash: boolean }>>({});
  const previousPricesRef = useRef<Record<string, number>>({});
  const positionsRef = useRef<Position[]>([]);
  // Store base PnL for edited trades (admin-set values that don't change)
  const basePnlRef = useRef<Record<string, number>>({});
  // Refs to track closing state without causing useEffect rerenders
  const closingIdRef = useRef<string | null>(null);
  const closedSuccessIdRef = useRef<string | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    positionsRef.current = openPositions;
    // Initialize basePnlRef for edited trades from database values
    openPositions.forEach(pos => {
      if (pos.price_mode === 'edited' && basePnlRef.current[pos.id] === undefined) {
        basePnlRef.current[pos.id] = pos.pnl || 0;
      }
    });
  }, [openPositions]);

  // Sync closing state refs
  useEffect(() => {
    closingIdRef.current = closingPositionId;
  }, [closingPositionId]);

  useEffect(() => {
    closedSuccessIdRef.current = closedSuccessId;
  }, [closedSuccessId]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchPositions();
  }, [user, navigate]);

  // Real-time price updates for open positions
  const hasOpenPositions = openPositions.length > 0;
  
  useEffect(() => {
    if (!user || openPositions.length === 0) return;

    const updatePrices = async () => {
      try {
        // Always get fresh positions from ref, but filter out any that are being closed
        const currentPositions = positionsRef.current.filter(p => 
          p.status === 'open' && 
          closingIdRef.current !== p.id && 
          closedSuccessIdRef.current !== p.id
        );
        if (currentPositions.length === 0) return;

        // Define commodity symbols for detection
        const commoditySymbols = ['GOLD', 'XAU', 'SILVER', 'XAG', 'CRUDE', 'WTI', 'OIL', 'COPPER', 'PLATINUM', 'PALLADIUM', 'GAS', 'NATURALGAS'];

        // Fetch real crypto prices from CoinMarketCap for live trades
        let cryptoPrices: Record<string, number> = {};
        let cryptoFetchSuccess = false;
        try {
          const { data: cryptoData, error: cryptoError } = await supabase.functions.invoke('fetch-crypto-data');
          if (!cryptoError && cryptoData?.cryptoData && cryptoData.cryptoData.length > 0) {
            cryptoData.cryptoData.forEach((coin: any) => {
              const price = parseFloat(coin.price);
              if (price > 0) {
                cryptoPrices[coin.symbol.toUpperCase()] = price;
                cryptoFetchSuccess = true;
              }
            });
          }
        } catch (err) {
          console.error('Error fetching crypto prices:', err);
        }

        // Fetch commodity prices for live trades
        let commodityPrices: Record<string, number> = {};
        try {
          const { data: commodityData, error: commodityError } = await supabase.functions.invoke('fetch-commodities-data');
          if (!commodityError && commodityData?.commoditiesData) {
            commodityData.commoditiesData.forEach((commodity: any) => {
              commodityPrices[commodity.symbol.toUpperCase()] = parseFloat(commodity.price);
              // Also map alternative names
              if (commodity.symbol.toUpperCase() === 'XAU') commodityPrices['GOLD'] = parseFloat(commodity.price);
              if (commodity.symbol.toUpperCase() === 'XAG') commodityPrices['SILVER'] = parseFloat(commodity.price);
              if (commodity.symbol.toUpperCase() === 'WTI') commodityPrices['CRUDE'] = parseFloat(commodity.price);
              if (commodity.symbol.toUpperCase() === 'WTI') commodityPrices['OIL'] = parseFloat(commodity.price);
            });
          }
        } catch (err) {
          console.error('Error fetching commodity prices:', err);
        }
        
        const updatedPositions = await Promise.all(
          currentPositions.map(async (position) => {
            let currentPrice = position.current_price;
            let pnl: number;

            // Check if this is an edited trade (admin adjusted PnL)
            if (position.price_mode === 'edited') {
              // Get the base PnL from ref (admin-set value) - this is the stable reference value
              if (basePnlRef.current[position.id] === undefined) {
                basePnlRef.current[position.id] = position.pnl || 0;
              }
              const basePnl = basePnlRef.current[position.id];
              const isPositivePnl = basePnl >= 0;
              
              // Calculate base PnL percentage from margin
              const basePnlPercent = position.margin > 0 ? (basePnl / position.margin) * 100 : 0;
              
              // Add momentum: fluctuate ±5% around the base PnL percentage
              const momentumOffset = (Math.random() - 0.5) * 10; // -5% to +5%
              let adjustedPnlPercent = basePnlPercent + momentumOffset;
              
              // Keep the sign consistent with base PnL direction
              if (isPositivePnl && adjustedPnlPercent < 0) {
                adjustedPnlPercent = Math.abs(momentumOffset);
              } else if (!isPositivePnl && adjustedPnlPercent > 0) {
                adjustedPnlPercent = -Math.abs(momentumOffset);
              }
              
              // Calculate display PnL from adjusted percentage
              pnl = (adjustedPnlPercent / 100) * position.margin;
              
              // Calculate current price from PnL
              if (position.position_type === 'long') {
                currentPrice = position.entry_price + (pnl / (position.amount * position.leverage));
              } else {
                currentPrice = position.entry_price - (pnl / (position.amount * position.leverage));
              }
              
              // Ensure price doesn't go negative
              currentPrice = Math.max(0.0001, currentPrice);
              
              // DO NOT update database for edited trades - just update UI
              // Track price changes for visual indicators
              const previousPrice = previousPricesRef.current[position.id];
              if (previousPrice !== undefined && previousPrice !== currentPrice) {
                const direction = currentPrice > previousPrice ? 'up' : 'down';
                setPriceChanges(prev => ({ ...prev, [position.id]: { direction, flash: true } }));
                
                setTimeout(() => {
                  setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
                }, 500);
              }
              
              previousPricesRef.current[position.id] = currentPrice;
              
              return {
                ...position,
                current_price: currentPrice,
                pnl: pnl
              };
            } else if (position.price_mode === 'manual') {
              // Generate fake momentum between 1-5% for manual trades
              const randomPercent = (Math.random() * 4 + 1) * (Math.random() > 0.5 ? 1 : -1);
              currentPrice = position.entry_price * (1 + randomPercent / 100);
              
              // Calculate PnL for manual trades
              pnl = position.position_type === 'long'
                ? (currentPrice - position.entry_price) * position.amount * position.leverage
                : (position.entry_price - currentPrice) * position.amount * position.leverage;
            } else {
              // For live trades, use real market prices
              const isForex = position.symbol.includes('/');
              const isCommodity = commoditySymbols.some(c => position.symbol.toUpperCase().includes(c));
              
              let priceFound = false;
              
              if (isCommodity && commodityPrices[position.symbol.toUpperCase()]) {
                // Use commodity prices
                currentPrice = commodityPrices[position.symbol.toUpperCase()];
                priceFound = true;
              } else if (!isForex && !isCommodity && cryptoPrices[position.symbol.toUpperCase()]) {
                // Use crypto prices
                currentPrice = cryptoPrices[position.symbol.toUpperCase()];
                priceFound = true;
              } else if (isForex) {
                try {
                  const { data, error } = await supabase.functions.invoke('fetch-forex-data', {
                    body: { symbol: position.symbol }
                  });

                  if (!error && data?.currentPrice) {
                    currentPrice = data.currentPrice;
                    priceFound = true;
                  }
                } catch (err) {
                  console.error('Error fetching forex price:', err);
                }
              }

              // If API failed, generate simulated momentum for real-time feel
              // This ensures user always sees price movement even when APIs are rate-limited
              if (!priceFound || currentPrice <= 0) {
                // Use previous price or entry price as base
                const basePrice = previousPricesRef.current[position.id] || position.current_price || position.entry_price;
                // Generate small random momentum: ±0.1% to ±0.5% per second
                const momentumPercent = (Math.random() * 0.4 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
                currentPrice = basePrice * (1 + momentumPercent / 100);
                // Ensure price doesn't go negative
                currentPrice = Math.max(0.0001, currentPrice);
              }
              
              // Calculate PnL for live trades
              pnl = position.position_type === 'long'
                ? (currentPrice - position.entry_price) * position.amount * position.leverage
                : (position.entry_price - currentPrice) * position.amount * position.leverage;
            }

            // Track price changes for visual indicators (for non-edited trades)
            if (position.price_mode !== 'edited') {
              const previousPrice = previousPricesRef.current[position.id];
              if (previousPrice !== undefined && previousPrice !== currentPrice) {
                const direction = currentPrice > previousPrice ? 'up' : 'down';
                setPriceChanges(prev => ({ ...prev, [position.id]: { direction, flash: true } }));
                
                setTimeout(() => {
                  setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
                }, 500);
              }
              
              previousPricesRef.current[position.id] = currentPrice;

              // Update database only for non-edited trades
              supabase
                .from('positions')
                .update({ 
                  current_price: currentPrice,
                  pnl: pnl,
                  updated_at: new Date().toISOString()
                })
                .eq('id', position.id)
                .eq('status', 'open')
                .then(({ error }) => {
                  if (error) console.error('Error updating position:', error);
                });
            }

            return {
              ...position,
              current_price: currentPrice,
              pnl: pnl
            };
          })
        );

        // Update state immediately for real-time UI updates
        // Use functional update to preserve any positions that were removed during this update
        setOpenPositions(prev => {
          const closedIds = new Set(
            prev.filter(p => 
              p.status === 'closed' || 
              closingIdRef.current === p.id || 
              closedSuccessIdRef.current === p.id
            ).map(p => p.id)
          );
          // Filter out closed positions and merge with updated prices
          return updatedPositions.filter(p => !closedIds.has(p.id));
        });
      } catch (error) {
        console.error('Error updating prices:', error);
      }
    };

    // Update prices immediately and then every 1 second
    updatePrices();
    const interval = setInterval(updatePrices, 1000);

    return () => clearInterval(interval);
  }, [user, hasOpenPositions]);

  // Subscribe to real-time updates for position changes (when admin edits a trade)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('positions-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'positions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedPosition = payload.new as Position;
          console.log('Position updated via realtime:', updatedPosition.id, 'status:', updatedPosition.status, 'price_mode:', updatedPosition.price_mode);
          
          // If position was closed, move it from open to closed
          if (updatedPosition.status === 'closed') {
            // Remove from open positions
            setOpenPositions(prev => prev.filter(p => p.id !== updatedPosition.id));
            // Add to closed positions (avoid duplicates)
            setClosedPositions(prev => {
              const exists = prev.some(p => p.id === updatedPosition.id);
              if (exists) {
                return prev.map(p => p.id === updatedPosition.id ? updatedPosition : p);
              }
              return [updatedPosition, ...prev];
            });
            // Clean up refs
            delete previousPricesRef.current[updatedPosition.id];
            delete basePnlRef.current[updatedPosition.id];
            return;
          }
          
          // If admin edited this trade, update the basePnlRef with the new base value
          if (updatedPosition.price_mode === 'edited') {
            basePnlRef.current[updatedPosition.id] = updatedPosition.pnl || 0;
          }
          
          // Update the position in state with new data from database (only if still open)
          setOpenPositions(prev => 
            prev.map(p => 
              p.id === updatedPosition.id 
                ? { ...p, ...updatedPosition }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      
      const { data: open, error: openError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      const { data: closed, error: closedError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false });

      if (openError) throw openError;
      if (closedError) throw closedError;

      setOpenPositions(open || []);
      setClosedPositions(closed || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
      toast.error('Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (position: Position) => {
    try {
      // Start closing animation
      setClosingPositionId(position.id);
      
      const closePrice = position.current_price;
      const pnl = position.position_type === 'long' 
        ? (closePrice - position.entry_price) * position.amount * position.leverage
        : (position.entry_price - closePrice) * position.amount * position.leverage;

      const closedAt = new Date().toISOString();

      // Close position in database
      const { error } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          close_price: closePrice,
          pnl: pnl,
          closed_by: user?.id
        })
        .eq('id', position.id);

      if (error) throw error;

      // Show success animation
      setClosingPositionId(null);
      setClosedSuccessId(position.id);

      // Wait for animation to complete before moving to closed
      await new Promise(resolve => setTimeout(resolve, 800));

      // IMMEDIATELY update local state - move from open to closed
      const closedPosition: Position = {
        ...position,
        status: 'closed',
        closed_at: closedAt,
        close_price: closePrice,
        pnl: pnl
      };
      
      // Remove from open positions
      setOpenPositions(prev => prev.filter(p => p.id !== position.id));
      // Add to closed positions at the top
      setClosedPositions(prev => [closedPosition, ...prev]);
      
      // Clean up refs and animation state
      setClosedSuccessId(null);
      delete previousPricesRef.current[position.id];
      delete basePnlRef.current[position.id];

      // Get current wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .single();

      if (walletError) {
        console.error('Error fetching wallet:', walletError);
      } else {
        const currentBalance = wallet?.balance || 0;
        
        // Return margin + PnL to wallet
        const finalAmount = position.margin + pnl;
        const newBalance = currentBalance + finalAmount;

        await supabase
          .from('user_wallets')
          .update({ balance: newBalance })
          .eq('user_id', user?.id)
          .eq('currency', 'USD');

        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: user?.id,
          type: 'trade',
          amount: finalAmount,
          currency: 'USD',
          status: 'Completed',
          reference_id: position.id
        });
      }

      toast.success(`Position closed: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL. Wallet updated with $${(position.margin + pnl).toFixed(2)}`);
      setClosePositionId(null);
    } catch (error) {
      console.error('Error closing position:', error);
      toast.error('Failed to close position');
      setClosingPositionId(null);
      setClosedSuccessId(null);
    }
  };

  const calculatePnL = (position: Position) => {
    if (position.status === 'closed') {
      return position.pnl || 0;
    }
    
    if (position.position_type === 'long') {
      return (position.current_price - position.entry_price) * position.amount * position.leverage;
    } else {
      return (position.entry_price - position.current_price) * position.amount * position.leverage;
    }
  };

  const PositionCard = ({ position, showCloseButton = false }: { position: Position; showCloseButton?: boolean }) => {
    const pnl = calculatePnL(position);
    const isProfit = pnl >= 0;
    const isLong = position.position_type === 'long';
    const priceChange = priceChanges[position.id];
    const isClosing = closingPositionId === position.id;
    const isClosedSuccess = closedSuccessId === position.id;

    return (
      <Card className={`p-4 hover:shadow-lg transition-all duration-300 relative overflow-hidden ${
        isClosedSuccess ? 'scale-95 opacity-0 bg-green-500/20 border-green-500' : ''
      } ${isClosing ? 'opacity-70' : ''}`}>
        {/* Success overlay animation */}
        {isClosedSuccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 z-10 animate-fade-in">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-12 w-12 text-green-500 animate-scale-in" />
              <span className="text-green-500 font-bold text-lg">Position Closed!</span>
            </div>
          </div>
        )}
        
        {/* Loading overlay */}
        {isClosing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        )}
        
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isLong ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {isLong ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">{position.symbol}/USDT</h3>
              <span className={`text-sm font-semibold ${isLong ? 'text-green-500' : 'text-red-500'}`}>
                {position.position_type.toUpperCase()} {position.leverage}x
              </span>
            </div>
          </div>
          {showCloseButton && !isClosing && !isClosedSuccess && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setClosePositionId(position.id)}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-semibold">{position.amount} {position.symbol}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Entry Price</p>
            <p className="font-semibold">${position.entry_price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Price</p>
            <div className={`flex items-center gap-1 font-semibold transition-all duration-300 ${
              priceChange?.flash 
                ? priceChange.direction === 'up' 
                  ? 'text-green-500 animate-pulse' 
                  : 'text-red-500 animate-pulse'
                : ''
            }`}>
              <span className={`px-2 py-1 rounded transition-all duration-300 ${
                priceChange?.flash
                  ? priceChange.direction === 'up'
                    ? 'bg-green-500/20'
                    : 'bg-red-500/20'
                  : ''
              }`}>
                ${position.current_price.toFixed(2)}
              </span>
              {priceChange?.direction === 'up' && (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
              {priceChange?.direction === 'down' && (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Margin</p>
            <p className="font-semibold">${position.margin.toFixed(2)}</p>
          </div>
        </div>

        <div className={`mt-4 p-3 rounded-lg transition-all duration-300 ${
          priceChange?.flash
            ? priceChange.direction === 'up'
              ? 'bg-green-500/20 animate-pulse'
              : 'bg-red-500/20 animate-pulse'
            : isProfit ? 'bg-green-500/10' : 'bg-red-500/10'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">PnL</span>
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}${pnl.toFixed(2)}
              </span>
              {priceChange?.direction === 'up' && (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
              {priceChange?.direction === 'down' && (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          <p>Opened: {new Date(position.opened_at).toLocaleString()}</p>
          {position.closed_at && (
            <p>Closed: {new Date(position.closed_at).toLocaleString()}</p>
          )}
        </div>
      </Card>
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
          <h1 className="text-xl font-bold">My Positions</h1>
          <Button variant="ghost" size="icon" onClick={fetchPositions} disabled={loading}>
            <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {/* Total Portfolio P&L Card - Sticky */}
        {openPositions.length > 0 && (() => {
          const totalPnL = openPositions.reduce((sum, pos) => sum + calculatePnL(pos), 0);
          const isProfit = totalPnL >= 0;
          const totalMargin = openPositions.reduce((sum, pos) => sum + pos.margin, 0);
          const pnlPercentage = totalMargin > 0 ? (totalPnL / totalMargin) * 100 : 0;

          return (
            <div className="sticky top-16 z-40 -mx-4 px-4 pb-4 pt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <Card className={`p-4 sm:p-6 border-2 ${isProfit ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Total Portfolio P&L</h3>
                    <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                      <p className={`text-2xl sm:text-3xl font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {isProfit ? '+' : ''}${totalPnL.toFixed(2)}
                      </p>
                      <span className={`text-sm sm:text-lg font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        ({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Margin</p>
                    <p className="text-lg sm:text-xl font-semibold">${totalMargin.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Open Positions</p>
                      <p className="text-lg font-semibold">{openPositions.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Long</p>
                      <p className="text-lg font-semibold text-green-500">
                        {openPositions.filter(p => p.position_type === 'long').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Short</p>
                      <p className="text-lg font-semibold text-red-500">
                        {openPositions.filter(p => p.position_type === 'short').length}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="open" className="text-sm sm:text-base">
              Open Positions ({openPositions.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-sm sm:text-base">
              Closed Positions ({closedPositions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            {openPositions.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No open positions</p>
                <Button 
                  className="mt-4" 
                  onClick={() => navigate("/dashboard")}
                >
                  Start Trading
                </Button>
              </Card>
            ) : (
              openPositions.map(position => (
                <PositionCard 
                  key={position.id} 
                  position={position} 
                  showCloseButton={true}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {closedPositions.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No closed positions</p>
              </Card>
            ) : (
              closedPositions.map(position => (
                <PositionCard key={position.id} position={position} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Close Position Confirmation Dialog */}
      <AlertDialog open={!!closePositionId} onOpenChange={() => setClosePositionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Position?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this position? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const position = openPositions.find(p => p.id === closePositionId);
                if (position) handleClosePosition(position);
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Close Position
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

export default Positions;