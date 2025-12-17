import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, X, RefreshCcw, ArrowUp, ArrowDown } from "lucide-react";
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
  const [priceChanges, setPriceChanges] = useState<Record<string, { direction: 'up' | 'down' | 'none'; flash: boolean }>>({});
  const previousPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchPositions();
  }, [user, navigate]);

  // Real-time price updates for open positions
  useEffect(() => {
    if (!user || openPositions.length === 0) return;

    const updatePrices = async () => {
      try {
        // Fetch real crypto prices from CoinMarketCap for live trades
        let cryptoPrices: Record<string, number> = {};
        try {
          const { data: cryptoData, error: cryptoError } = await supabase.functions.invoke('fetch-crypto-data');
          if (!cryptoError && cryptoData?.cryptoData) {
            cryptoData.cryptoData.forEach((coin: any) => {
              cryptoPrices[coin.symbol.toUpperCase()] = parseFloat(coin.price);
            });
          }
        } catch (err) {
          console.error('Error fetching crypto prices:', err);
        }
        
        const updatedPositions = await Promise.all(
          openPositions.map(async (position) => {
            let currentPrice = position.current_price;

            // Check if this is a manual trade
            if (position.price_mode === 'manual') {
              // Generate fake momentum between 1-5% for manual trades
              const randomPercent = (Math.random() * 4 + 1) * (Math.random() > 0.5 ? 1 : -1); // 1-5% up or down
              currentPrice = position.entry_price * (1 + randomPercent / 100);
            } else {
              // For live trades, use real market prices
              const isForex = position.symbol.includes('/');
              
              if (!isForex && cryptoPrices[position.symbol.toUpperCase()]) {
                // For crypto, use real CoinMarketCap price
                currentPrice = cryptoPrices[position.symbol.toUpperCase()];
              } else if (isForex) {
                // For forex, use forex data
                try {
                  const { data, error } = await supabase.functions.invoke('fetch-forex-data', {
                    body: { symbol: position.symbol }
                  });

                  if (!error && data?.currentPrice) {
                    currentPrice = data.currentPrice;
                  }
                } catch (err) {
                  console.error('Error fetching forex price:', err);
                }
              }

              if (currentPrice <= 0) return position;
            }

            // Track price changes for visual indicators
            const previousPrice = previousPricesRef.current[position.id];
            if (previousPrice !== undefined && previousPrice !== currentPrice) {
              const direction = currentPrice > previousPrice ? 'up' : 'down';
              setPriceChanges(prev => ({ ...prev, [position.id]: { direction, flash: true } }));
              
              // Remove flash effect after animation
              setTimeout(() => {
                setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
              }, 500);
            }
            
            // Store current price for next comparison
            previousPricesRef.current[position.id] = currentPrice;

            // Calculate new PnL
            const pnl = position.position_type === 'long'
              ? (currentPrice - position.entry_price) * position.amount * position.leverage
              : (position.entry_price - currentPrice) * position.amount * position.leverage;

            // Update database in background
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

            // Return updated position for immediate UI update
            return {
              ...position,
              current_price: currentPrice,
              pnl: pnl
            };
          })
        );

        // Update state immediately for real-time UI updates
        setOpenPositions(updatedPositions);
      } catch (error) {
        console.error('Error updating prices:', error);
      }
    };

    // Update prices immediately and then every 1 second
    updatePrices();
    const interval = setInterval(updatePrices, 1000);

    return () => clearInterval(interval);
  }, [user, openPositions.length]);

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
      const closePrice = position.current_price;
      const pnl = position.position_type === 'long' 
        ? (closePrice - position.entry_price) * position.amount * position.leverage
        : (position.entry_price - closePrice) * position.amount * position.leverage;

      // Close position
      const { error } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          close_price: closePrice,
          pnl: pnl,
          closed_by: user?.id
        })
        .eq('id', position.id);

      if (error) throw error;

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
      fetchPositions();
    } catch (error) {
      console.error('Error closing position:', error);
      toast.error('Failed to close position');
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

    return (
      <Card className="p-4 hover:shadow-lg transition-shadow">
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
          {showCloseButton && (
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
        {/* Total Portfolio P&L Card */}
        {openPositions.length > 0 && (() => {
          const totalPnL = openPositions.reduce((sum, pos) => sum + calculatePnL(pos), 0);
          const isProfit = totalPnL >= 0;
          const totalMargin = openPositions.reduce((sum, pos) => sum + pos.margin, 0);
          const pnlPercentage = totalMargin > 0 ? (totalPnL / totalMargin) * 100 : 0;

          return (
            <Card className={`mb-6 p-4 sm:p-6 border-2 ${isProfit ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
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