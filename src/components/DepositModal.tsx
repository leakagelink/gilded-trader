import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle, Smartphone, Zap, ArrowLeft, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type DepositMode = "select" | "instant" | "manual";
type InstantStep = "amount" | "apps" | "confirm";

interface UpiApp {
  name: string;
  scheme: string;
  icon: string;
  color: string;
}

const UPI_APPS: UpiApp[] = [
  { name: "PhonePe", scheme: "phonepe", icon: "📱", color: "bg-purple-600" },
  { name: "Google Pay", scheme: "tez", icon: "🔵", color: "bg-blue-500" },
  { name: "Paytm", scheme: "paytmmp", icon: "💙", color: "bg-sky-500" },
  { name: "BHIM UPI", scheme: "upi", icon: "🇮🇳", color: "bg-green-600" },
  { name: "Other UPI App", scheme: "upi", icon: "📲", color: "bg-gray-600" },
];

const DepositModal = ({ open, onOpenChange, onSuccess }: DepositModalProps) => {
  const [depositMode, setDepositMode] = useState<DepositMode>("select");
  const [instantStep, setInstantStep] = useState<InstantStep>("amount");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "netbanking">("upi");
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const { toast } = useToast();

  // Payment details from database
  const [upiId, setUpiId] = useState("coingoldfx@upi");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [bankDetails, setBankDetails] = useState({
    accountName: "CoinGoldFX Account",
    accountNumber: "1234567890",
    ifsc: "BANK0001234",
    bankName: "Demo Bank",
  });

  useEffect(() => {
    if (open) {
      fetchPaymentSettings();
      // Reset state when modal opens
      setDepositMode("select");
      setInstantStep("amount");
      setPaymentInitiated(false);
      setAmount("");
      setTransactionId("");
    }
  }, [open]);

  const fetchPaymentSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("*");

      if (error) throw error;

      if (data) {
        const settings: any = {};
        data.forEach((setting) => {
          settings[setting.setting_key] = setting.setting_value;
        });

        setUpiId(settings.upi_id || "coingoldfx@upi");
        setQrCodeUrl(settings.qr_code_url || "");
        setBankDetails({
          accountName: settings.account_name || "CoinGoldFX Account",
          accountNumber: settings.account_number || "1234567890",
          ifsc: settings.ifsc_code || "BANK0001234",
          bankName: settings.bank_name || "Demo Bank",
        });
      }
    } catch (error) {
      console.error("Error fetching payment settings:", error);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Details copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const generateUpiLink = (appScheme: string) => {
    const amountInr = parseFloat(amount).toFixed(2);
    // Use UPI ID directly without extra encoding that might break the format
    const upiParams = new URLSearchParams();
    upiParams.set('pa', upiId);
    upiParams.set('pn', 'CoinGoldFX');
    upiParams.set('am', amountInr);
    upiParams.set('cu', 'INR');
    upiParams.set('tn', `Deposit ${amountInr} INR`);
    upiParams.set('mode', '02'); // Intent mode for better compatibility
    
    const queryString = upiParams.toString();
    
    // Different schemes for different apps
    if (appScheme === "phonepe") {
      return `phonepe://pay?${queryString}`;
    } else if (appScheme === "tez") {
      return `tez://upi/pay?${queryString}`;
    } else if (appScheme === "paytmmp") {
      return `paytmmp://pay?${queryString}`;
    } else {
      // Generic UPI intent - works best on Android
      return `upi://pay?${queryString}`;
    }
  };

  const handleUpiAppSelect = (app: UpiApp) => {
    const upiLink = generateUpiLink(app.scheme);
    
    // Try to open the UPI app using multiple methods for better compatibility
    const link = document.createElement('a');
    link.href = upiLink;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Fallback: Also try window.open for some browsers
    setTimeout(() => {
      window.open(upiLink, '_self');
    }, 100);
    
    // Mark payment as initiated and show transaction ID input
    setPaymentInitiated(true);
    setInstantStep("confirm");
    
    toast({
      title: "Opening " + app.name,
      description: "Complete the payment and return to submit transaction ID",
    });
  };

  const handleSubmit = async () => {
    if (!amount || !transactionId) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("deposit_requests").insert({
        user_id: user.id,
        amount: parseFloat(amount),
        currency: "USD",
        payment_method: depositMode === "instant" ? "upi" : paymentMethod,
        transaction_id: transactionId,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Deposit request submitted successfully. Awaiting admin approval.",
      });

      setAmount("");
      setTransactionId("");
      setDepositMode("select");
      setInstantStep("amount");
      setPaymentInitiated(false);
      onOpenChange(false);
      onSuccess();
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

  const handleBack = () => {
    if (depositMode === "instant") {
      if (instantStep === "apps") {
        setInstantStep("amount");
      } else if (instantStep === "confirm") {
        setInstantStep("apps");
        setPaymentInitiated(false);
      } else {
        setDepositMode("select");
      }
    } else {
      setDepositMode("select");
    }
  };

  // Mode Selection Screen
  const renderModeSelection = () => (
    <div className="space-y-4 py-6">
      <div 
        className="p-4 border-2 border-primary/50 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 cursor-pointer hover:border-primary transition-all"
        onClick={() => setDepositMode("instant")}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Instant Deposit</h3>
            <p className="text-sm text-muted-foreground">Pay directly via PhonePe, GPay, Paytm</p>
          </div>
          <div className="text-primary text-2xl">→</div>
        </div>
      </div>

      <div 
        className="p-4 border border-border rounded-xl bg-card/50 cursor-pointer hover:border-primary/50 transition-all"
        onClick={() => setDepositMode("manual")}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Manual Deposit</h3>
            <p className="text-sm text-muted-foreground">UPI / QR Code / Net Banking</p>
          </div>
          <div className="text-muted-foreground text-2xl">→</div>
        </div>
      </div>
    </div>
  );

  // Instant Deposit - Amount Step
  const renderInstantAmount = () => (
    <div className="space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      
      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">Instant UPI Deposit</h3>
        <p className="text-muted-foreground text-sm">Enter amount and select your UPI app</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instant-amount">Amount (INR)</Label>
        <Input
          id="instant-amount"
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          className="text-xl h-14 text-center font-semibold"
        />
      </div>

      <Button
        className="w-full h-12"
        onClick={() => setInstantStep("apps")}
        disabled={!amount || parseFloat(amount) <= 0}
      >
        <Smartphone className="h-5 w-5 mr-2" />
        Select UPI App
      </Button>
    </div>
  );

  // Instant Deposit - App Selection Step
  const renderAppSelection = () => (
    <div className="space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-1">Amount to pay</p>
        <p className="text-3xl font-bold text-primary">₹{parseFloat(amount).toLocaleString()}</p>
      </div>

      <div className="space-y-3">
        <Label>Select Payment App</Label>
        {UPI_APPS.map((app) => (
          <div
            key={app.name}
            className="p-4 border border-border rounded-xl bg-card hover:border-primary/50 cursor-pointer transition-all active:scale-[0.98]"
            onClick={() => handleUpiAppSelect(app)}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl ${app.color} flex items-center justify-center text-2xl`}>
                {app.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{app.name}</h3>
                <p className="text-xs text-muted-foreground">Tap to pay ₹{parseFloat(amount).toLocaleString()}</p>
              </div>
              <div className="text-primary">→</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You'll be redirected to the app. After payment, come back here to submit your transaction ID.
      </p>
    </div>
  );

  // Instant Deposit - Confirm Transaction Step
  const renderConfirmTransaction = () => (
    <div className="space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold mb-2">Payment Completed?</h3>
        <p className="text-muted-foreground text-sm">Submit your transaction ID to confirm deposit</p>
      </div>

      <div className="p-4 border border-border rounded-lg bg-muted/30">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount Paid</span>
          <span className="font-semibold">₹{parseFloat(amount).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-muted-foreground">Paid To</span>
          <span className="font-semibold">{upiId}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="txn-id">Transaction ID / UTR Number</Label>
        <Input
          id="txn-id"
          placeholder="Enter 12-digit UTR or Transaction ID"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">
          Find this in your UPI app's transaction history
        </p>
      </div>

      <Button
        className="w-full h-12"
        onClick={handleSubmit}
        disabled={loading || !transactionId}
      >
        {loading ? "Submitting..." : "Submit Deposit Request"}
      </Button>
    </div>
  );

  // Manual Deposit (Original Flow)
  const renderManualDeposit = () => (
    <div className="space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      {/* Amount Input */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (USD)</Label>
        <Input
          id="amount"
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          step="0.01"
        />
      </div>

      {/* Payment Method Selection */}
      <div className="space-y-3">
        <Label>Select Payment Method</Label>
        <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="upi" id="upi" />
            <Label htmlFor="upi" className="cursor-pointer">UPI / QR Code</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="netbanking" id="netbanking" />
            <Label htmlFor="netbanking" className="cursor-pointer">Net Banking</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Payment Details */}
      {paymentMethod === "upi" ? (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
          <div className="text-center">
            <h3 className="font-semibold mb-3">Scan QR Code</h3>
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-lg">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Payment QR Code" className="w-[200px] h-[200px] object-contain" />
                ) : (
                  <QRCodeSVG value={`upi://pay?pa=${upiId}&pn=CoinGoldFX&cu=INR`} size={200} />
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">Or use UPI ID:</div>
            <div className="flex items-center justify-center gap-2">
              <code className="bg-background px-3 py-2 rounded">{upiId}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(upiId)}
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20">
          <h3 className="font-semibold">Bank Transfer Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Name:</span>
              <span className="font-medium">{bankDetails.accountName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Account Number:</span>
              <div className="flex items-center gap-2">
                <code className="bg-background px-2 py-1 rounded text-xs">{bankDetails.accountNumber}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(bankDetails.accountNumber)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IFSC Code:</span>
              <span className="font-medium">{bankDetails.ifsc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank Name:</span>
              <span className="font-medium">{bankDetails.bankName}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction ID Input */}
      <div className="space-y-2">
        <Label htmlFor="transactionId">Transaction ID / UTR Number</Label>
        <Input
          id="transactionId"
          placeholder="Enter your transaction ID or UTR number"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Enter the transaction reference number from your payment
        </p>
      </div>

      {/* Submit Button */}
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={loading || !amount || !transactionId}
      >
        {loading ? "Submitting..." : "Submit Deposit Request"}
      </Button>
    </div>
  );

  const renderContent = () => {
    if (depositMode === "select") {
      return renderModeSelection();
    }
    
    if (depositMode === "instant") {
      switch (instantStep) {
        case "amount":
          return renderInstantAmount();
        case "apps":
          return renderAppSelection();
        case "confirm":
          return renderConfirmTransaction();
        default:
          return renderInstantAmount();
      }
    }
    
    return renderManualDeposit();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {depositMode === "select" ? "Deposit Funds" : 
             depositMode === "instant" ? "Instant Deposit" : "Manual Deposit"}
          </SheetTitle>
          <SheetDescription>
            {depositMode === "select" ? "Choose your preferred deposit method" :
             depositMode === "instant" ? "Quick payment via UPI apps" :
             "Complete payment and submit transaction details"}
          </SheetDescription>
        </SheetHeader>

        {renderContent()}
      </SheetContent>
    </Sheet>
  );
};

export default DepositModal;
