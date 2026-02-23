import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KYCNotificationRequest {
  email: string;
  userName: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("KYC notification function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userName, status, rejectionReason }: KYCNotificationRequest = await req.json();

    console.log(`Sending KYC ${status} notification to ${email}`);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isApproved = status === "approved";
    
    const subject = isApproved 
      ? "🎉 Your KYC Verification is Approved!" 
      : "KYC Verification Update Required";

    const htmlContent = isApproved 
      ? `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✅ KYC Approved!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Great news! Your KYC verification has been <strong style="color: #10b981;">approved</strong>.
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              You now have full access to all trading features including:
            </p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>Unlimited trading limits</li>
              <li>Faster withdrawals</li>
              <li>Access to all trading pairs</li>
              <li>Premium customer support</li>
            </ul>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
              Thank you for choosing TradePro!
            </p>
          </div>
        </div>
      `
      : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">KYC Verification Update</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Unfortunately, your KYC verification could not be approved at this time.
            </p>
            ${rejectionReason ? `
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #991b1b; font-weight: 600;">Reason:</p>
                <p style="margin: 5px 0 0 0; color: #7f1d1d;">${rejectionReason}</p>
              </div>
            ` : ''}
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Please review and resubmit your KYC documents with the following in mind:
            </p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>Ensure all documents are clear and readable</li>
              <li>Make sure the document is not expired</li>
              <li>Your name should match across all documents</li>
              <li>Upload high-quality images without blur</li>
            </ul>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
              If you have questions, please contact our support team.
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
        from: "CoinGoldFX <noreply@coingoldfx.in>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending KYC notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
