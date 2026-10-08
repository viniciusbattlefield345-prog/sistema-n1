/**
 * Memória do celular do cliente.
 *
 * O carrinho, o nome e a lista de pedidos já enviados ficam aqui: recarregar
 * a página ou bloquear a tela não perde nada. Nada disso vai pro servidor.
 *
 * Tudo embrulhado em try/catch de propósito — navegador anônimo, memória
 * cheia ou site bloqueado fazem o localStorage estourar, e nenhum desses
 * casos pode derrubar o cardápio. Sem memória o pedido ainda funciona; só
 * não lembra.
 */
export function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

export function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem memória: o pedido funciona, só não é lembrado na próxima visita
  }
}
