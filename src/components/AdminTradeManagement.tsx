import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Edit, X, ArrowUp, ArrowDown, Plus, Minus, Search, ChevronLeft, ChevronRight, Users, Eye, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface Position {
  id: string;
  user_id: string;
  symbol: string;
  position_type: 'long' | 'short';
  amount: number;
  entry_price: number;
  current_price: number;
  leverage: number;
  margin: number;
  status: 'open' | 'closed';
  price_mode?: string;
  pnl?: number;
  closed_at?: string;
  close_price?: number;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

interface UserWithTrades {
  id: string;
  full_name: string;
  email: string;
  tradeCount: number;
  totalPnL: number;
}

const TRADES_PER_PAGE = 10;

export const AdminTradeManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [openTradeDialog, setOpenTradeDialog] = useState(false);
  const [editTradeDialog, setEditTradeDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [priceChanges, setPriceChanges] = useState<Record<string, { direction: 'up' | 'down' | 'none'; flash: boolean }>>({});
  const previousPricesRef = useRef<Record<string, number>>({});
  
  // View state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tradeViewTab, setTradeViewTab] = useState<'open' | 'closed'>('open');
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  
  // Trade form fields
  const [symbol, setSymbol] = useState("");
  const [positionType, setPositionType] = useState<'long' | 'short'>('long');
  const [amount, setAmount] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [priceMode, setPriceMode] = useState<'live' | 'manual'>('live');
  const [adjustPnlPositionId, setAdjustPnlPositionId] = useState<string | null>(null);
  const [targetPnlPercent, setTargetPnlPercent] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchPositions();
  }, []);

  // Real-time price updates for open positions
  useEffect(() => {
    if (positions.length === 0) return;

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
          positions.map(async (position) => {
            let currentPrice = position.current_price;

            // Check if this is a manual or edited trade
            if (position.price_mode === 'manual') {
              // Generate fake momentum between 1-5% for manual trades around entry price
              const randomPercent = (Math.random() * 4 + 1) * (Math.random() > 0.5 ? 1 : -1);
              currentPrice = position.entry_price * (1 + randomPercent / 100);
            } else if (position.price_mode === 'edited') {
              // For edited trades, fluctuate ±1-7% around current price (not entry price)
              // This keeps the PnL near the admin's edited value
              const randomPercent = (Math.random() * 6 + 1) * (Math.random() > 0.5 ? 1 : -1);
              currentPrice = position.current_price * (1 + randomPercent / 100);
            } else {
              // For live trades, use real market prices
              const isForex = position.symbol.includes('/');
              
              if (!isForex && cryptoPrices[position.symbol.toUpperCase()]) {
                currentPrice = cryptoPrices[position.symbol.toUpperCase()];
              } else if (isForex) {
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
              
              setTimeout(() => {
                setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
              }, 500);
            }
            
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

            return {
              ...position,
              current_price: currentPrice,
              pnl: pnl
            };
          })
        );

        setPositions(updatedPositions);
      } catch (error) {
        console.error('Error updating prices:', error);
      }
    };

    updatePrices();
    const interval = setInterval(updatePrices, 5000); // 5 seconds for admin to edit trades

    return () => clearInterval(interval);
  }, [positions.length]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("created_at", { ascending: false });
    
    if (data) setUsers(data);
  };

  const fetchPositions = async () => {
    const { data } = await supabase
      .from("positions")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false });
    
    if (data) {
      // Fetch user profiles separately
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      // Merge profiles with positions
      const positionsWithProfiles = data.map(position => ({
        ...position,
        profiles: profiles?.find(p => p.id === position.user_id)
      }));
      
      setPositions(positionsWithProfiles as any);
    }
  };

  const fetchClosedPositions = async (userId: string) => {
    const { data } = await supabase
      .from("positions")
      .select("*")
      .eq("status", "closed")
      .eq("user_id", userId)
      .order("closed_at", { ascending: false });
    
    if (data) {
      // Fetch user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .maybeSingle();
      
      const positionsWithProfiles = data.map(position => ({
        ...position,
        profiles: profile || undefined
      }));
      
      setClosedPositions(positionsWithProfiles as any);
    }
  };

  const calculatePnL = (position: Position) => {
    if (position.position_type === 'long') {
      return (position.current_price - position.entry_price) * position.amount * position.leverage;
    } else {
      return (position.entry_price - position.current_price) * position.amount * position.leverage;
    }
  };

  // Get users with active trades
  const usersWithTrades: UserWithTrades[] = useMemo(() => {
    const userTradeMap = new Map<string, UserWithTrades>();
    
    positions.forEach(position => {
      const existing = userTradeMap.get(position.user_id);
      const pnl = calculatePnL(position);
      
      if (existing) {
        existing.tradeCount += 1;
        existing.totalPnL += pnl;
      } else {
        userTradeMap.set(position.user_id, {
          id: position.user_id,
          full_name: position.profiles?.full_name || 'Unknown',
          email: position.profiles?.email || '',
          tradeCount: 1,
          totalPnL: pnl
        });
      }
    });
    
    return Array.from(userTradeMap.values());
  }, [positions]);

  // Filter users by search
  const filteredUsers = usersWithTrades.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get trades for selected user with pagination
  const selectedUserTrades = viewingUserId 
    ? positions.filter(p => p.user_id === viewingUserId)
    : [];
  
  const totalPages = Math.ceil(selectedUserTrades.length / TRADES_PER_PAGE);
  const paginatedTrades = selectedUserTrades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE
  );

  const selectedUserInfo = usersWithTrades.find(u => u.id === viewingUserId);

  const handleOpenTrade = async () => {
    // Validate based on price mode
    if (!selectedUser || !symbol) {
      toast.error("Please select user and symbol");
      return;
    }

    if (priceMode === 'manual' && (!amount || !entryPrice)) {
      toast.error("Please fill amount and entry price for manual mode");
      return;
    }

    if (priceMode === 'live' && !amount) {
      toast.error("Please enter amount");
      return;
    }

    try {
      let price: number;
      let tradeAmount: number;

      if (priceMode === 'live') {
        // Fetch real-time market price
        console.log('Fetching live market price for symbol:', symbol);
        const { data: priceData, error: priceError } = await supabase.functions.invoke('fetch-crypto-data');
        
        console.log('Price data response:', priceData, 'Error:', priceError);
        
        if (priceError) {
          console.error('Error fetching price:', priceError);
          toast.error("Failed to fetch live market price: " + priceError.message);
          return;
        }

        if (!priceData || !priceData.cryptoData || !Array.isArray(priceData.cryptoData)) {
          console.error('Invalid price data format:', priceData);
          toast.error("Invalid price data received");
          return;
        }

        // Find the symbol in the price data - be more flexible with matching
        const symbolData = priceData.cryptoData.find((coin: any) => {
          const coinSymbol = coin.symbol?.toUpperCase() || '';
          const searchSymbol = symbol.toUpperCase().trim();
          return coinSymbol === searchSymbol;
        });

        console.log('Found symbol data:', symbolData);

        if (!symbolData || !symbolData.price) {
          console.error('Symbol not found or invalid price. Available symbols:', 
            priceData.cryptoData.slice(0, 10).map((c: any) => c.symbol).join(', '));
          toast.error(`Symbol ${symbol} not found. Please check symbol name.`);
          return;
        }

        price = parseFloat(symbolData.price);
        // For live mode, use user-specified amount
        tradeAmount = parseFloat(amount);
        console.log('Opening trade at live price:', price, 'with amount:', tradeAmount);
      } else {
        // Manual mode
        price = parseFloat(entryPrice);
        tradeAmount = parseFloat(amount);
        console.log('Opening trade at manual price:', price);
      }

      const lev = parseInt(leverage);
      const margin = (tradeAmount * price) / lev;

      // Check user wallet balance
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', selectedUser)
        .eq('currency', 'USD')
        .single();

      const currentBalance = wallet?.balance || 0;
      
      if (currentBalance < margin) {
        toast.error(`Insufficient balance. Required: $${margin.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
        return;
      }

      // Deduct margin from wallet
      await supabase
        .from('user_wallets')
        .update({ balance: currentBalance - margin })
        .eq('user_id', selectedUser)
        .eq('currency', 'USD');

      // Create position
      const { error } = await supabase.from('positions').insert({
        user_id: selectedUser,
        symbol: symbol.toUpperCase(),
        position_type: positionType,
        amount: tradeAmount,
        entry_price: price,
        current_price: price,
        leverage: lev,
        margin: margin,
        status: 'open',
        price_mode: priceMode
      });

      if (error) {
        // Rollback wallet deduction
        await supabase
          .from('user_wallets')
          .update({ balance: currentBalance })
          .eq('user_id', selectedUser)
          .eq('currency', 'USD');
        throw error;
      }

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        user_id: selectedUser,
        type: 'trade',
        amount: -margin,
        currency: 'USD',
        status: 'Completed',
        reference_id: null
      });

      toast.success(`Trade opened for user`);
      setOpenTradeDialog(false);
      resetForm();
      fetchPositions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditTrade = async () => {
    if (!selectedPosition || !entryPrice || !amount) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const newEntryPrice = parseFloat(entryPrice);
      const newAmount = parseFloat(amount);
      const newMargin = (newAmount * newEntryPrice) / selectedPosition.leverage;

      // Calculate old and new margin difference
      const marginDiff = newMargin - selectedPosition.margin;

      // Get user wallet
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', selectedPosition.user_id)
        .eq('currency', 'USD')
        .single();

      const currentBalance = wallet?.balance || 0;

      // If margin increased, check if user has enough balance
      if (marginDiff > 0 && currentBalance < marginDiff) {
        toast.error(`Insufficient balance for margin increase. Required: $${marginDiff.toFixed(2)}`);
        return;
      }

      // Update wallet balance
      await supabase
        .from('user_wallets')
        .update({ balance: currentBalance - marginDiff })
        .eq('user_id', selectedPosition.user_id)
        .eq('currency', 'USD');

      // Update position
      const { error } = await supabase
        .from('positions')
        .update({
          amount: newAmount,
          entry_price: newEntryPrice,
          current_price: newEntryPrice,
          margin: newMargin,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPosition.id);

      if (error) throw error;

      toast.success("Trade updated successfully");
      setEditTradeDialog(false);
      setSelectedPosition(null);
      fetchPositions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCloseTrade = async (position: Position) => {
    try {
      // Use the current displayed PnL (which may have been edited by admin)
      // instead of recalculating from prices
      const pnl = position.pnl ?? calculatePnL(position);

      // Close position with the current PnL value
      await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          close_price: position.current_price,
          pnl: pnl
        })
        .eq('id', position.id);

      // Get wallet
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', position.user_id)
        .eq('currency', 'USD')
        .single();

      const currentBalance = wallet?.balance || 0;
      const finalAmount = position.margin + pnl;

      // Update wallet
      await supabase
        .from('user_wallets')
        .update({ balance: currentBalance + finalAmount })
        .eq('user_id', position.user_id)
        .eq('currency', 'USD');

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        user_id: position.user_id,
        type: 'trade',
        amount: finalAmount,
        currency: 'USD',
        status: 'Completed',
        reference_id: position.id
      });

      toast.success(`Position closed: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL`);
      fetchPositions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openEditDialog = (position: Position) => {
    setSelectedPosition(position);
    setAmount(position.amount.toString());
    setEntryPrice(position.entry_price.toString());
    setEditTradeDialog(true);
  };

  const resetForm = () => {
    setSelectedUser("");
    setSymbol("");
    setPositionType("long");
    setAmount("");
    setEntryPrice("");
    setLeverage("1");
    setPriceMode("live");
  };

  const handleSymbolChange = (value: string) => {
    setSymbol(value);
  };

  const handleAdjustPnl = async () => {
    if (!adjustPnlPositionId || !targetPnlPercent) {
      toast.error("Please enter target PnL%");
      return;
    }

    await adjustPnlForPosition(adjustPnlPositionId, parseFloat(targetPnlPercent));
    setAdjustPnlPositionId(null);
    setTargetPnlPercent("");
  };

  const adjustPnlForPosition = async (positionId: string, pnlPercent: number) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    try {
      const targetPnl = (pnlPercent / 100) * position.margin;
      let newCurrentPrice: number;

      if (position.position_type === 'long') {
        newCurrentPrice = position.entry_price + (targetPnl / (position.amount * position.leverage));
      } else {
        newCurrentPrice = position.entry_price - (targetPnl / (position.amount * position.leverage));
      }

      // Update local state immediately so UI reflects the change
      // Mark as 'edited' so it won't follow live market prices anymore
      setPositions(prev => prev.map(p => 
        p.id === positionId 
          ? { ...p, current_price: newCurrentPrice, pnl: targetPnl, price_mode: 'edited' }
          : p
      ));

      // Update database in background - mark as 'edited' price mode
      const { error } = await supabase
        .from('positions')
        .update({
          current_price: newCurrentPrice,
          pnl: targetPnl,
          price_mode: 'edited',
          updated_at: new Date().toISOString()
        })
        .eq('id', positionId);

      if (error) {
        // Revert local state on error
        fetchPositions();
        throw error;
      }

      toast.success(`PnL adjusted to ${pnlPercent.toFixed(2)}%`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewUserTrades = (userId: string) => {
    setViewingUserId(userId);
    setCurrentPage(1);
    setTradeViewTab('open');
    fetchClosedPositions(userId);
  };

  const handleBackToUsers = () => {
    setViewingUserId(null);
    setCurrentPage(1);
    setTradeViewTab('open');
    setClosedPositions([]);
  };

  const handleTabChange = (tab: string) => {
    setTradeViewTab(tab as 'open' | 'closed');
    setCurrentPage(1);
  };

  // Get trades for display based on active tab
  const displayTrades = tradeViewTab === 'open' ? selectedUserTrades : closedPositions;
  const displayTotalPages = Math.ceil(displayTrades.length / TRADES_PER_PAGE);
  const displayPaginatedTrades = displayTrades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trade Management</h2>
        <Button onClick={() => setOpenTradeDialog(true)}>
          Open Trade for User
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by user name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {!viewingUserId ? (
        // Users List View
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users with Active Trades ({filteredUsers.length})
          </h3>
          
          {filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? "No users found matching your search" : "No active trades"}
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{user.tradeCount}</div>
                      <div className="text-xs text-muted-foreground">Trades</div>
                    </div>
                    <div className="text-center min-w-[100px]">
                      <div className={`text-lg font-semibold ${user.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {user.totalPnL >= 0 ? '+' : ''}${user.totalPnL.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total PnL</div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewUserTrades(user.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Trades
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        // User's Trades View
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleBackToUsers}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <h3 className="text-lg font-semibold">{selectedUserInfo?.full_name}'s Trades</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedUserTrades.length} open • {closedPositions.length} closed
                </p>
              </div>
            </div>
          </div>

          <Tabs value={tradeViewTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="open" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Open Trades ({selectedUserTrades.length})
              </TabsTrigger>
              <TabsTrigger value="closed" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Trade History ({closedPositions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              {selectedUserTrades.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No open trades</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Entry Price</TableHead>
                        <TableHead>Current Price</TableHead>
                        <TableHead>Leverage</TableHead>
                        <TableHead>PnL</TableHead>
                        <TableHead>PnL %</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTrades.map((position) => {
                        const pnl = calculatePnL(position);
                        const isProfit = pnl >= 0;
                        const pnlPercent = (pnl / position.margin) * 100;
                        
                        return (
                          <TableRow key={position.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {position.symbol}
                                <Badge 
                                  variant={position.price_mode === 'edited' ? 'destructive' : position.price_mode === 'manual' ? 'secondary' : 'outline'}
                                  className={`text-[10px] px-1.5 py-0 ${
                                    position.price_mode === 'edited' 
                                      ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' 
                                      : position.price_mode === 'manual' 
                                        ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' 
                                        : 'bg-green-500/20 text-green-500 border-green-500/30'
                                  }`}
                                >
                                  {position.price_mode === 'edited' ? 'Edited' : position.price_mode === 'manual' ? 'Manual' : 'Live'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 ${position.position_type === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                                {position.position_type === 'long' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                {position.position_type.toUpperCase()}
                              </div>
                            </TableCell>
                            <TableCell>{position.amount}</TableCell>
                            <TableCell>${position.entry_price.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 transition-all duration-300 ${
                                priceChanges[position.id]?.flash 
                                  ? priceChanges[position.id].direction === 'up' 
                                    ? 'text-green-500 animate-pulse' 
                                    : 'text-red-500 animate-pulse'
                                  : ''
                              }`}>
                                <span className={`px-2 py-1 rounded transition-all duration-300 ${
                                  priceChanges[position.id]?.flash
                                    ? priceChanges[position.id].direction === 'up'
                                      ? 'bg-green-500/20'
                                      : 'bg-red-500/20'
                                    : ''
                                }`}>
                                  ${position.current_price.toFixed(2)}
                                </span>
                                {priceChanges[position.id]?.direction === 'up' && (
                                  <ArrowUp className="h-4 w-4 text-green-500" />
                                )}
                                {priceChanges[position.id]?.direction === 'down' && (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{position.leverage}x</TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 transition-all duration-300 ${
                                priceChanges[position.id]?.flash 
                                  ? 'animate-pulse'
                                  : ''
                              } ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                <span className={`px-2 py-1 rounded ${
                                  priceChanges[position.id]?.flash
                                    ? isProfit
                                      ? 'bg-green-500/20'
                                      : 'bg-red-500/20'
                                    : ''
                                }`}>
                                  {isProfit ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => adjustPnlForPosition(position.id, pnlPercent - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                
                                {adjustPnlPositionId === position.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      placeholder="PnL %"
                                      value={targetPnlPercent}
                                      onChange={(e) => setTargetPnlPercent(e.target.value)}
                                      className="w-16 h-7 text-xs"
                                    />
                                    <Button size="sm" className="h-7 px-2" onClick={handleAdjustPnl}>OK</Button>
                                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setAdjustPnlPositionId(null)}>X</Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAdjustPnlPositionId(position.id);
                                      setTargetPnlPercent(pnlPercent.toFixed(2));
                                    }}
                                    className={`font-semibold min-w-[60px] text-center ${isProfit ? 'text-green-500' : 'text-red-500'}`}
                                  >
                                    {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                  </button>
                                )}
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => adjustPnlForPosition(position.id, pnlPercent + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(position)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCloseTrade(position)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination for open trades */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} to {Math.min(currentPage * TRADES_PER_PAGE, selectedUserTrades.length)} of {selectedUserTrades.length} trades
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm px-3">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="closed">
              {closedPositions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No closed trades</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Entry Price</TableHead>
                        <TableHead>Close Price</TableHead>
                        <TableHead>Leverage</TableHead>
                        <TableHead>Final PnL</TableHead>
                        <TableHead>Closed At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayPaginatedTrades.map((position) => {
                        const pnl = position.pnl || 0;
                        const isProfit = pnl >= 0;
                        const pnlPercent = (pnl / position.margin) * 100;
                        
                        return (
                          <TableRow key={position.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {position.symbol}
                                <Badge 
                                  variant={position.price_mode === 'edited' ? 'destructive' : position.price_mode === 'manual' ? 'secondary' : 'outline'}
                                  className={`text-[10px] px-1.5 py-0 ${
                                    position.price_mode === 'edited' 
                                      ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' 
                                      : position.price_mode === 'manual' 
                                        ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' 
                                        : 'bg-green-500/20 text-green-500 border-green-500/30'
                                  }`}
                                >
                                  {position.price_mode === 'edited' ? 'Edited' : position.price_mode === 'manual' ? 'Manual' : 'Live'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 ${position.position_type === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                                {position.position_type === 'long' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                {position.position_type.toUpperCase()}
                              </div>
                            </TableCell>
                            <TableCell>{position.amount}</TableCell>
                            <TableCell>${position.entry_price.toFixed(2)}</TableCell>
                            <TableCell>${(position.close_price || position.current_price).toFixed(2)}</TableCell>
                            <TableCell>{position.leverage}x</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className={`font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                  {isProfit ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                                <span className={`text-xs ${isProfit ? 'text-green-500/70' : 'text-red-500/70'}`}>
                                  {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {position.closed_at && (
                                  <>
                                    <div>{new Date(position.closed_at).toLocaleDateString()}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(position.closed_at).toLocaleTimeString()}
                                    </div>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination for closed trades */}
                  {displayTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} to {Math.min(currentPage * TRADES_PER_PAGE, closedPositions.length)} of {closedPositions.length} trades
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm px-3">
                          Page {currentPage} of {displayTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(displayTotalPages, p + 1))}
                          disabled={currentPage === displayTotalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {/* Open Trade Dialog */}
      <Dialog open={openTradeDialog} onOpenChange={setOpenTradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Trade for User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Price Mode</Label>
              <Select value={priceMode} onValueChange={(v) => setPriceMode(v as 'live' | 'manual')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live Market Price</SelectItem>
                  <SelectItem value="manual">Manual Entry Price (±5%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Symbol</Label>
              <Input
                placeholder="BTC, ETH, EUR/USD, etc."
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
              />
            </div>

            <div>
              <Label>Position Type</Label>
              <Select value={positionType} onValueChange={(v) => setPositionType(v as 'long' | 'short')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {priceMode === 'manual' && (
              <div>
                <Label>Entry Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <Label>Leverage</Label>
              <Select value={leverage} onValueChange={setLeverage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 5, 10, 20, 50, 100].map((lev) => (
                    <SelectItem key={lev} value={lev.toString()}>
                      {lev}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {priceMode === 'live' && (
              <p className="text-sm text-muted-foreground">
                Trade will open at current live market price and follow real-time market movements.
              </p>
            )}
            {priceMode === 'manual' && (
              <p className="text-sm text-muted-foreground">
                Trade will fluctuate ±5% around the manual entry price you specify.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleOpenTrade}>
              Open Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Trade Dialog */}
      <Dialog open={editTradeDialog} onOpenChange={setEditTradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Entry Price</Label>
              <Input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Note: Editing trade will update current price to match entry price and adjust momentum accordingly.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTrade}>
              Update Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
