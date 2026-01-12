import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccountNotificationRequest {
  email: string;
  userName: string;
  status: "activated" | "deactivated";
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Account notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userName, status }: AccountNotificationRequest = await req.json();

    console.log(`Sending account ${status} notification to ${email}`);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isActivated = status === "activated";
    
    const subject = isActivated 
      ? "🎉 Your TradePro Account is Now Active!" 
      : "Account Status Update";

    const htmlContent = isActivated 
      ? `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚀 Account Activated!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Great news! Your TradePro account has been <strong style="color: #10b981;">activated</strong> by our admin team.
            </p>
            <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #065f46; font-size: 18px; font-weight: bold;">✅ Your account is ready!</p>
            </div>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              You now have full access to:
            </p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>Trade cryptocurrencies and forex pairs</li>
              <li>Deposit and withdraw funds</li>
              <li>View real-time market data</li>
              <li>Manage your portfolio</li>
            </ul>
            <div style="text-align: center; margin-top: 30px;">
              <p style="font-size: 16px; color: #374151;">
                Login now and start trading!
              </p>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
              Thank you for choosing TradePro!
            </p>
          </div>
        </div>
      `
      : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Account Status Update</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Your TradePro account has been temporarily deactivated.
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Please contact our support team if you have any questions or need assistance.
            </p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
              TradePro Support Team
            </p>
          </div>
        </div>
      `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CoinGoldFX <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Log error but return 200 to prevent blocking the main flow
      console.error("Resend API error (non-blocking):", data);
      console.log("Email delivery failed but returning success to avoid blocking account flow");
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "Email delivery failed - domain verification required" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, emailSent: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    // Log error but return 200 to prevent blocking the main flow
    console.error("Error sending account notification (non-blocking):", error);
    return new Response(
      JSON.stringify({ success: true, emailSent: false, reason: error.message }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
