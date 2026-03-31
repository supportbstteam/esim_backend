import paypal from "@paypal/checkout-server-sdk";

const environment =
  process.env.PAYPAL_MODE === "live"
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID!,
        process.env.PAYPAL_CLIENT_SECRET!
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID!,
        process.env.PAYPAL_CLIENT_SECRET!
      );



export const paypalClient = new paypal.core.PayPalHttpClient(environment);
