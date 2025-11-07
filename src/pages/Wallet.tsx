import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import DepositModal from "@/components/DepositModal";

const Wallet = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [walletData, setWalletData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch wallet balances
      const { data: wallets, error: walletsError } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (walletsError) throw walletsError;

      // Format wallet data
      const formattedWallets = wallets?.map((wallet) => ({
        currency: wallet.currency,
        balance: Number(wallet.balance).toFixed(2),
        icon: wallet.currency === "USD" ? "$" : wallet.currency === "BTC" ? "₿" : "Ξ",
      })) || [];

      // If no wallets exist, show default
      if (formattedWallets.length === 0) {
        setWalletData([{ currency: "USD", balance: "0.00", icon: "$" }]);
      } else {
        setWalletData(formattedWallets);
      }

      // Fetch transactions
      const { data: txs, error: txsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (txsError) throw txsError;

      const formattedTxs = txs?.map((tx) => ({
        type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        amount: `${tx.type === "deposit" ? "+" : "-"}$${Number(tx.amount).toFixed(2)}`,
        date: new Date(tx.created_at).toLocaleDateString(),
        status: tx.status,
      })) || [];

      setTransactions(formattedTxs);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TradePro
            </span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <WalletIcon className="h-8 w-8" />
            My Wallet
          </h1>
          <p className="text-muted-foreground">Manage your funds and transactions</p>
        </div>

        {/* Wallet Balances */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {walletData.map((wallet, index) => (
            <Card key={index} className="p-6 bg-gradient-to-br from-card to-muted/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground">{wallet.currency}</span>
                <span className="text-2xl">{wallet.icon}</span>
              </div>
              <div className="text-3xl font-bold">{wallet.balance}</div>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Card 
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setDepositModalOpen(true)}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-600/10 flex items-center justify-center">
                <ArrowDownLeft className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Deposit Funds</h3>
                <p className="text-sm text-muted-foreground">Add money to your wallet</p>
              </div>
            </div>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-600/10 flex items-center justify-center">
                <ArrowUpRight className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Withdraw Funds</h3>
                <p className="text-sm text-muted-foreground">Transfer money out</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-6">Recent Transactions</h2>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                <div>
                  <div className="font-semibold">{transaction.type}</div>
                  <div className="text-sm text-muted-foreground">{transaction.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{transaction.amount}</div>
                  <div className="text-sm text-green-600">{transaction.status}</div>
                </div>
              </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      {/* Deposit Modal */}
      <DepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
        onSuccess={fetchWalletData}
      />

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};

export default Wallet;
