import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Shield, Users, Wallet, Settings, SettingsIcon, 
  Check, X, RefreshCw, Edit, Trash2, DollarSign, FileText, ArrowUpRight 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { AdminTradeManagement } from "@/components/AdminTradeManagement";
import { AdminAPIManagement } from "@/components/AdminAPIManagement";
import { AdminKYCManagement } from "@/components/AdminKYCManagement";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("approvals");

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Deposits state
  const [depositRequests, setDepositRequests] = useState<any[]>([]);

  // Withdrawals state
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [approveWithdrawalOpen, setApproveWithdrawalOpen] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [rejectWithdrawalOpen, setRejectWithdrawalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState({
    upiId: "coingoldfx@upi",
    qrCodeUrl: "",
    accountName: "CoinGoldFX Account",
    accountNumber: "1234567890",
    ifsc: "BANK0001234",
    bankName: "Demo Bank",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin, activeTab]);
  
  // Update countdown timer every second for approvals tab
  useEffect(() => {
    if (activeTab === 'approvals' && pendingUsers.length > 0) {
      const interval = setInterval(() => {
        // Force re-render to update time remaining
        setPendingUsers(prev => [...prev]);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab, pendingUsers.length]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const hasAdminRole = roles?.some((r) => r.role === "admin");
      if (!hasAdminRole) {
        toast({
          title: "Access Denied",
          description: "You need admin privileges to access this page",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);
      
      // Separate pending users
      const pending = usersData?.filter(u => !u.is_approved) || [];
      setPendingUsers(pending);

      // Fetch wallets
      const { data: walletsData, error: walletsError } = await supabase
        .from("user_wallets")
        .select("*");

      if (walletsError) throw walletsError;
      setWallets(walletsData || []);

      // Fetch deposit requests
      const { data: depositsData, error: depositsError } = await supabase
        .from("deposit_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (depositsError) throw depositsError;
      
      // Fetch user profiles for deposits
      const depositUserIds = depositsData?.map(d => d.user_id) || [];
      const { data: depositProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", depositUserIds);
      
      // Merge profiles with deposits
      const depositsWithProfiles = depositsData?.map(deposit => ({
        ...deposit,
        profiles: depositProfiles?.find(p => p.id === deposit.user_id)
      })) || [];
      
      setDepositRequests(depositsWithProfiles);

      // Fetch withdrawal requests
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (withdrawalsError) throw withdrawalsError;
      
      // Fetch user profiles for withdrawals
      const withdrawalUserIds = withdrawalsData?.map(w => w.user_id) || [];
      const { data: withdrawalProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", withdrawalUserIds);
      
      // Merge profiles with withdrawals
      const withdrawalsWithProfiles = withdrawalsData?.map(withdrawal => ({
        ...withdrawal,
        profiles: withdrawalProfiles?.find(p => p.id === withdrawal.user_id)
      })) || [];
      
      setWithdrawalRequests(withdrawalsWithProfiles);

      // Fetch payment settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("payment_settings")
        .select("*");

      if (settingsError) throw settingsError;

      // Convert settings array to object
      if (settingsData) {
        const settings: any = {};
        settingsData.forEach((setting) => {
          const key = setting.setting_key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          settings[key] = setting.setting_value;
        });
        setPaymentSettings({
          upiId: settings.upiId || "coingoldfx@upi",
          qrCodeUrl: settings.qrCodeUrl || "",
          accountName: settings.accountName || "CoinGoldFX Account",
          accountNumber: settings.accountNumber || "1234567890",
          ifsc: settings.ifscCode || "BANK0001234",
          bankName: settings.bankName || "Demo Bank",
        });
      }
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

  const getUserBalance = (userId: string) => {
    const userWallet = wallets.find((w) => w.user_id === userId && w.currency === "USD");
    return userWallet ? Number(userWallet.balance).toFixed(2) : "0.00";
  };

  const handleEditBalance = (user: any) => {
    setSelectedUser(user);
    setBalanceAmount(getUserBalance(user.id));
    setEditBalanceOpen(true);
  };

  const handleSaveBalance = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("user_wallets")
        .upsert({
          user_id: selectedUser.id,
          currency: "USD",
          balance: parseFloat(balanceAmount),
        }, {
          onConflict: "user_id,currency",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Balance updated successfully",
      });

      setEditBalanceOpen(false);
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Call edge function to delete user
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: userToDelete.id },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setDeleteUserOpen(false);
      setUserToDelete(null);
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveDeposit = async (depositId: string) => {
    try {
      // Find the deposit to get user info
      const deposit = depositRequests.find(d => d.id === depositId);
      
      const { error } = await supabase.rpc("approve_deposit", {
        deposit_id: depositId,
      });

      if (error) throw error;

      // Send email notification
      if (deposit?.profiles?.email) {
        try {
          await supabase.functions.invoke("send-deposit-notification", {
            body: {
              email: deposit.profiles.email,
              userName: deposit.profiles.full_name || "Trader",
              status: "approved",
              amount: deposit.amount,
              currency: deposit.currency,
            },
          });
        } catch (emailError) {
          console.error("Failed to send deposit notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "Deposit approved and wallet updated",
      });

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    try {
      // Find the deposit to get user info
      const deposit = depositRequests.find(d => d.id === depositId);
      const rejectionReason = "Rejected by admin";
      
      const { error } = await supabase
        .from("deposit_requests")
        .update({ status: "rejected", rejection_reason: rejectionReason })
        .eq("id", depositId);

      if (error) throw error;

      // Send email notification
      if (deposit?.profiles?.email) {
        try {
          await supabase.functions.invoke("send-deposit-notification", {
            body: {
              email: deposit.profiles.email,
              userName: deposit.profiles.full_name || "Trader",
              status: "rejected",
              amount: deposit.amount,
              currency: deposit.currency,
              rejectionReason: rejectionReason,
            },
          });
        } catch (emailError) {
          console.error("Failed to send deposit notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "Deposit request rejected",
      });

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveWithdrawal = async () => {
    if (!selectedWithdrawal) return;

    try {
      const { error } = await supabase.rpc("approve_withdrawal", {
        withdrawal_id: selectedWithdrawal.id,
        transaction_ref: transactionRef || null,
      });

      if (error) throw error;

      // Send email notification
      if (selectedWithdrawal.profiles?.email) {
        try {
          await supabase.functions.invoke("send-withdrawal-notification", {
            body: {
              email: selectedWithdrawal.profiles.email,
              userName: selectedWithdrawal.profiles.full_name || "Trader",
              status: "approved",
              amount: selectedWithdrawal.amount,
              currency: selectedWithdrawal.currency,
              transactionRef: transactionRef || null,
            },
          });
        } catch (emailError) {
          console.error("Failed to send withdrawal notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "Withdrawal approved and wallet updated",
      });

      setApproveWithdrawalOpen(false);
      setSelectedWithdrawal(null);
      setTransactionRef("");
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectWithdrawal = async () => {
    if (!selectedWithdrawal) return;

    try {
      const { error } = await supabase.rpc("reject_withdrawal", {
        withdrawal_id: selectedWithdrawal.id,
        reason: rejectionReason || null,
      });

      if (error) throw error;

      // Send email notification
      if (selectedWithdrawal.profiles?.email) {
        try {
          await supabase.functions.invoke("send-withdrawal-notification", {
            body: {
              email: selectedWithdrawal.profiles.email,
              userName: selectedWithdrawal.profiles.full_name || "Trader",
              status: "rejected",
              amount: selectedWithdrawal.amount,
              currency: selectedWithdrawal.currency,
              rejectionReason: rejectionReason || null,
            },
          });
        } catch (emailError) {
          console.error("Failed to send withdrawal notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "Withdrawal request rejected",
      });

      setRejectWithdrawalOpen(false);
      setSelectedWithdrawal(null);
      setRejectionReason("");
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      // Find the user to get email info
      const user = pendingUsers.find(u => u.id === userId) || users.find(u => u.id === userId);
      
      const { error } = await supabase.rpc("approve_user", {
        target_user_id: userId,
      });

      if (error) throw error;

      // Send email notification
      if (user?.email) {
        try {
          await supabase.functions.invoke("send-account-notification", {
            body: {
              email: user.email,
              userName: user.full_name || "Trader",
              status: "activated",
            },
          });
        } catch (emailError) {
          console.error("Failed to send account activation email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "User account activated successfully",
      });

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: false })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User account deactivated successfully",
      });

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const hoursPassed = (now - created) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, 24 - hoursPassed);
    return hoursRemaining.toFixed(1);
  };

  const handleSavePaymentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update payment settings in database
      const settingsToUpdate = [
        { setting_key: "upi_id", setting_value: paymentSettings.upiId },
        { setting_key: "qr_code_url", setting_value: paymentSettings.qrCodeUrl },
        { setting_key: "account_name", setting_value: paymentSettings.accountName },
        { setting_key: "account_number", setting_value: paymentSettings.accountNumber },
        { setting_key: "ifsc_code", setting_value: paymentSettings.ifsc },
        { setting_key: "bank_name", setting_value: paymentSettings.bankName },
      ];

      for (const setting of settingsToUpdate) {
        const { error } = await supabase
          .from("payment_settings")
          .update({
            setting_value: setting.setting_value,
            updated_by: user.id,
          })
          .eq("setting_key", setting.setting_key);

        if (error) throw error;
      }

      toast({
        title: "Settings Saved",
        description: "Payment details updated successfully",
      });

      setSettingsOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Verifying admin access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Admin Panel
            </span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Approvals
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="trades" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trades
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="deposits" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Deposits
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Withdrawals
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              KYC
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Payment Settings
            </TabsTrigger>
          </TabsList>

          {/* User Approvals Tab */}
          <TabsContent value="approvals">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      User Approvals
                    </CardTitle>
                    <CardDescription>Activate or deactivate user accounts</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {pendingUsers.length} Pending
                    </Badge>
                    <Button onClick={fetchAllData} variant="outline" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading users...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Pending Users */}
                    {pendingUsers.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-amber-600">Pending Approval ({pendingUsers.length})</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Signup Date</TableHead>
                              <TableHead>Time Remaining</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingUsers.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                  {user.full_name || "N/A"}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(user.created_at).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {getTimeRemaining(user.created_at)}h left
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveUser(user.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Activate
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    
                    {/* Active Users */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-green-600">Active Users ({users.filter(u => u.is_approved).length})</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Activated Date</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.filter(u => u.is_approved).map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">
                                {user.full_name || "N/A"}
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {user.approved_at ? new Date(user.approved_at).toLocaleString() : "N/A"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeactivateUser(user.id)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Deactivate
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Management
                    </CardTitle>
                    <CardDescription>View and manage all registered users</CardDescription>
                  </div>
                  <Button onClick={fetchAllData} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading users...</p>
                ) : users.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No users found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Balance (USD)</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.full_name || "N/A"}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell className="font-semibold">
                            ${getUserBalance(user.id)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditBalance(user)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit Balance
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setUserToDelete(user);
                                  setDeleteUserOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades">
            <AdminTradeManagement />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api">
            <AdminAPIManagement />
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Deposit Management
                    </CardTitle>
                    <CardDescription>Review and approve deposit requests</CardDescription>
                  </div>
                  <Button onClick={fetchAllData} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading deposits...</p>
                ) : depositRequests.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No deposit requests</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.profiles?.full_name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.profiles?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ${Number(request.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {request.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {request.transaction_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                request.status === "approved"
                                  ? "default"
                                  : request.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveDeposit(request.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectDeposit(request.id)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpRight className="h-5 w-5" />
                      Withdrawal Management
                    </CardTitle>
                    <CardDescription>Review and approve withdrawal requests</CardDescription>
                  </div>
                  <Button onClick={fetchAllData} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading withdrawals...</p>
                ) : withdrawalRequests.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No withdrawal requests</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Account Details</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.profiles?.full_name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.profiles?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ${Number(request.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {request.withdrawal_method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {request.withdrawal_method === "bank" ? (
                                <>
                                  <div><strong>Name:</strong> {request.account_details.accountName}</div>
                                  <div><strong>Acc:</strong> {request.account_details.accountNumber}</div>
                                  <div><strong>IFSC:</strong> {request.account_details.ifscCode}</div>
                                  <div><strong>Bank:</strong> {request.account_details.bankName}</div>
                                </>
                              ) : (
                                <div><strong>UPI:</strong> {request.account_details.upiId}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                request.status === "approved"
                                  ? "default"
                                  : request.status === "rejected"
                                  ? "destructive"
                                  : request.status === "processing"
                                  ? "secondary"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedWithdrawal(request);
                                    setApproveWithdrawalOpen(true);
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedWithdrawal(request);
                                    setRejectWithdrawalOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KYC Management Tab */}
          <TabsContent value="kyc">
            <AdminKYCManagement />
          </TabsContent>

          {/* Payment Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Payment Settings
                </CardTitle>
                <CardDescription>Configure UPI and bank transfer details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* UPI Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    UPI Settings
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input
                      id="upiId"
                      value={paymentSettings.upiId}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, upiId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qrCodeUrl">QR Code Image URL</Label>
                    <Input
                      id="qrCodeUrl"
                      placeholder="https://example.com/your-qr-code.png"
                      value={paymentSettings.qrCodeUrl}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, qrCodeUrl: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the URL of your custom QR code image. Leave empty to auto-generate from UPI ID.
                    </p>
                    {paymentSettings.qrCodeUrl && (
                      <div className="mt-2 p-2 border rounded-lg bg-white inline-block">
                        <img 
                          src={paymentSettings.qrCodeUrl} 
                          alt="QR Code Preview" 
                          className="w-32 h-32 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank Transfer Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Bank Transfer Settings
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account Name</Label>
                      <Input
                        id="accountName"
                        value={paymentSettings.accountName}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, accountName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        value={paymentSettings.accountNumber}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, accountNumber: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc">IFSC Code</Label>
                      <Input
                        id="ifsc"
                        value={paymentSettings.ifsc}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, ifsc: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        value={paymentSettings.bankName}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, bankName: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSavePaymentSettings} className="w-full">
                  Save Payment Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Balance Dialog */}
      <Dialog open={editBalanceOpen} onOpenChange={setEditBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Balance</DialogTitle>
            <DialogDescription>
              Update the balance for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="balance">Balance (USD)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBalanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBalance}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {userToDelete?.full_name || userToDelete?.email} and all
              their data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Withdrawal Dialog */}
      <Dialog open={approveWithdrawalOpen} onOpenChange={setApproveWithdrawalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Withdrawal</DialogTitle>
            <DialogDescription>
              Approve withdrawal request for {selectedWithdrawal?.profiles?.full_name || selectedWithdrawal?.profiles?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Withdrawal Amount</Label>
              <div className="font-semibold text-lg">
                ${Number(selectedWithdrawal?.amount || 0).toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transactionRef">Transaction Reference (Optional)</Label>
              <Input
                id="transactionRef"
                placeholder="Enter transaction reference number"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Add a reference number for tracking purposes
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveWithdrawalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveWithdrawal} className="bg-green-600 hover:bg-green-700">
              Approve Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Withdrawal Dialog */}
      <Dialog open={rejectWithdrawalOpen} onOpenChange={setRejectWithdrawalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this withdrawal request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Withdrawal Amount</Label>
              <div className="font-semibold text-lg">
                ${Number(selectedWithdrawal?.amount || 0).toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Enter reason for rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectWithdrawalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRejectWithdrawal} variant="destructive">
              Reject Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
