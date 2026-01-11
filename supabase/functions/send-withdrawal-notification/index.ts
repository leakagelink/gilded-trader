import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WithdrawalNotificationRequest {
  email: string;
  userName: string;
  status: "approved" | "rejected";
  amount: number;
  currency: string;
  transactionRef?: string;
  rejectionReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Withdrawal notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userName, status, amount, currency, transactionRef, rejectionReason }: WithdrawalNotificationRequest = await req.json();

    console.log(`Sending withdrawal ${status} notification to ${email}`);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isApproved = status === "approved";
    const formattedAmount = `${currency === 'USD' ? '$' : currency}${amount.toFixed(2)}`;
    
    const subject = isApproved 
      ? `✅ Withdrawal of ${formattedAmount} Processed!` 
      : "Withdrawal Request Update";

    const htmlContent = isApproved 
      ? `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">💸 Withdrawal Processed!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Great news! Your withdrawal request has been <strong style="color: #10b981;">approved and processed</strong>.
            </p>
            <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">Amount Withdrawn</p>
              <p style="margin: 5px 0 0 0; color: #047857; font-size: 32px; font-weight: bold;">${formattedAmount}</p>
            </div>
            ${transactionRef ? `
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #4b5563; font-size: 14px;">Transaction Reference:</p>
                <p style="margin: 5px 0 0 0; color: #1f2937; font-family: monospace; font-size: 16px;">${transactionRef}</p>
              </div>
            ` : ''}
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              The funds should arrive in your account within 1-3 business days depending on your bank.
            </p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
              Thank you for choosing TradePro!
            </p>
          </div>
        </div>
      `
      : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Withdrawal Request Update</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Unfortunately, your withdrawal request for <strong>${formattedAmount}</strong> could not be processed.
            </p>
            ${rejectionReason ? `
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #991b1b; font-weight: 600;">Reason:</p>
                <p style="margin: 5px 0 0 0; color: #7f1d1d;">${rejectionReason}</p>
              </div>
            ` : ''}
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Your funds remain in your TradePro wallet. Please review the rejection reason and try again, or contact support for assistance.
            </p>
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
        from: "CoinGoldFX <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Log error but return 200 to prevent blocking the main transaction flow
      console.error("Resend API error (non-blocking):", data);
      console.log("Email delivery failed but returning success to avoid blocking withdrawal flow");
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
    // Log error but return 200 to prevent blocking the main transaction flow
    console.error("Error sending withdrawal notification (non-blocking):", error);
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
