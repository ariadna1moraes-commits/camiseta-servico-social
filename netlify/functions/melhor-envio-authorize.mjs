export const config = {
  path: "/api/melhor-envio/authorize",
};

export default async (req) => {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;

  if (!clientId) {
    return new Response(
      "MELHOR_ENVIO_CLIENT_ID não configurado.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }

  const callback =
    "https://stellar-mochi-fb59eb.netlify.app/api/melhor-envio/callback";

  const authorizationUrl =
    "https://melhorenvio.com.br/oauth/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callback)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("shipping-calculate")}`;

  return Response.redirect(authorizationUrl, 302);
};
