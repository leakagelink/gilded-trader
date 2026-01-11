import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, TrendingUp, Gift, Sparkles, Lock, BarChart3, Clock, CheckCircle, XCircle, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import DepositModal from "@/components/DepositModal";
import WithdrawalModal from "@/components/WithdrawalModal";

interface WalletBalance {
  currency: string;
  balance: string;
  lockedBalance: string;
  icon: string;
}

const Wallet = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [walletData, setWalletData] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState(0.012);
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
        
        // Set exchange rate
        if (settings.exchange_rate) {
          setExchangeRate(parseFloat(settings.exchange_rate));
        }
      }
    } catch (error) {
      console.error("Error fetching offer settings:", error);
    }
  };

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch wallet balances including locked_balance
      const { data: wallets, error: walletsError } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", user.id);

      if (walletsError) throw walletsError;

      // Format wallet data - separate USD available and INR locked
      const usdWallet = wallets?.find(w => w.currency === "USD");
      const inrWallet = wallets?.find(w => w.currency === "INR");
      
      const formattedWallets: WalletBalance[] = [{
        currency: "USD",
        balance: usdWallet ? Number(usdWallet.balance).toFixed(2) : "0.00",
        lockedBalance: inrWallet ? Number(inrWallet.locked_balance || 0).toFixed(2) : "0.00",
        icon: "$",
      }];

      setWalletData(formattedWallets);

      // Fetch only deposit and withdrawal transactions (not trade)
      const { data: txs, error: txsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .in("type", ["deposit", "withdrawal"])
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

      // Fetch trade transactions separately
      const { data: tradeTxs, error: tradeTxsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "trade")
        .order("created_at", { ascending: false })
        .limit(10);

      if (tradeTxsError) throw tradeTxsError;

      const formattedTradeTxs = tradeTxs?.map((tx) => ({
        type: "Trade",
        amount: Number(tx.amount) >= 0 ? `+$${Number(tx.amount).toFixed(2)}` : `-$${Math.abs(Number(tx.amount)).toFixed(2)}`,
        date: new Date(tx.created_at).toLocaleDateString(),
        status: tx.status,
        isProfit: Number(tx.amount) >= 0,
      })) || [];

      setTradeHistory(formattedTradeTxs);

      // Fetch deposit requests history
      const { data: deposits, error: depositsError } = await supabase
        .from("deposit_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (depositsError) throw depositsError;
      setDepositHistory(deposits || []);
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
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {walletData.map((wallet, index) => (
            <Card key={index} className="p-6 bg-gradient-to-br from-card to-muted/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground">{wallet.currency} Available</span>
                <span className="text-2xl">{wallet.icon}</span>
              </div>
              <div className="text-3xl font-bold text-green-500">{wallet.balance}</div>
              <p className="text-xs text-muted-foreground mt-1">Available for trading & withdrawal</p>
            </Card>
          ))}
          {walletData.map((wallet, index) => (
            <Card key={`locked-${index}`} className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">INR Locked</span>
                </div>
                <span className="text-2xl">₹</span>
              </div>
              <div className="text-3xl font-bold text-amber-500">₹{wallet.lockedBalance}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending admin verification</p>
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
        <Card className="p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <ArrowDownLeft className="h-6 w-6 text-green-600" />
            Recent Transactions
          </h2>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No deposit or withdrawal transactions yet</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                <div>
                  <div className="font-semibold">{transaction.type}</div>
                  <div className="text-sm text-muted-foreground">{transaction.date}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${transaction.type === "Deposit" ? "text-green-600" : "text-red-500"}`}>{transaction.amount}</div>
                  <div className="text-sm text-muted-foreground">{transaction.status}</div>
                </div>
              </div>
              ))}
            </div>
          )}
        </Card>

        {/* Deposit History */}
        <Card className="p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Deposit History
          </h2>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading deposit history...</p>
          ) : depositHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No deposit requests yet</p>
          ) : (
            <div className="space-y-4">
              {depositHistory.map((deposit, index) => {
                const inrAmount = Number(deposit.amount);
                const usdAmount = deposit.currency === "INR" ? inrAmount * exchangeRate : inrAmount;
                const statusIcon = deposit.status === "approved" ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : deposit.status === "rejected" ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500" />
                );
                
                return (
                  <div key={index} className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        deposit.status === "approved" ? "bg-green-600/10" : 
                        deposit.status === "rejected" ? "bg-red-500/10" : 
                        "bg-amber-500/10"
                      }`}>
                        {statusIcon}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          Deposit
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            deposit.status === "approved" ? "bg-green-600/10 text-green-600" : 
                            deposit.status === "rejected" ? "bg-red-500/10 text-red-500" : 
                            deposit.status === "locked" ? "bg-amber-500/10 text-amber-500" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {deposit.status === "locked" ? "Payment Credit" : deposit.status}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(deposit.created_at).toLocaleDateString()} • {deposit.payment_method?.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {deposit.currency === "INR" ? "₹" : "$"}{inrAmount.toLocaleString()}
                      </div>
                      {deposit.currency === "INR" && (
                        <div className="text-sm text-green-600">
                          ≈ ${usdAmount.toFixed(2)} USD
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Trade History */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Trade History
          </h2>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading trade history...</p>
          ) : tradeHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No trade history yet</p>
          ) : (
            <div className="space-y-4">
              {tradeHistory.map((trade, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                <div>
                  <div className="font-semibold">{trade.type}</div>
                  <div className="text-sm text-muted-foreground">{trade.date}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${trade.isProfit ? "text-green-600" : "text-red-500"}`}>{trade.amount}</div>
                  <div className="text-sm text-muted-foreground">{trade.status}</div>
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
