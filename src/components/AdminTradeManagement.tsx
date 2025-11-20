import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Edit, X } from "lucide-react";

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
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

export const AdminTradeManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [openTradeDialog, setOpenTradeDialog] = useState(false);
  const [editTradeDialog, setEditTradeDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  
  // Trade form fields
  const [symbol, setSymbol] = useState("");
  const [positionType, setPositionType] = useState<'long' | 'short'>('long');
  const [amount, setAmount] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [leverage, setLeverage] = useState("1");

  useEffect(() => {
    fetchUsers();
    fetchPositions();
  }, []);

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
      .select(`
        *,
        profiles!positions_user_id_fkey (full_name, email)
      `)
      .eq("status", "open")
      .order("opened_at", { ascending: false });
    
    if (data) setPositions(data as any);
  };

  const handleOpenTrade = async () => {
    if (!selectedUser || !symbol || !amount || !entryPrice) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const tradeAmount = parseFloat(amount);
      const price = parseFloat(entryPrice);
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
        status: 'open'
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
      const pnl = position.position_type === 'long' 
        ? (position.current_price - position.entry_price) * position.amount * position.leverage
        : (position.entry_price - position.current_price) * position.amount * position.leverage;

      // Close position
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
  };

  const calculatePnL = (position: Position) => {
    if (position.position_type === 'long') {
      return (position.current_price - position.entry_price) * position.amount * position.leverage;
    } else {
      return (position.entry_price - position.current_price) * position.amount * position.leverage;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trade Management</h2>
        <Button onClick={() => setOpenTradeDialog(true)}>
          Open Trade for User
        </Button>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Positions</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Entry Price</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Leverage</TableHead>
              <TableHead>PnL</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => {
              const pnl = calculatePnL(position);
              const isProfit = pnl >= 0;
              
              return (
                <TableRow key={position.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{position.profiles?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{position.profiles?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{position.symbol}</TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1 ${position.position_type === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                      {position.position_type === 'long' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {position.position_type.toUpperCase()}
                    </div>
                  </TableCell>
                  <TableCell>{position.amount}</TableCell>
                  <TableCell>${position.entry_price.toFixed(2)}</TableCell>
                  <TableCell>${position.current_price.toFixed(2)}</TableCell>
                  <TableCell>{position.leverage}x</TableCell>
                  <TableCell className={isProfit ? 'text-green-500' : 'text-red-500'}>
                    {isProfit ? '+' : ''}${pnl.toFixed(2)}
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
      </Card>

      {/* Open Trade Dialog */}
      <Dialog open={openTradeDialog} onOpenChange={setOpenTradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Trade for User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                onChange={(e) => setSymbol(e.target.value)}
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
              <Label>Entry Price</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
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
