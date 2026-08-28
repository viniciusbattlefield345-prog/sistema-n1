import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { BarraLateral } from "@/components/BarraLateral";

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
    <div className="flex min-h-screen">
      <BarraLateral
        nome={perfil?.nome ?? user.email ?? "Equipe"}
        papel={perfil?.papel ?? "atendente"}
      />
      <main className="ml-[232px] flex-1 bg-breu">{children}</main>
    </div>
  );
}
