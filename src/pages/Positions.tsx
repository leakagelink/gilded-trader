import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, X, RefreshCcw } from "lucide-react";
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
}

const Positions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [closePositionId, setClosePositionId] = useState<string | null>(null);

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
        const symbols = [...new Set(openPositions.map(p => p.symbol))];
        
        for (const symbol of symbols) {
          const { data, error } = await supabase.functions.invoke('fetch-taapi-data', {
            body: { symbol, interval: '1m' }
          });

          if (error) throw error;
          if (!data?.currentPrice) continue;

          const currentPrice = data.currentPrice;

          // Update positions with this symbol
          const positionsToUpdate = openPositions.filter(p => p.symbol === symbol);
          
          for (const position of positionsToUpdate) {
            const { error: updateError } = await supabase
              .from('positions')
              .update({ 
                current_price: currentPrice,
                updated_at: new Date().toISOString()
              })
              .eq('id', position.id)
              .eq('status', 'open');

            if (updateError) console.error('Error updating position price:', updateError);
          }
        }

        // Refresh positions to show updated prices
        fetchPositions();
      } catch (error) {
        console.error('Error updating prices:', error);
      }
    };

    // Update prices immediately and then every 5 seconds
    updatePrices();
    const interval = setInterval(updatePrices, 5000);

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

      toast.success(`Position closed: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL`);
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
            <p className="font-semibold">${position.current_price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Margin</p>
            <p className="font-semibold">${position.margin.toFixed(2)}</p>
          </div>
        </div>

        <div className={`mt-4 p-3 rounded-lg ${isProfit ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">PnL</span>
            <span className={`text-lg font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
              {isProfit ? '+' : ''}${pnl.toFixed(2)}
            </span>
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