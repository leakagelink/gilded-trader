import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X, RefreshCw, FileCheck, Eye } from "lucide-react";
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

interface KYCSubmission {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  country: string;
  address: string;
  city: string;
  postal_code: string;
  id_document_type: string;
  document_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export const AdminKYCManagement = () => {
  const { toast } = useToast();
  const [kycSubmissions, setKycSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKYC, setSelectedKYC] = useState<KYCSubmission | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchKYCSubmissions();
  }, []);

  const fetchKYCSubmissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = data?.map(k => k.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Merge profiles with submissions
      const submissionsWithProfiles = data?.map(submission => ({
        ...submission,
        profiles: profiles?.find(p => p.id === submission.user_id)
      })) || [];

      setKycSubmissions(submissionsWithProfiles as KYCSubmission[]);
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

  const handleApproveKYC = async (kycId: string) => {
    try {
      const { error } = await supabase.rpc("approve_kyc", {
        kyc_id: kycId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "KYC approved successfully",
      });

      fetchKYCSubmissions();
      setViewOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectKYC = async () => {
    if (!selectedKYC) return;

    try {
      const { error } = await supabase.rpc("reject_kyc", {
        kyc_id: selectedKYC.id,
        reason: rejectionReason || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "KYC rejected",
      });

      setRejectOpen(false);
      setRejectionReason("");
      setSelectedKYC(null);
      fetchKYCSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          KYC Submissions
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchKYCSubmissions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-4">Loading KYC submissions...</p>
        ) : kycSubmissions.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">No KYC submissions found</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kycSubmissions.map((kyc) => (
                  <TableRow key={kyc.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{kyc.profiles?.full_name || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">{kyc.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{kyc.first_name} {kyc.last_name}</TableCell>
                    <TableCell>{kyc.country}</TableCell>
                    <TableCell className="capitalize">{kyc.id_document_type.replace("-", " ")}</TableCell>
                    <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                    <TableCell>{formatDate(kyc.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedKYC(kyc);
                            setViewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {kyc.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApproveKYC(kyc.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedKYC(kyc);
                                setRejectOpen(true);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* View KYC Details Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>KYC Details</DialogTitle>
            <DialogDescription>
              Review the submitted KYC information
            </DialogDescription>
          </DialogHeader>
          {selectedKYC && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">First Name</Label>
                  <p className="font-medium">{selectedKYC.first_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Name</Label>
                  <p className="font-medium">{selectedKYC.last_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date of Birth</Label>
                  <p className="font-medium">{selectedKYC.date_of_birth}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Country</Label>
                  <p className="font-medium">{selectedKYC.country}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="font-medium">{selectedKYC.address}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">City</Label>
                  <p className="font-medium">{selectedKYC.city}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Postal Code</Label>
                  <p className="font-medium">{selectedKYC.postal_code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Document Type</Label>
                  <p className="font-medium capitalize">{selectedKYC.id_document_type.replace("-", " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedKYC.status)}</div>
                </div>
                {selectedKYC.rejection_reason && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Rejection Reason</Label>
                    <p className="font-medium text-destructive">{selectedKYC.rejection_reason}</p>
                  </div>
                )}
              </div>
              {selectedKYC.status === "pending" && (
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setViewOpen(false);
                      setRejectOpen(true);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApproveKYC(selectedKYC.id)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject KYC Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject KYC</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this KYC submission
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason (Optional)</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectKYC}>
              Reject KYC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
