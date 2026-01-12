import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import logo from "@/assets/logo.png";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Check URL for recovery token
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        if (type === 'recovery' && accessToken) {
          // We have a recovery token, session should be set
          setIsValidSession(true);
        } else if (session) {
          // Check if this is a recovery session by looking at the URL or session
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('reset') === 'true' || urlParams.get('type') === 'recovery') {
            setIsValidSession(true);
          } else {
            // Regular session, redirect to dashboard
            navigate("/dashboard");
          }
        } else {
          // No valid session, redirect to auth
          toast.error("Invalid or expired reset link. Please request a new one.");
          navigate("/auth");
        }
      } catch (error) {
        console.error("Error checking session:", error);
        toast.error("An error occurred. Please try again.");
        navigate("/auth");
      } finally {
        setIsChecking(false);
      }
    };

    // Listen for auth state changes (recovery token exchange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setIsChecking(false);
      } else if (event === 'SIGNED_IN' && session) {
        // Check if this came from a recovery flow
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        if (type === 'recovery') {
          setIsValidSession(true);
          setIsChecking(false);
        }
      }
    });

    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      passwordSchema.parse({ password, confirmPassword });

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setIsSuccess(true);
      toast.success("Password updated successfully!");
      
      // Sign out and redirect to login after a delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      }, 3000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src={logo} alt="CoinGoldFX" className="h-16 w-auto object-contain" />
          </div>
          <p className="text-muted-foreground">Verifying reset link...</p>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src={logo} alt="CoinGoldFX" className="h-16 w-auto object-contain" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold">Password Reset Successful!</h2>
            <p className="text-muted-foreground">
              Your password has been updated. Redirecting to login...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src={logo} alt="CoinGoldFX" className="h-16 w-auto object-contain" />
        </div>

        <h2 className="text-xl font-semibold text-center mb-2">Set New Password</h2>
        <p className="text-muted-foreground text-center text-sm mb-6">
          Enter your new password below.
        </p>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10 pr-10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
            disabled={isLoading}
          >
            {isLoading ? "Updating Password..." : "Update Password"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Button variant="link" onClick={() => navigate("/auth")}>
            Back to Sign In
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;
