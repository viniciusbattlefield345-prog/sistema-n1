"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoLogin } from "./acoes";

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

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={destino} />

      <div>
        <label className="rotulo" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="campo"
          placeholder="voce@n1restaurante.com"
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
