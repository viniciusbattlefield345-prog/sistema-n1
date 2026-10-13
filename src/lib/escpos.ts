/**
 * Gerador de ESC/POS para impressora térmica (Tanca, Elgin, Bematech e compatíveis).
 *
 * Por que texto e não imagem: imagem feita com html2canvas sai borrada,
 * demora, e não aciona guilhotina nem gaveta. Em ESC/POS o cupom sai
 * instantâneo, nítido, e a impressora corta sozinha.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** CP850 — a página de código que essas impressoras usam pra acento em português. */
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

/**
 * Pontuação "de editor de texto" que não existe na impressora. O endereço
 * montado no PDV leva " — " antes do bairro: sem esta troca, o travessão
 * virava um byte inválido e derrubava a impressão do cupom inteiro.
 */
const PARECIDOS: Record<string, string> = {
  "—": "-", "–": "-", "‒": "-", "“": '"', "”": '"', "„": '"', "‘": "'", "’": "'",
  "…": ".", "•": "*", "×": "x", "✓": "v", " ": " ",
};

function byteDoChar(c: string): number {
  const codigo = c.charCodeAt(0);
  if (codigo < 128) return codigo;
  const mapeado = CP850[c];
  if (mapeado !== undefined) return mapeado;
  const parecido = PARECIDOS[c];
  if (parecido !== undefined) return parecido.charCodeAt(0);
  // Fallback: tira o acento. Melhor sair "ACAI" do que um caractere solto.
  const semAcento = [...c.normalize("NFD")]
    .filter((ch) => {
      const n = ch.codePointAt(0)!;
      return n < 0x300 || n > 0x36f; // descarta as marcas de acento
    })
    .join("");
  // Só vale se sobrou ASCII puro: emoji ou símbolo estranho vira '?',
  // nunca um valor acima de 255 (que quebra o base64).
  return semAcento.length === 1 && semAcento.charCodeAt(0) < 128
    ? semAcento.charCodeAt(0)
    : 0x3f; // '?'
}

/**
 * Uma linha do cupom como ela sai no papel.
 *
 * Existe pra tela poder mostrar exatamente o que vai ser impresso. A
 * pre-visualizacao antiga era um HTML escrito a mao, parecido com o cupom
 * mas feito por outro codigo: bastava alguem mexer num e esquecer o outro
 * pra tela prometer uma coisa e o papel trazer outra. Agora as duas saem
 * das mesmas chamadas, e nao ha como divergirem.
 */
export interface LinhaCupom {
  texto: string;
  /** Multiplicador de largura: 1 normal, 2 dobrada, 3 tripla. */
  escala: 1 | 2 | 3;
  negrito: boolean;
  /** 0 esquerda · 1 centro · 2 direita */
  alinhar: 0 | 1 | 2;
  /** Linha de item: sai com o dobro da altura. */
  alto: boolean;
  /** Aqui a guilhotina corta — e comeca outra via. */
  corte: boolean;
}

export class Cupom {
  private bytes: number[] = [];
  /** Letra dobrada ocupa o dobro da largura: cabe metade das colunas. */
  private escala: 1 | 2 | 3 = 1;
  /** O mesmo cupom em texto, pra tela mostrar o que vai sair no papel. */
  private visivel: LinhaCupom[] = [];
  private forte = false;
  private lado: 0 | 1 | 2 = 0;
  private alto = false;

  constructor(private colunas = 48) {
    this.inicio();
  }

  /**
   * Estado inicial da impressora. O `ESC @` zera negrito, tamanho e
   * alinhamento — é por isso que a dupla batida precisa ser religada aqui,
   * e não uma vez só lá no começo.
   */
  private inicio() {
    // O `ESC @` zera a impressora; o gerador tem que zerar junto, senao a
    // tela mostraria negrito ou centralizado onde o papel sai normal.
    this.escala = 1;
    this.forte = false;
    this.lado = 0;
    this.cru(ESC, 0x40); // inicializa
    this.cru(ESC, 0x74, 0x02); // página de código CP850
    // Dupla batida: a cabeça aquece cada ponto duas vezes. É o que tira o
    // cinza do papel térmico barato e deixa o cupom legível no balcão.
    this.cru(ESC, 0x47, 0x01);
    return this;
  }

  /**
   * Começa outra via no mesmo envio, depois do corte. Um pedido sai em dois
   * papéis (cozinha e caixa) numa impressão só: a guilhotina separa.
   */
  novaVia() {
    this.marcarCorte();
    return this.inicio();
  }

  /** Colunas que cabem numa linha com o tamanho de letra atual. */
  private get largura() {
    return Math.floor(this.colunas / this.escala);
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
    this.lado = n;
    return this.cru(ESC, 0x61, n);
  }

  negrito(ligado: boolean) {
    this.forte = ligado;
    return this.cru(ESC, 0x45, ligado ? 1 : 0);
  }

