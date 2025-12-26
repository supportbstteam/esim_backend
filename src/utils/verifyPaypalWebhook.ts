import paypal from "@paypal/checkout-server-sdk";
import { paypalClient } from "../lib/paypal";

interface VerifyArgs {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId: string;
  body: Buffer;
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
  // 👇 PayPal SDK typings are incomplete — cast safely
  const VerifyWebhookSignatureRequest =
    (paypal as any).notifications.VerifyWebhookSignatureRequest;

  const request = new VerifyWebhookSignatureRequest();

  request.requestBody({
    transmission_id: transmissionId,
    transmission_time: transmissionTime,
    cert_url: certUrl,
    auth_algo: authAlgo,
    transmission_sig: transmissionSig,
    webhook_id: webhookId,
    webhook_event: JSON.parse(body.toString()),
  });

  const response = await paypalClient.execute(request);

  return response.result.verification_status === "SUCCESS";
}
