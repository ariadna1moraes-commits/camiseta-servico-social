export const config = {
  path: "/api/melhor-envio/callback",
};

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(
      `<h1>Autorização não concluída</h1><p>${error}</p>`,
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (!code) {
    return new Response(
      "<h1>Callback do Melhor Envio funcionando.</h1><p>Nenhum código de autorização recebido.</p>",
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  return new Response(
    `<h1>Autorização recebida!</h1><p>O código foi recebido com sucesso. Podemos continuar a configuração.</p>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
};