  /** 1 = normal, 2 = dobro, 3 = triplo (largura e altura juntas) */
  tamanho(n: 1 | 2 | 3) {
    this.escala = n;
    const v = (n - 1) * 0x11;
    return this.cru(GS, 0x21, v);
  }

  linha(texto = "") {
    this.visivel.push({
      texto,
      escala: this.escala,
      negrito: this.forte,
      alinhar: this.lado,
      alto: this.alto,
      corte: false,
    });
    return this.escrever(texto).cru(0x0a);
  }

  /** Título em negrito, tamanho dobrado e centralizado. */
  titulo(texto: string) {
    return this.alinhar(1).tamanho(2).negrito(true).linha(texto)
      .negrito(false).tamanho(1).alinhar(0);
  }

  separador(caractere = "-") {
    return this.linha(caractere.repeat(this.largura));
  }

  /** Rótulo à esquerda, valor à direita. */
  doisLados(esquerda: string, direita: string) {
    const espaco = this.largura - esquerda.length - direita.length;
    if (espaco < 1) {
      return this.linha(esquerda).linha(
        " ".repeat(Math.max(0, this.largura - direita.length)) + direita,
      );
    }
    return this.linha(esquerda + " ".repeat(espaco) + direita);
  }

  /**
   * Linha de item: "2x X Bacon                      50,00"
   * Quebra o nome em várias linhas quando não cabe, mantendo o valor na primeira.
   */
  item(quantidade: number, descricao: string, valor: string) {
    const prefixo = `${quantidade}x `;
    const largura = this.largura - prefixo.length - valor.length - 1;
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

    // A linha do item sai sempre mais alta que o resto: é a única coisa que
    // alguém lê de longe, com o papel na mão e a chapa cheia. No corpo normal
    // dobra só a altura (dobrar a largura comeria metade das colunas e
    // jogaria o preço pra linha de baixo); num bloco já ampliado, acompanha.
    const primeira = linhas[0];
    const preenchimento = this.largura - prefixo.length - primeira.length - valor.length;
    this.cru(GS, 0x21, ((this.escala - 1) << 4) | (this.escala === 1 ? 1 : this.escala - 1));
    this.alto = true;
    this.linha(prefixo + primeira + " ".repeat(Math.max(1, preenchimento)) + valor);
    for (const resto of linhas.slice(1)) {
      this.linha(" ".repeat(prefixo.length) + resto);
    }
    this.alto = false;
    this.cru(GS, 0x21, (this.escala - 1) * 0x11);
    return this;
  }

  /**
   * Texto recuado, pra observação e adicional.
   *
   * Quebra entre palavras, não no meio delas: a linha que mais precisa ser
   * lida sem erro é a observação ("sem cebola", "carne bem passada"), e
   * cortar no meio da palavra é justamente onde a leitura falha. Palavra
   * sozinha mais larga que o papel ainda é cortada — aí não há alternativa.
   */
  detalhe(texto: string, recuo = 3) {
    const largura = Math.max(1, this.largura - recuo);
    const margem = " ".repeat(recuo);
    let atual = "";

    const soltar = () => {
      if (atual) this.linha(margem + atual);
      atual = "";
    };

    for (const palavra of texto.split(/\s+/).filter(Boolean)) {
      if (!atual) {
        atual = palavra;
      } else if (atual.length + 1 + palavra.length <= largura) {
        atual += " " + palavra;
      } else {
        soltar();
        atual = palavra;
      }
      while (atual.length > largura) {
        this.linha(margem + atual.slice(0, largura));
        atual = atual.slice(largura);
      }
    }
    soltar();
    return this;
  }

  pular(n = 1) {
    // Pelo `linha`, e nao pelo byte cru: assim a tela tambem ve o espaco.
    for (let i = 0; i < n; i++) this.linha();
    return this;
  }

  /** Aciona a guilhotina. */
  cortar() {
    // Os quatro avancos vao direto nos bytes: na tela eles seriam quatro
    // linhas vazias no fim do cupom, e o que interessa mostrar e o corte.
    this.cru(0x0a, 0x0a, 0x0a, 0x0a);
    this.marcarCorte();
    return this.cru(GS, 0x56, 0x42, 0x00);
  }

  private marcarCorte() {
    const ultima = this.visivel[this.visivel.length - 1];
    if (!ultima || ultima.corte) return;
    this.visivel.push({
      texto: "",
      escala: 1,
      negrito: false,
      alinhar: 1,
      alto: false,
      corte: true,
    });
  }

  /** Pulso na gaveta de dinheiro (conector RJ-11 da impressora). */
  abrirGaveta() {
    return this.cru(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  /**
   * O cupom em texto, linha por linha, como a impressora vai imprimir.
   * E a mesma lista que gerou os bytes — nao uma segunda versao dela.
   */
  paraLinhas(): LinhaCupom[] {
    return this.visivel;
  }

  paraBase64(): string {
    let binario = "";
    for (const b of this.bytes) binario += String.fromCharCode(b);
    return btoa(binario);
  }
}
