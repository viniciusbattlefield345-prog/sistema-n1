/**
 * Gerador de ESC/POS para impressora térmica (Tanca TP-650 e compatíveis).
 *
 * Por que texto e não imagem: o sistema antigo mandava um PNG feito com
 * html2canvas. Sai borrado, demora, e não aciona guilhotina nem gaveta.
 * Em ESC/POS o cupom sai instantâneo, nítido, e a impressora corta sozinha.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** CP850 — a página de código que a TP-650 usa pra acento em português. */
const CP850: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85,
  "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b, "î": 0x8c,
  "ì": 0x8d, "Ä": 0x8e, "É": 0x90, "ô": 0x93, "ö": 0x94, "ò": 0x95,
  "û": 0x96, "ù": 0x97, "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b, "á": 0xa0,
  "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "ª": 0xa6,
  "º": 0xa7, "Á": 0xb5, "Â": 0xb6, "À": 0xb7, "ã": 0xc6, "Ã": 0xc7,
  "Í": 0xd6, "Ì": 0xde, "Ó": 0xe0, "ß": 0xe1, "Ô": 0xe2, "Ò": 0xe3,
  "õ": 0xe4, "Õ": 0xe5, "Ú": 0xe9, "Û": 0xea, "Ù": 0xeb, "Ý": 0xed,
  "°": 0xf8, "·": 0xfa,
};

function byteDoChar(c: string): number {
  const codigo = c.charCodeAt(0);
  if (codigo < 128) return codigo;
  const mapeado = CP850[c];
  if (mapeado !== undefined) return mapeado;
  // Fallback: tira o acento. Melhor sair "ACAI" do que um caractere solto.
  const semAcento = [...c.normalize("NFD")]
    .filter((ch) => {
      const n = ch.codePointAt(0)!;
      return n < 0x300 || n > 0x36f; // descarta as marcas de acento
    })
    .join("");
  return semAcento.length === 1 ? semAcento.charCodeAt(0) : 0x3f; // '?'
}

export class Cupom {
  private bytes: number[] = [];

  constructor(private colunas = 48) {
    this.cru(ESC, 0x40); // inicializa
    this.cru(ESC, 0x74, 0x02); // página de código CP850
  }

  private cru(...b: number[]) {
    this.bytes.push(...b);
    return this;
  }

  private escrever(texto: string) {
    for (const c of texto) this.bytes.push(byteDoChar(c));
    return this;
  }

  /** 0 esquerda · 1 centro · 2 direita */
  alinhar(n: 0 | 1 | 2) {
    return this.cru(ESC, 0x61, n);
  }

  negrito(ligado: boolean) {
    return this.cru(ESC, 0x45, ligado ? 1 : 0);
  }

  /** 1 = normal, 2 = dobro, 3 = triplo (largura e altura juntas) */
  tamanho(n: 1 | 2 | 3) {
    const v = (n - 1) * 0x11;
    return this.cru(GS, 0x21, v);
  }

  linha(texto = "") {
    return this.escrever(texto).cru(0x0a);
  }

  /** Título em negrito, tamanho dobrado e centralizado. */
  titulo(texto: string) {
    return this.alinhar(1).tamanho(2).negrito(true).linha(texto)
      .negrito(false).tamanho(1).alinhar(0);
  }

  separador(caractere = "-") {
    return this.linha(caractere.repeat(this.colunas));
  }

  /** Rótulo à esquerda, valor à direita, pontilhado no meio se sobrar espaço. */
  doisLados(esquerda: string, direita: string) {
    const espaco = this.colunas - esquerda.length - direita.length;
    if (espaco < 1) return this.linha(esquerda).linha(" ".repeat(Math.max(0, this.colunas - direita.length)) + direita);
    return this.linha(esquerda + " ".repeat(espaco) + direita);
  }

  /**
   * Linha de item: "2x Feijoada completa            48,00"
   * Quebra o nome em várias linhas quando não cabe, mantendo o valor na primeira.
   */
  item(quantidade: number, descricao: string, valor: string) {
    const prefixo = `${quantidade}x `;
    const largura = this.colunas - prefixo.length - valor.length - 1;
    const palavras = descricao.split(" ");
    const linhas: string[] = [];
    let atual = "";

    for (const palavra of palavras) {
      if ((atual + " " + palavra).trim().length <= largura) {
        atual = (atual + " " + palavra).trim();
      } else {
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
    if (linhas.length === 0) linhas.push("");

    const primeira = linhas[0];
    const preenchimento = this.colunas - prefixo.length - primeira.length - valor.length;
    this.linha(prefixo + primeira + " ".repeat(Math.max(1, preenchimento)) + valor);
    for (const resto of linhas.slice(1)) {
      this.linha(" ".repeat(prefixo.length) + resto);
    }
    return this;
  }

  /** Texto recuado, pra observação e adicional. */
  detalhe(texto: string, recuo = 3) {
    const largura = this.colunas - recuo;
    for (let i = 0; i < texto.length; i += largura) {
      this.linha(" ".repeat(recuo) + texto.slice(i, i + largura));
    }
    return this;
  }

  pular(n = 1) {
    for (let i = 0; i < n; i++) this.cru(0x0a);
    return this;
  }

  /** Aciona a guilhotina. */
  cortar() {
    return this.pular(4).cru(GS, 0x56, 0x42, 0x00);
  }

  /** Pulso na gaveta de dinheiro (conector RJ-11 da impressora). */
  abrirGaveta() {
    return this.cru(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  paraBase64(): string {
    let binario = "";
    for (const b of this.bytes) binario += String.fromCharCode(b);
    return btoa(binario);
  }
}
