import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Moldura } from "@/components/Moldura";

export default async function LayoutSistema({
  children,
}: LayoutProps<"/">) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
