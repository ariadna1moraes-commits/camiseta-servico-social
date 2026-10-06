import { getStore } from "@netlify/blobs";

export const config = {
  path: "/api/frete",
};

async function getTokens() {
  const store = getStore("melhor-envio-auth");
  return await store.get("tokens", { type: "json" });
}

async function refreshToken(tokens) {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Melhor Envio não configuradas.");
  }

  if (!tokens?.refresh_token) {
    throw new Error(
      "Autorização do Melhor Envio não encontrada. Conecte o Melhor Envio novamente."
    );
  }

  const response = await fetch(
    "https://melhorenvio.com.br/oauth/token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Camiseta Servico Social",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      "Não foi possível renovar a autorização do Melhor Envio."
    );
  }

  const store = getStore("melhor-envio-auth");

  const newTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_in: data.expires_in,
    created_at: Date.now(),
  };

  await store.setJSON("tokens", newTokens);

  return newTokens;
}

async function getValidToken() {
  let tokens = await getTokens();

  if (!tokens?.access_token) {
    throw new Error(
      "Melhor Envio ainda não está conectado. Conecte o Melhor Envio novamente."
    );
  }

  const createdAt = Number(tokens.created_at || 0);
  const expiresIn = Number(tokens.expires_in || 0);

  const expiresAt = createdAt + expiresIn * 1000;

  // Renova 5 minutos antes de expirar
  if (
    expiresIn > 0 &&
    Date.now() >= expiresAt - 5 * 60 * 1000
  ) {
    tokens = await refreshToken(tokens);
  }

  return tokens.access_token;
}

async function calculateFreight(token, body, originCep, postalCode, quantity) {
  return await fetch(
    "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Camiseta Servico Social",
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
            insurance_value: 79.9,
            quantity,
          },
        ],
      }),
    }
  );
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Método não permitido.",
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const body = await req.json();

    const postalCode = String(
      body.postalCode || ""
    ).replace(/\D/g, "");

    const quantity = Math.max(
      1,
      Number(body.quantity || 1)
    );

    if (postalCode.length !== 8) {
      return new Response(
        JSON.stringify({
          error: "CEP de destino inválido.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const originCep = String(
      process.env.MELHOR_ENVIO_ORIGIN_CEP || ""
    ).replace(/\D/g, "");

    if (originCep.length !== 8) {
      throw new Error(
        "CEP de origem não configurado."
      );
    }

    let token = await getValidToken();

    let response = await calculateFreight(
      token,
      body,
      originCep,
      postalCode,
      quantity
    );

    // Se o token estiver inválido, renova e tenta novamente.
    if (response.status === 401) {
      const tokens = await getTokens();
      const refreshedTokens = await refreshToken(tokens);

      token = refreshedTokens.access_token;

      response = await calculateFreight(
        token,
        body,
        originCep,
        postalCode,
        quantity
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível calcular o frete.",
          details: data,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const fretes = Array.isArray(data)
      ? data
          .filter(
            (item) =>
              !item.error &&
              (item.price || item.custom_price)
          )
          .map((item) => ({
            id: item.id,
            transportadora:
              item.company?.name || item.name,
            nome: item.name,
            valor: Number(
              item.custom_price ?? item.price
            ),
            prazo:
              item.custom_delivery_time ??
              item.delivery_time,
          }))
      : [];

    return new Response(
      JSON.stringify(fretes),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error.message ||
          "Erro interno ao calcular o frete.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
