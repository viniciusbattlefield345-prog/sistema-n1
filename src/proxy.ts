import { createServerClient } from "@supabase/ssr";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas que abrem sem login. */
const PUBLICAS = ["/login", "/auth"];

/**
 * Nem sessão precisam: o cardápio que o cliente abre pelo QR da mesa, o link
 * público de delivery, e as imagens geradas (ícone e prévia do WhatsApp, que
 * o robô do WhatsApp busca sem estar logado).
 *
 * Essas rotas conversam com o banco pela chave de serviço, no servidor, e
 * conferem tudo por conta própria — é lá que mora a segurança delas.
 */
const SEM_SESSAO = [
  "/m/",
  "/pedir",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  /*
    O certificado do QZ Tray também não: ele é chave PÚBLICA, e já está no
    código deste repositório, que é aberto. Esconder não protegia nada.

    Protegia menos que nada, na verdade. A janela da impressão fica aberta
    dias seguidos no balcão; quando a sessão dela expirava, esta rota
    respondia a PÁGINA DE LOGIN com status 200, e o QZ recebia HTML no lugar
    do certificado. Resultado medido em 18/10/2026: a conexão caiu por
    inatividade às 15:51 e, daí em diante, 22 impressões chegaram "anônimas"
    — cada uma parando a fila num aviso de segurança, e 4 acabaram negadas.
    Cupom que não saiu.

    Quem prova que o pedido é nosso é a ASSINATURA, feita em /api/qz/assinar
    com a chave privada que só o servidor tem, e essa continua exigindo
    sessão. Certificado sem assinatura não imprime nada.
  */
  "/api/qz/certificado",
];

export async function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  if (SEM_SESSAO.some((p) => caminho.startsWith(p))) return NextResponse.next();

  let resposta = NextResponse.next({ request });

  // Sem Supabase configurado ainda: deixa navegar em vez de derrubar tudo
  // com erro de conexao. Some assim que o .env.local for preenchido.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return resposta;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(lista) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Confere a assinatura do login aqui mesmo, com a chave publica do projeto
  // (ES256) - sem viagem de rede. Veja lib/supabase/sessao.ts.
  // Nao troque por getSession(): esse le o cookie sem conferir nada.
  const user = await usuarioAtual(supabase);

  const ehPublica = PUBLICAS.some((p) => caminho.startsWith(p));

  if (!user && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("voltar", caminho);
    return NextResponse.redirect(url);
  }

  if (user && caminho === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/mesas";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return resposta;
}

/*
  O que nem chega a passar por aqui.

  Este proxy roda numa funcao da Vercel, e funcao rodada e funcao cobrada.
  Toda visita ao cardapio pagava duas: uma pro porteiro e outra pra pagina.
  So que pras rotas de `SEM_SESSAO` o porteiro olhava, dava de ombros e
  deixava passar na primeira linha — trabalho nenhum, cobrado como trabalho.
  Metade do custo de cada cliente era isso.

  A lista `SEM_SESSAO` continua la em cima de proposito, agora como segunda
  tranca: se um dia alguem mexer neste filtro sem lembrar dela, o cardapio
  continua abrindo. O preco de errar aqui e um cliente de mesa batendo numa
  tela de login com o lanche na mao.

  Conferido rota a rota antes de escrever: nenhuma tela de dentro colide com
  esses prefixos. `pedidos` nao casa com `pedir` (muda na quinta letra) e
  `mesas` nao casa com `m/`.
*/
export const config = {
  matcher: [
    // tudo, menos estaticos, imagens e as rotas que abrem sem login
    "/((?!_next/static|_next/image|favicon.ico|m/|pedir|icon|apple-icon|opengraph-image|api/qz/certificado|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
