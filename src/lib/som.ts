"use client";

/**
 * Apito de pedido novo, gerado na hora pelo Web Audio — nenhum arquivo de som.
 *
 * O navegador só libera áudio depois do primeiro toque na página. Até lá o
 * apito fica mudo; a vibração e o aviso na tela seguram sozinhos.
 */

const CHAVE = "gb:som";
let contexto: AudioContext | null = null;

/** Chame uma vez: destrava o áudio no primeiro toque ou tecla. */
export function prepararSom() {
  if (typeof window === "undefined") return;
  const destravar = () => {
    try {
      contexto ??= new AudioContext();
      if (contexto.state === "suspended") void contexto.resume();
    } catch {
      // navegador sem Web Audio: fica só a vibração
    }
  };
  window.addEventListener("pointerdown", destravar, { once: true });
  window.addEventListener("keydown", destravar, { once: true });
}

export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== "mudo";
  } catch {
    return true;
  }
}

export function definirSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE, ligado ? "ligado" : "mudo");
  } catch {
    // sem armazenamento: vale só enquanto a tela estiver aberta
  }
}

/** Dois bipes curtos, agudos o bastante pra furar o barulho de cozinha. */
export function apitar() {
  if (!somLigado()) return;
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // alguns navegadores bloqueiam vibração sem toque
  }
  if (!contexto || contexto.state !== "running") return;

  const agora = contexto.currentTime;
  for (const [inicio, frequencia] of [
    [0, 880],
    [0.22, 1175],
  ] as const) {
    const oscilador = contexto.createOscillator();
    const volume = contexto.createGain();
    oscilador.type = "square";
    oscilador.frequency.value = frequencia;
    volume.gain.setValueAtTime(0.0001, agora + inicio);
    volume.gain.exponentialRampToValueAtTime(0.25, agora + inicio + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, agora + inicio + 0.18);
    oscilador.connect(volume).connect(contexto.destination);
    oscilador.start(agora + inicio);
    oscilador.stop(agora + inicio + 0.2);
  }
}
