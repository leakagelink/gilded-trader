import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, RefreshCw, FileCheck, Eye, Download, FileImage, ExternalLink, UserPlus, Search, Upload } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface UserWithoutKYC {
  id: string;
  full_name: string | null;
  email: string | null;
}

export const AdminKYCManagement = () => {
  const { toast } = useToast();
  const [kycSubmissions, setKycSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKYC, setSelectedKYC] = useState<KYCSubmission | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  
  // Manual KYC state
  const [manualKycOpen, setManualKycOpen] = useState(false);
  const [usersWithoutKyc, setUsersWithoutKyc] = useState<UserWithoutKYC[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [manualKycForm, setManualKycForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    country: "",
    address: "",
    city: "",
    postal_code: "",
    id_document_type: "passport"
  });
  const [uploading, setUploading] = useState(false);
  const [uploadedDocumentPath, setUploadedDocumentPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter users for search in manual KYC dialog
  const filteredUsersForManualKyc = userSearchQuery.trim() 
    ? usersWithoutKyc.filter(user => 
        (user.full_name?.toLowerCase() || '').includes(userSearchQuery.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(userSearchQuery.toLowerCase())
      )
    : usersWithoutKyc;

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

  const fetchUsersWithoutKYC = async () => {
    try {
      // First, get all users
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      if (profilesError) throw profilesError;

      // Get users who already have KYC submissions
      const { data: kycUsers, error: kycError } = await supabase
        .from("kyc_submissions")
        .select("user_id");

      if (kycError) throw kycError;

      const kycUserIds = new Set(kycUsers?.map(k => k.user_id) || []);
      
      // Filter out users who already have KYC
      const usersWithoutKyc = allProfiles?.filter(p => !kycUserIds.has(p.id)) || [];
      setUsersWithoutKyc(usersWithoutKyc);
    } catch (error: any) {
      console.error("Error fetching users without KYC:", error);
    }
  };

  const handleOpenManualKyc = () => {
    fetchUsersWithoutKYC();
    setManualKycOpen(true);
    setSelectedUserId("");
    setUserSearchQuery("");
    setManualKycForm({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      country: "",
      address: "",
      city: "",
      postal_code: "",
      id_document_type: "passport"
    });
    setUploadedDocumentPath(null);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUserId) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setUploadedDocumentPath(fileName);
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitManualKyc = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    if (!manualKycForm.first_name || !manualKycForm.last_name || !manualKycForm.date_of_birth || 
        !manualKycForm.country || !manualKycForm.address || !manualKycForm.city || !manualKycForm.postal_code) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create KYC submission with approved status
      const { error } = await supabase
        .from("kyc_submissions")
        .insert({
          user_id: selectedUserId,
          first_name: manualKycForm.first_name,
          last_name: manualKycForm.last_name,
          date_of_birth: manualKycForm.date_of_birth,
          country: manualKycForm.country,
          address: manualKycForm.address,
          city: manualKycForm.city,
          postal_code: manualKycForm.postal_code,
          id_document_type: manualKycForm.id_document_type,
          document_url: uploadedDocumentPath,
          status: "approved",
          reviewed_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "KYC submitted and approved successfully",
      });

      setManualKycOpen(false);
      fetchKYCSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadDocument = async (documentPath: string | null) => {
    if (!documentPath) {
      setDocumentUrl(null);
      return;
    }

    try {
      setLoadingDocument(true);
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(documentPath, 3600); // 1 hour expiry

      if (error) throw error;
      setDocumentUrl(data.signedUrl);
    } catch (error: any) {
      console.error("Error loading document:", error);
      setDocumentUrl(null);
    } finally {
      setLoadingDocument(false);
    }
  };

  const sendKYCNotification = async (email: string, userName: string, status: "approved" | "rejected", rejectionReason?: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-kyc-notification", {
        body: { email, userName, status, rejectionReason },
      });

      if (error) {
        console.error("Failed to send KYC notification email:", error);
      } else {
        console.log(`KYC ${status} notification sent to ${email}`);
      }
    } catch (err) {
      console.error("Error invoking send-kyc-notification:", err);
    }
  };

  const handleViewKYC = async (kyc: KYCSubmission) => {
    setSelectedKYC(kyc);
    setViewOpen(true);
    await loadDocument(kyc.document_url);
  };

  const handleApproveKYC = async (kycId: string) => {
    try {
      // Find the KYC submission to get user details
      const kyc = kycSubmissions.find(k => k.id === kycId);
      
      const { error } = await supabase.rpc("approve_kyc", {
        kyc_id: kycId,
      });

      if (error) throw error;

      // Send email notification
      if (kyc?.profiles?.email) {
        await sendKYCNotification(
          kyc.profiles.email,
          kyc.profiles.full_name || kyc.first_name,
          "approved"
        );
      }

      toast({
        title: "Success",
        description: "KYC approved and notification sent",
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

      // Send email notification
      if (selectedKYC.profiles?.email) {
        await sendKYCNotification(
          selectedKYC.profiles.email,
          selectedKYC.profiles.full_name || selectedKYC.first_name,
          "rejected",
          rejectionReason || undefined
        );
      }

      toast({
        title: "Success",
        description: "KYC rejected and notification sent",
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

  const isImageFile = (url: string | null) => {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          KYC Submissions
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handleOpenManualKyc}>
            <UserPlus className="h-4 w-4 mr-2" />
            Manual KYC
          </Button>
          <Button variant="outline" size="sm" onClick={fetchKYCSubmissions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
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
                  <TableHead>Document</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileImage className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm capitalize">{kyc.id_document_type.replace("-", " ")}</span>
                        {kyc.document_url && (
                          <Badge variant="outline" className="text-xs">Uploaded</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                    <TableCell>{formatDate(kyc.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewKYC(kyc)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC Details</DialogTitle>
            <DialogDescription>
              Review the submitted KYC information and documents
            </DialogDescription>
          </DialogHeader>
          {selectedKYC && (
            <div className="space-y-6">
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

              {/* Document Preview */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground mb-3 block">Uploaded Document</Label>
                {loadingDocument ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">Loading document...</p>
                  </div>
                ) : documentUrl ? (
                  <div className="space-y-3">
                    {isImageFile(selectedKYC.document_url) ? (
                      <div className="border rounded-lg overflow-hidden">
                        <img 
                          src={documentUrl} 
                          alt="KYC Document" 
                          className="max-w-full max-h-96 mx-auto"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                        <FileImage className="h-10 w-10 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">PDF Document</p>
                          <p className="text-sm text-muted-foreground">Click to view the document</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(documentUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={documentUrl} download>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 bg-muted rounded-lg">
                    <p className="text-muted-foreground">No document uploaded</p>
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

      {/* Manual KYC Dialog */}
      <Dialog open={manualKycOpen} onOpenChange={setManualKycOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual KYC Submission</DialogTitle>
            <DialogDescription>
              Submit KYC for a user who can't complete it themselves
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-2 sticky top-0 bg-popover z-10">
                    <Input
                      placeholder="Search users..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    {filteredUsersForManualKyc.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || 'No Name'} ({user.email})
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            {selectedUserId && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>First Name</Label><Input value={manualKycForm.first_name} onChange={(e) => setManualKycForm(p => ({...p, first_name: e.target.value}))} /></div>
                  <div><Label>Last Name</Label><Input value={manualKycForm.last_name} onChange={(e) => setManualKycForm(p => ({...p, last_name: e.target.value}))} /></div>
                </div>
                <div><Label>Date of Birth</Label><Input type="date" value={manualKycForm.date_of_birth} onChange={(e) => setManualKycForm(p => ({...p, date_of_birth: e.target.value}))} /></div>
                <div><Label>Country</Label><Input value={manualKycForm.country} onChange={(e) => setManualKycForm(p => ({...p, country: e.target.value}))} /></div>
                <div><Label>Address</Label><Input value={manualKycForm.address} onChange={(e) => setManualKycForm(p => ({...p, address: e.target.value}))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>City</Label><Input value={manualKycForm.city} onChange={(e) => setManualKycForm(p => ({...p, city: e.target.value}))} /></div>
                  <div><Label>Postal Code</Label><Input value={manualKycForm.postal_code} onChange={(e) => setManualKycForm(p => ({...p, postal_code: e.target.value}))} /></div>
                </div>
                <div>
                  <Label>Document Type</Label>
                  <Select value={manualKycForm.id_document_type} onValueChange={(v) => setManualKycForm(p => ({...p, id_document_type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="aadhar">Aadhar Card</SelectItem>
                      <SelectItem value="pan">PAN Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Upload Document</Label>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleDocumentUpload} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading..." : "Choose File"}
                  </Button>
                  {uploadedDocumentPath && <Badge className="ml-2 bg-green-500">Uploaded</Badge>}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualKycOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitManualKyc} disabled={!selectedUserId} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />Submit & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
