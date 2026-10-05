export const config = {
  path: "/api/frete",
};

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json();

    const postalCode = String(body.postalCode || "").replace(/\D/g, "");
    const quantity = Math.max(1, Number(body.quantity || 1));

    if (postalCode.length !== 8) {
      return new Response(
        JSON.stringify({ error: "CEP de destino inválido." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const originCep = String(process.env.MELHOR_ENVIO_ORIGIN_CEP || "")
      .replace(/\D/g, "");

    const token = process.env.MELHOR_ENVIO_TOKEN;

    if (!originCep || originCep.length !== 8) {
      throw new Error("CEP de origem não configurado.");
    }

    if (!token) {
      throw new Error("Token do Melhor Envio não configurado.");
    }

    const response = await fetch(
      "https://www.melhorenvio.com.br/api/v2/me/shipment/calculate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Camiseta Servico Social (contato@exemplo.com)",
        },
        body: JSON.stringify({
          from: {
            postal_code: originCep,
          },
          to: {
            postal_code: postalCode,
          },
          products: [
            {
              id: "camiseta-servico-social",
              width: 25,
              height: 8,
              length: 35,
              weight: 0.3,
              insurance_value: 79.90,
              quantity,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível calcular o frete.",
          details: data,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const fretes = Array.isArray(data)
      ? data
          .filter((item) => !item.error && item.price)
          .map((item) => ({
            id: item.id,
            transportadora: item.company?.name || item.name,
            nome: item.name,
            valor: Number(item.custom_price ?? item.price),
            prazo: item.custom_delivery_time ?? item.delivery_time,
          }))
      : [];

    return new Response(JSON.stringify(fretes), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Erro interno ao calcular o frete.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
