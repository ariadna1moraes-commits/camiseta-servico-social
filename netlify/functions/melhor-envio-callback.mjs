import { getStore } from "@netlify/blobs";

export const config = {
  path: "/api/melhor-envio/callback",
};

export default async (req) => {
  try {
    const url = new URL(req.url);

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(
        `<h1>Autorização não concluída</h1><p>${error}</p>`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        }
      );
    }

    if (!code) {
      return new Response(
        "<h1>Erro</h1><p>Código de autorização não recebido.</p>",
        {
          status: 400,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        }
      );
    }

    const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;
    const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET;

    const redirectUri =
      "https://stellar-mochi-fb59eb.netlify.app/api/melhor-envio/callback";

    if (!clientId || !clientSecret) {
      throw new Error(
        "Credenciais do Melhor Envio não configuradas."
      );
    }

    const response = await fetch(
      "https://melhorenvio.com.br/oauth/token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent":
            "Camiseta Serviço Social (contato@exemplo.com)",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      return new Response(
        `<h1>Erro ao obter autorização</h1>
        <pre>${JSON.stringify(data, null, 2)}</pre>`,
        {
          status: 500,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        }
      );
    }

    const store = getStore("melhor-envio-auth");

    await store.setJSON("tokens", {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      created_at: Date.now(),
    });

    return new Response(
      `<h1>Melhor Envio conectado! 🎉</h1>
      <p>A autorização foi concluída com sucesso.</p>
      <p>O acesso foi armazenado com segurança no servidor.</p>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  } catch (error) {
    return new Response(
      `<h1>Erro na integração</h1>
      <p>${error.message || "Erro desconhecido."}</p>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  }
};
