CAMISETA SERVIÇO SOCIAL — CONFIGURAÇÃO NETLIFY

1. SUBSTITUA O DEPLOY ATUAL
- Este projeto já contém index.html, obrigado.html, netlify.toml e as Netlify Functions.
- Publique a pasta inteira pelo método de deploy do Netlify que processe Functions (Git ou Netlify CLI/API). Um deploy estático simples não é suficiente para as Functions.

2. VARIÁVEIS NO NETLIFY
Em Project configuration > Environment variables, crie:

MELHOR_ENVIO_ACCESS_TOKEN = SEU_TOKEN_OAUTH_DO_MELHOR_ENVIO
MELHOR_ENVIO_ORIGIN_CEP = SEU_CEP_DE_ORIGEM
MELHOR_ENVIO_USER_AGENT = Nome da loja (seuemail@dominio.com)
INFINITEPAY_HANDLE = SUA_INFINITETAG_SEM_O_$

Não coloque tokens no index.html.

3. DEPLOY
- Depois de criar/alterar as variáveis, faça novo deploy.
- O Netlify precisa receber a pasta netlify/functions para publicar as Functions.

4. TESTES
- Abra /api/frete por POST via a página: informe um CEP e clique para calcular.
- Faça um teste do checkout com valor real somente quando tudo estiver conferido.
- Depois do pagamento, a InfinitePay redirecionará para /obrigado.html.

5. DADOS QUE AINDA PRECISAM SER CONFIRMADOS ANTES DA VENDA
- CEP de origem real.
- Peso real da embalagem.
- Dimensões reais da embalagem.
- Material/cor e demais informações do produto.
- Período da pré-venda e prazo de produção.
- Políticas de troca, privacidade e termos.

IMPORTANTE
O frete usa os valores de peso/dimensões definidos na Function. Eles estão como parâmetros provisórios (0,30 kg; 25 x 8 x 35 cm) e devem ser conferidos antes de divulgar os valores ao público.
