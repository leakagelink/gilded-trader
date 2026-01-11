import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCheck, Upload, CheckCircle, Clock, XCircle, X, FileImage } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";

interface KYCData {
  id: string;
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
}

const KYC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [idDocumentType, setIdDocumentType] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchKYCData();
    }
  }, [user, authLoading, navigate]);

  const fetchKYCData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setKycData(data as KYCData);
        // Pre-fill form with existing data
        setFirstName(data.first_name);
        setLastName(data.last_name);
        setDateOfBirth(data.date_of_birth);
        setCountry(data.country);
        setAddress(data.address);
        setCity(data.city);
        setPostalCode(data.postal_code);
        setIdDocumentType(data.id_document_type);
        
        // Load existing document URL
        if (data.document_url) {
          setUploadedFileUrl(data.document_url);
        }
      }
    } catch (error: any) {
      console.error("Error fetching KYC data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or PDF file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadedFile(file);
    
    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setUploadedFileUrl(previewUrl);
    } else {
      setUploadedFileUrl(null);
    }
  };

  const uploadDocument = async (): Promise<string | null> => {
    if (!uploadedFile || !user) return null;

    try {
      setUploading(true);
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, uploadedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get the file path (not public URL since bucket is private)
      return fileName;
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setUploadedFileUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Please login to submit KYC");
      return;
    }

    if (!firstName || !lastName || !dateOfBirth || !country || !address || !city || !postalCode || !idDocumentType) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!uploadedFile && !kycData?.document_url) {
      toast.error("Please upload your ID document");
      return;
    }

    try {
      setSubmitting(true);

      // Upload document if a new file was selected
      let documentUrl = kycData?.document_url || null;
      if (uploadedFile) {
        const uploadedPath = await uploadDocument();
        if (uploadedPath) {
          documentUrl = uploadedPath;
        } else if (!kycData?.document_url) {
          // Upload failed and no existing document
          return;
        }
      }

      const kycPayload = {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        country: country,
        address: address,
        city: city,
        postal_code: postalCode,
        id_document_type: idDocumentType,
        document_url: documentUrl,
        status: 'pending' as const,
      };

      if (kycData) {
        // Update existing submission
        const { error } = await supabase
          .from("kyc_submissions")
          .update(kycPayload)
          .eq("id", kycData.id);

        if (error) throw error;
      } else {
        // Create new submission
        const { error } = await supabase
          .from("kyc_submissions")
          .insert(kycPayload);

        if (error) throw error;
      }

      toast.success("KYC documents submitted for verification!");
      fetchKYCData();
    } catch (error: any) {
      console.error("Error submitting KYC:", error);
      toast.error(error.message || "Failed to submit KYC");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
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

  const getStepStatus = (step: number) => {
    if (!kycData) {
      return step === 1 ? "current" : "pending";
    }
    if (kycData.status === "approved") {
      return "completed";
    }
    if (kycData.status === "pending") {
      return step <= 2 ? "completed" : "current";
    }
    // rejected - allow re-submission
    return step === 1 ? "current" : "pending";
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="CoinGoldFX" className="h-10 w-auto object-contain" />
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <FileCheck className="h-8 w-8" />
            KYC Verification
          </h1>
          <p className="text-muted-foreground">Complete your identity verification to unlock all features</p>
        </div>

        {/* KYC Status Banner */}
        {kycData && (
          <Card className={`p-4 mb-6 ${
            kycData.status === "approved" ? "bg-green-500/10 border-green-500" :
            kycData.status === "rejected" ? "bg-destructive/10 border-destructive" :
            "bg-yellow-500/10 border-yellow-500"
          }`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(kycData.status)}
              <div className="flex-1">
                <p className="font-semibold">KYC Status: {getStatusBadge(kycData.status)}</p>
                {kycData.status === "pending" && (
                  <p className="text-sm text-muted-foreground">Your KYC is under review. Please wait for admin approval.</p>
                )}
                {kycData.status === "approved" && (
                  <p className="text-sm text-muted-foreground">Your KYC has been verified successfully!</p>
                )}
                {kycData.status === "rejected" && (
                  <p className="text-sm text-destructive">
                    {kycData.rejection_reason || "Your KYC was rejected. Please update and resubmit."}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Verification Steps */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { step: "1", title: "Personal Info", status: getStepStatus(1) },
            { step: "2", title: "Upload Documents", status: getStepStatus(2) },
            { step: "3", title: "Verification", status: getStepStatus(3) },
          ].map((item, index) => (
            <Card key={index} className={`p-4 text-center ${
              item.status === "completed" ? 'bg-primary/10 border-primary' : ''
            }`}>
              <div className={`h-10 w-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                item.status === "completed" ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                {item.status === "completed" ? <CheckCircle className="h-5 w-5" /> : item.step}
              </div>
              <div className="font-semibold">{item.title}</div>
            </Card>
          ))}
        </div>

        {/* KYC Form - Show if not approved */}
        {(!kycData || kycData.status !== "approved") && (
          <Card className="p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-6">Personal Information</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input 
                    id="first-name" 
                    type="text" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input 
                    id="last-name" 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input 
                  id="dob" 
                  type="date" 
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="India">India</SelectItem>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                    <SelectItem value="Germany">Germany</SelectItem>
                    <SelectItem value="France">France</SelectItem>
                    <SelectItem value="Japan">Japan</SelectItem>
                    <SelectItem value="Singapore">Singapore</SelectItem>
                    <SelectItem value="UAE">UAE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    type="text" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal">Postal Code</Label>
                  <Input 
                    id="postal" 
                    type="text" 
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="id-type">ID Document Type</Label>
                <Select value={idDocumentType} onValueChange={setIdDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers-license">Driver's License</SelectItem>
                    <SelectItem value="national-id">National ID Card</SelectItem>
                    <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                    <SelectItem value="pan-card">PAN Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Upload ID Document *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {!uploadedFile && !uploadedFileUrl ? (
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, JPG or PNG (max. 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {uploadedFileUrl && uploadedFile?.type.startsWith('image/') ? (
                          <img 
                            src={uploadedFileUrl} 
                            alt="Document preview" 
                            className="h-16 w-16 object-cover rounded"
                          />
                        ) : (
                          <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                            <FileImage className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {uploadedFile?.name || "Document uploaded"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB` : "Previously uploaded"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Document
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                disabled={submitting || uploading}
              >
                {submitting || uploading ? "Submitting..." : kycData ? "Update & Resubmit" : "Submit for Verification"}
              </Button>
            </form>
          </Card>
        )}

        {/* Success Message for Approved KYC */}
        {kycData?.status === "approved" && (
          <Card className="p-6 mb-6 bg-green-500/10 border-green-500">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">KYC Verified!</h2>
              <p className="text-muted-foreground">Your identity has been verified. You now have full access to all trading features.</p>
            </div>
          </Card>
        )}

        <Card className="p-6 bg-muted/30">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Why KYC is Important
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Ensures platform security and prevents fraud</li>
            <li>• Complies with international regulations</li>
            <li>• Unlocks higher trading limits</li>
            <li>• Enables faster withdrawals</li>
          </ul>
        </Card>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};

export default KYC;
