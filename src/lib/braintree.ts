import braintree from "braintree";

export const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BT_MERCHANT_ID!,
  publicKey: process.env.BT_PUBLIC_KEY!,
  privateKey: process.env.BT_PRIVATE_KEY!,
});

export const getClientToken = async (req:any, res:any) => {
  const response = await gateway.clientToken.generate({});
  res.send({ clientToken: response.clientToken });
};

export const createTransaction = async (req:any, res:any) => {
  const { nonce, amount } = req.body;

  const result = await gateway.transaction.sale({
    amount,
    paymentMethodNonce: nonce,
    options: {
      submitForSettlement: true,
    },
  });

  res.json(result);
};
