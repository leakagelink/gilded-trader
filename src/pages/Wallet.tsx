import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, TrendingUp, Gift, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import DepositModal from "@/components/DepositModal";
import WithdrawalModal from "@/components/WithdrawalModal";

const Wallet = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [walletData, setWalletData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [offerSettings, setOfferSettings] = useState({
    bonusEnabled: false,
    bonusPercentage: "0",
    minAmount: "0",
    maxAmount: "0",
    bonusMax: "0",
    offerTitle: "",
  });

  const fetchOfferSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("setting_key, setting_value");
      
      if (error) throw error;
      
      if (data) {
        const settings: any = {};
        data.forEach((setting) => {
          settings[setting.setting_key] = setting.setting_value;
        });
        
        setOfferSettings({
          bonusEnabled: settings.deposit_bonus_enabled === 'true',
          bonusPercentage: settings.deposit_bonus_percentage || "0",
          minAmount: settings.deposit_min_amount || "0",
          maxAmount: settings.deposit_max_amount || "0",
          bonusMax: settings.deposit_bonus_max || "0",
          offerTitle: settings.deposit_offer_title || "",
        });
      }
    } catch (error) {
      console.error("Error fetching offer settings:", error);
    }
  };

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
    fetchOfferSettings();
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
              CoinGoldFX
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

        {/* Deposit Offer Banner - Only show if enabled */}
        {offerSettings.bonusEnabled && (
          <Card className="mb-8 p-6 bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 left-10 text-4xl">🎁</div>
              <div className="absolute top-4 right-20 text-3xl">💰</div>
              <div className="absolute bottom-2 left-1/4 text-3xl">🎉</div>
              <div className="absolute bottom-3 right-10 text-4xl">✨</div>
              <div className="absolute top-1/2 left-1/2 text-3xl">🎁</div>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    {offerSettings.offerTitle || "Special Offer"}
                    <Sparkles className="h-5 w-5" />
                  </h3>
                  <p className="text-white/90 text-sm">Limited time offer - Don't miss out!</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold mb-1">{offerSettings.bonusPercentage}% DEPOSIT BONUS</p>
                  <p className="text-white/90 text-sm">
                    Deposit between <span className="font-bold">${offerSettings.minAmount} - ${offerSettings.maxAmount}</span> and get <span className="font-bold">{offerSettings.bonusPercentage}% extra</span> in your wallet!
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-3 text-sm">
                    <span className="bg-white/20 px-3 py-1 rounded-full">Min: ${offerSettings.minAmount}</span>
                    <span className="bg-white/20 px-3 py-1 rounded-full">Max Bonus: ${offerSettings.bonusMax}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

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
          <Card 
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setWithdrawalModalOpen(true)}
          >
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

      {/* Withdrawal Modal */}
      <WithdrawalModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        onSuccess={fetchWalletData}
        availableBalance={walletData.find(w => w.currency === "USD")?.balance || "0.00"}
      />

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};

export default Wallet;
