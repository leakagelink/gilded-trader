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
  stop_loss?: number | null;
  take_profit?: number | null;
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
  // Track permanently closed positions to prevent re-adding during price updates
  const permanentlyClosedIdsRef = useRef<Set<string>>(new Set());
  
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
  
  // Live momentum disabled - positions show static prices from database
  useEffect(() => {
    // No price updates - momentum completely stopped
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
    // Check if already permanently closed - prevent double close
    if (permanentlyClosedIdsRef.current.has(position.id)) {
      console.log('Position already closed, ignoring duplicate close request:', position.id);
      toast.info('This position has already been closed');
      setClosePositionId(null);
      return;
    }

    try {
      // IMMEDIATELY mark as permanently closed to prevent any re-adds
      permanentlyClosedIdsRef.current.add(position.id);
      
      // Start closing animation
      setClosingPositionId(position.id);
      
      // IMMEDIATELY remove from open positions state to prevent re-showing
      setOpenPositions(prev => prev.filter(p => p.id !== position.id));
      
      const closePrice = position.current_price;
      const pnl = position.position_type === 'long' 
        ? (closePrice - position.entry_price) * position.amount * position.leverage
        : (position.entry_price - closePrice) * position.amount * position.leverage;

      const closedAt = new Date().toISOString();

      // Close position in database - use status check to prevent double close
      const { data: updateResult, error } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          close_price: closePrice,
          pnl: pnl,
          closed_by: user?.id
        })
        .eq('id', position.id)
        .eq('status', 'open') // CRITICAL: Only update if still open
        .select();

      if (error) throw error;

      // Check if update actually happened (position was still open)
      if (!updateResult || updateResult.length === 0) {
        console.log('Position was already closed in database:', position.id);
        toast.info('Position was already closed');
        setClosingPositionId(null);
        setClosePositionId(null);
        return;
      }

      // Show success animation
      setClosingPositionId(null);
      setClosedSuccessId(position.id);

      // Wait for animation to complete before moving to closed
      await new Promise(resolve => setTimeout(resolve, 800));

      // Add to closed positions at the top
      const closedPosition: Position = {
        ...position,
        status: 'closed',
        closed_at: closedAt,
        close_price: closePrice,
        pnl: pnl
      };
      
      setClosedPositions(prev => {
        // Avoid duplicates
        if (prev.some(p => p.id === position.id)) {
          return prev;
        }
        return [closedPosition, ...prev];
      });
      
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
      // Remove from permanently closed set if error occurred
      permanentlyClosedIdsRef.current.delete(position.id);
      setClosingPositionId(null);
      setClosedSuccessId(null);
    }
  };

  // Auto-close position when stop loss or take profit is triggered
  const handleAutoClose = async (position: Position, reason: 'stop_loss' | 'take_profit') => {
    // Check if already permanently closed - prevent double close
    if (permanentlyClosedIdsRef.current.has(position.id)) {
      return;
    }

    try {
      // IMMEDIATELY mark as permanently closed to prevent any re-adds
      permanentlyClosedIdsRef.current.add(position.id);
      
      // IMMEDIATELY remove from open positions state
      setOpenPositions(prev => prev.filter(p => p.id !== position.id));
      
      // Determine close price based on trigger reason
      const closePrice = reason === 'stop_loss' 
        ? (position.stop_loss || position.current_price)
        : (position.take_profit || position.current_price);
        
      const pnl = position.position_type === 'long' 
        ? (closePrice - position.entry_price) * position.amount * position.leverage
        : (position.entry_price - closePrice) * position.amount * position.leverage;

      const closedAt = new Date().toISOString();

      // Close position in database - use status check to prevent double close
      const { data: updateResult, error } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          close_price: closePrice,
          pnl: pnl,
          closed_by: user?.id
        })
        .eq('id', position.id)
        .eq('status', 'open')
        .select();

      if (error) throw error;

      // Check if update actually happened
      if (!updateResult || updateResult.length === 0) {
        return;
      }

      // Add to closed positions
      const closedPosition: Position = {
        ...position,
        status: 'closed',
        closed_at: closedAt,
        close_price: closePrice,
        pnl: pnl
      };
      
      setClosedPositions(prev => {
        if (prev.some(p => p.id === position.id)) {
          return prev;
        }
        return [closedPosition, ...prev];
      });
      
      // Clean up refs
      delete previousPricesRef.current[position.id];
      delete basePnlRef.current[position.id];

      // Get current wallet balance and update
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .single();

      if (!walletError && wallet) {
        const currentBalance = wallet.balance || 0;
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

      if (reason === 'stop_loss') {
        toast.warning(`⚠️ Stop Loss triggered for ${position.symbol}! Position closed at $${closePrice.toFixed(2)}. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
      } else {
        toast.success(`🎯 Take Profit reached for ${position.symbol}! Position closed at $${closePrice.toFixed(2)}. PnL: +$${pnl.toFixed(2)}`);
      }
    } catch (error) {
      console.error(`Error auto-closing position on ${reason}:`, error);
      permanentlyClosedIdsRef.current.delete(position.id);
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
          {(position.stop_loss || position.take_profit) && (
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {position.stop_loss && (
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Stop Loss
                  </p>
                  <p className="font-semibold text-red-500">${position.stop_loss.toFixed(2)}</p>
                </div>
              )}
              {position.take_profit && (
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Take Profit
                  </p>
                  <p className="font-semibold text-green-500">${position.take_profit.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
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