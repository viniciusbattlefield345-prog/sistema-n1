import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/supabase/sessao";
import { Moldura } from "@/components/Moldura";

export default async function LayoutSistema({
  children,
}: LayoutProps<"/">) {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual(supabase);

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel")
    .eq("id", user.id)
    .single();

  return (
    <Moldura nome={perfil?.nome ?? user.email ?? "Equipe"} papel={perfil?.papel ?? "atendente"}>
      {children}
    </Moldura>
  );
}
