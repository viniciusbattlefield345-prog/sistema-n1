"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoLogin } from "./acoes";

const CHAVE = "n1:usuario";

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-ouro mt-2 w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {
    erro: null,
  });

  // Guardamos só o nome de usuário neste computador — nunca a senha.
  // Quem guarda senha com segurança é o navegador, pelo gerenciador dele.
  const [usuario, setUsuario] = useState("");
  const [lembrar, setLembrar] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo) {
        setUsuario(salvo);
        setLembrar(true);
      }
    } catch {
      // navegador anônimo ou site bloqueado: segue sem lembrar
    }
  }, []);

  function aoEnviar(form: FormData) {
    try {
      if (lembrar) localStorage.setItem(CHAVE, String(form.get("usuario") ?? ""));
      else localStorage.removeItem(CHAVE);
    } catch {
      // sem armazenamento: entrar continua funcionando
    }
    acao(form);
  }

  return (
    <form action={aoEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={destino} />

      <div>
        <label className="rotulo" htmlFor="usuario">
          Usuário
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          className="campo"
          placeholder="arinete"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
          placeholder="••••••••"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-creme-suave">
        <input
          type="checkbox"
          className="accent-ouro"
          checked={lembrar}
          onChange={(e) => setLembrar(e.target.checked)}
        />
        Lembrar meu usuário neste computador
      </label>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado"
        >
          {estado.erro}
        </p>
      )}

      <BotaoEntrar />
    </form>
  );
}
