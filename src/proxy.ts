import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas que abrem sem login. */
const PUBLICAS = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
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

  // getUser() revalida o token no servidor a cada request.
  // Nao troque por getSession(): esse le o cookie sem conferir.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const ehPublica = PUBLICAS.some((p) => caminho.startsWith(p));

  if (!user && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("voltar", caminho);
    return NextResponse.redirect(url);
  }

  if (user && caminho === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/pdv";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return resposta;
}

export const config = {
  matcher: [
    // tudo, menos arquivos estaticos e imagens
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
