export const config = {
  path: "/api/infinitepay",
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

    const handle = process.env.INFINITEPAY_HANDLE;

    if (!handle) {
      throw new Error("InfinitePay não configurada.");
    }

    const siteUrl =
      process.env.SITE_URL ||
      `https://${req.headers.get("host")}`;

    const quantity = Math.max(1, Number(body.quantity || 1));
    const unitPrice = 7990;

    const shippingPrice = Math.max(
      0,
      Math.round(Number(body.shippingPrice || 0) * 100)
    );

    const orderNsu =
      `CAMISETA-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

    const items = [
      {
        quantity,
        price: unitPrice,
        description: `Camiseta Serviço Social - ${body.fit || "modelo"} - ${body.size || "tamanho"}`,
      },
    ];

    if (shippingPrice > 0) {
      items.push({
        quantity: 1,
        price: shippingPrice,
        description: `Frete - ${body.shippingName || "Entrega"}`,
      });
    }

    const payload = {
      handle,
      redirect_url: `${siteUrl}/obrigado.html`,
      order_nsu: orderNsu,
      items,
    };

    if (body.customer?.name || body.customer?.email) {
      payload.customer = {
        name: body.customer?.name || "",
        email: body.customer?.email || "",
        phone_number: body.customer?.phone || "",
      };
    }

    if (body.address?.cep) {
      payload.address = {
        cep: String(body.address.cep).replace(/\D/g, ""),
        number: body.address.number || "",
        complement: body.address.complement || "",
      };
    }

    const response = await fetch(
      "https://api.checkout.infinitepay.io/links",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.url) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível criar o checkout da InfinitePay.",
          details: data,
        }),
        {
          status: response.status || 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        url: data.url,
        order_nsu: orderNsu,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Erro interno.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
