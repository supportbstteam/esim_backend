import axios from "axios";

interface VerifyArgs {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId: string;
  body: any;
}

export async function verifyPaypalWebhook({
  transmissionId,
  transmissionTime,
  certUrl,
  authAlgo,
  transmissionSig,
  webhookId,
  body,
}: VerifyArgs): Promise<boolean> {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || "sandbox";
    const apiUrl = mode === "live"
      ? "https://api.paypal.com"
      : "https://api.sandbox.paypal.com";

    // 1️⃣ Get Access Token
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await axios.post(
      `${apiUrl}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2️⃣ Verify Webhook Signature
    let webhookEvent;
    if (Buffer.isBuffer(body)) {
      webhookEvent = JSON.parse(body.toString());
    } else if (typeof body === 'string') {
      webhookEvent = JSON.parse(body);
    } else {
      webhookEvent = body;
    }

    const verificationResponse = await axios.post(
      `${apiUrl}/v1/notifications/verify-webhook-signature`,
      {
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("💳 PayPal Webhook Verification Result:", verificationResponse.data.verification_status);

    return verificationResponse.data.verification_status === "SUCCESS";
  } catch (err: any) {
    console.error("❌ PayPal verification helper error:", err.response?.data || err.message);
    // If verification fails due to error, we should probably return false but NOT crash the server
    return false;
  }
}
