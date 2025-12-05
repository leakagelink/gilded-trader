import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DepositModal = ({ open, onOpenChange, onSuccess }: DepositModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "netbanking">("upi");
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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
        payment_method: paymentMethod,
        transaction_id: transactionId,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Deposit request submitted successfully. Awaiting admin approval.",
      });

      setAmount("");
      setTransactionId("");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Deposit Funds</SheetTitle>
          <SheetDescription>Choose your payment method and complete the transaction</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
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
      </SheetContent>
    </Sheet>
  );
};

export default DepositModal;
