import { getStore } from "@netlify/blobs";

export const config = {
  path: "/api/frete",
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

async function getStoredTokens() {
  const store = getStore("melhor-envio-auth");

  return await store.get("tokens", {
    type: "json",
  });
}

async function saveTokens(tokens) {
  const store = getStore("melhor-envio-auth");

  await store.setJSON("tokens", tokens);
}

async function refreshAccessToken(tokens) {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Credenciais do Melhor Envio não configuradas."
    );
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

  const newTokens = {
    access_token: data.access_token,
    refresh_token:
      data.refresh_token || tokens.refresh_token,
    expires_in: Number(data.expires_in || 0),
    created_at: Date.now(),
  };

  await saveTokens(newTokens);

  return newTokens;
}

async function getValidAccessToken() {
  let tokens = await getStoredTokens();

  if (!tokens?.access_token) {
    throw new Error(
      "Melhor Envio ainda não está conectado. Conecte o Melhor Envio novamente."
    );
  }

  const createdAt = Number(tokens.created_at || 0);
  const expiresIn = Number(tokens.expires_in || 0);

  if (createdAt && expiresIn) {
    const expiresAt =
      createdAt + expiresIn * 1000;

    const fiveMinutes =
      5 * 60 * 1000;

    if (
      Date.now() >=
      expiresAt - fiveMinutes
    ) {
      tokens = await refreshAccessToken(tokens);
    }
  }

  return tokens.access_token;
}

async function calculateFreight({
  accessToken,
  originCep,
  destinationCep,
  quantity,
}) {
  return await fetch(
    "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Camiseta Servico Social",
      },
      body: JSON.stringify({
        from: {
          postal_code: originCep,
        },

        to: {
          postal_code: destinationCep,
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

function formatFreightOptions(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(
      (item) =>
        !item.error &&
        (item.price != null ||
          item.custom_price != null)
    )
    .map((item) => ({
      id: item.id,

      name:
        item.name ||
        item.company?.name ||
        "Opção de entrega",

      price: Number(
        item.custom_price ??
          item.price ??
          0
      ),

      deliveryTime: Number(
        item.custom_delivery_time ??
          item.delivery_time ??
          0
      ),

      carrier:
        item.company?.name ||
        "",

      service:
        item.name ||
        "",
    }));
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Método não permitido.",
      }),
      {
        status: 405,
        headers: JSON_HEADERS,
      }
    );
  }

  try {
    const body = await req.json();

    /*
     * A página da loja envia destinationCep.
     * Também aceitamos postalCode para manter compatibilidade.
     */
    const destinationCep = String(
      body.destinationCep ||
        body.postalCode ||
        ""
    ).replace(/\D/g, "");

    const quantity = Math.max(
      1,
      Number(body.quantity || 1)
    );

    if (destinationCep.length !== 8) {
      return new Response(
        JSON.stringify({
          error:
            "CEP de destino inválido.",
        }),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    const originCep = String(
      process.env.MELHOR_ENVIO_ORIGIN_CEP ||
        ""
    ).replace(/\D/g, "");

    if (originCep.length !== 8) {
      return new Response(
        JSON.stringify({
          error:
            "CEP de origem não configurado.",
        }),
        {
          status: 500,
          headers: JSON_HEADERS,
        }
      );
    }

    let accessToken =
      await getValidAccessToken();

    let response =
      await calculateFreight({
        accessToken,
        originCep,
        destinationCep,
        quantity,
      });

    /*
     * Se o token estiver inválido,
     * renovamos uma vez e repetimos a cotação.
     */
    if (response.status === 401) {
      const tokens =
        await getStoredTokens();

      const refreshed =
        await refreshAccessToken(tokens);

      accessToken =
        refreshed.access_token;

      response =
        await calculateFreight({
          accessToken,
          originCep,
          destinationCep,
          quantity,
        });
    }

    const data =
      await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error:
            "Não foi possível calcular o frete.",
          details: data,
        }),
        {
          status:
            response.status || 500,
          headers: JSON_HEADERS,
        }
      );
    }

    const options =
      formatFreightOptions(data);

    return new Response(
      JSON.stringify({
        options,
      }),
      {
        status: 200,
        headers: {
          ...JSON_HEADERS,
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error?.message ||
          "Erro interno ao calcular o frete.",
      }),
      {
        status: 500,
        headers: JSON_HEADERS,
      }
    );
  }
};
