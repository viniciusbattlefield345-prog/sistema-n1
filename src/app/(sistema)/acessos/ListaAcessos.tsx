"use client";

import { useState, useTransition } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { alternarAtivo, criarUsuario, mudarPapel } from "./acoes";
import { emailParaUsuario, DOMINIO_INTERNO } from "@/lib/auth";
import type { Papel } from "@/lib/tipos";

export interface LinhaAcesso {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  email: string;
}

const PAPEIS: { valor: Papel; rotulo: string; explica: string }[] = [
  { valor: "dono", rotulo: "Dono", explica: "Vê tudo, inclusive relatórios e acessos" },
  { valor: "atendente", rotulo: "Atendente", explica: "Vende, cadastra cliente e mexe no cardápio" },
  { valor: "cozinha", rotulo: "Cozinha", explica: "Acompanha a produção" },
];

export function ListaAcessos({
  pessoas,
  euId,
  podeCriar,
}: {
  pessoas: LinhaAcesso[];
  euId: string;
  podeCriar: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>("atendente");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function agir(fn: () => Promise<{ ok: boolean; erro?: string }>, sucesso?: string) {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo.");
      else if (sucesso) setAviso(sucesso);
    });
  }

  return (
    <div className="p-4 lg:p-8">
      <Cabecalho
        fita="Gerência"
        titulo="Acessos"
        descricao="Quem entra no sistema e o que cada um enxerga. Só o dono vê esta tela."
      >
        <button className="btn btn-ouro" onClick={() => setCriando((c) => !c)}>
          {criando ? "Fechar" : "Novo acesso"}
        </button>
      </Cabecalho>

      {erro && (
        <p role="alert" className="mb-4 rounded-lg border border-cancelado/40 bg-cancelado/10 px-3 py-2 text-sm text-cancelado">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="mb-4 rounded-lg border border-pronto/40 bg-pronto/10 px-3 py-2 text-sm text-pronto">
          {aviso}
        </p>
      )}

      {criando && (
        <form
          className="mb-6 rounded-2xl border border-ouro/40 bg-carvao p-5"
          onSubmit={(e) => {
            e.preventDefault();
            agir(
              () => criarUsuario(usuario, senha, nome, papel),
              `Acesso de "${usuario}" criado.`,
            );
            setUsuario("");
            setNome("");
            setSenha("");
          }}
        >
          {!podeCriar && (
            <p className="mb-4 rounded-lg border border-preparo/40 bg-preparo/10 px-3 py-2 text-sm text-preparo">
              A chave de serviço não está configurada no servidor, então não dá
              para criar usuário por aqui ainda. Crie pelo painel do Supabase em
              Authentication → Users, com o e-mail no formato{" "}
              <code>nome@{DOMINIO_INTERNO}</code>.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className="rotulo" htmlFor="a-usuario">Usuário</label>
              <input
                id="a-usuario"
                className="campo"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="joana"
                autoCapitalize="none"
                required
              />
            </div>
            <div className="w-52">
              <label className="rotulo" htmlFor="a-nome">Nome completo</label>
              <input
                id="a-nome"
                className="campo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Joana Ribeiro"
              />
            </div>
            <div className="w-40">
              <label className="rotulo" htmlFor="a-senha">Senha</label>
              <input
                id="a-senha"
                className="campo"
                type="text"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="senha de acesso"
                required
              />
            </div>
            <div className="w-40">
              <label className="rotulo" htmlFor="a-papel">Função</label>
              <select
                id="a-papel"
                className="campo"
                value={papel}
                onChange={(e) => setPapel(e.target.value as Papel)}
              >
                {PAPEIS.map((p) => (
                  <option key={p.valor} value={p.valor}>{p.rotulo}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-ouro" disabled={ocupado || !podeCriar}>
              {ocupado ? "Criando…" : "Criar acesso"}
            </button>
          </div>
          <p className="mt-2 text-xs text-creme-fraco">
            A pessoa vai entrar digitando só o usuário — o resto o sistema completa.
          </p>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-borda">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="bg-carvao text-left text-xs uppercase tracking-wide text-creme-suave">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Usuário</th>
              <th className="px-4 py-3 font-semibold">Função</th>
              <th className="px-4 py-3 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr
                key={p.id}
                className={"border-t border-borda/60 " + (p.ativo ? "" : "opacity-45")}
              >
                <td className="px-4 py-3 font-medium text-creme">
                  {p.nome}
                  {p.id === euId && (
                    <span className="ml-2 text-xs text-creme-fraco">(você)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-creme-suave">
                  {emailParaUsuario(p.email)}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="campo py-1.5 text-sm"
                    style={{ width: "10rem" }}
                    value={p.papel}
                    disabled={ocupado}
                    onChange={(e) =>
                      agir(() => mudarPapel(p.id, e.target.value as Papel))
                    }
                    aria-label={`Função de ${p.nome}`}
                  >
                    {PAPEIS.map((x) => (
                      <option key={x.valor} value={x.valor}>{x.rotulo}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    disabled={ocupado}
                    onClick={() => agir(() => alternarAtivo(p.id, !p.ativo))}
                    className={
                      "rounded-full px-2.5 py-1 text-xs font-semibold " +
                      (p.ativo
                        ? "bg-pronto/15 text-pronto"
                        : "bg-madeira text-creme-fraco")
                    }
                  >
                    {p.ativo ? "Ativo" : "Desativado"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1 text-xs text-creme-fraco">
        {PAPEIS.map((p) => (
          <p key={p.valor}>
            <strong className="text-creme-suave">{p.rotulo}:</strong> {p.explica}
          </p>
        ))}
      </div>
    </div>
  );
}
