/**
 * Tipos do qz-tray. O pacote é JavaScript puro e não publica declarações,
 * então declaramos só o que o sistema usa de verdade.
 * Referência: https://qz.io/api/
 */
declare module "qz-tray" {
  export interface OpcoesConexao {
    host?: string | string[];
    port?: { secure?: number[]; insecure?: number[] };
    usingSecure?: boolean;
    keepAlive?: number;
    retries?: number;
    delay?: number;
  }

  export interface OpcoesConfig {
    copies?: number;
    jobName?: string;
    encoding?: string;
    endOfDoc?: string;
    perSpool?: number;
    altPrinting?: boolean;
  }

  export interface ConfigImpressao {
    getPrinter(): string;
  }

  export type DadoImpressao =
    | string
    | {
        type: "raw" | "pixel";
        format: "base64" | "plain" | "hex" | "image" | "pdf" | "html" | "command";
        data: string;
        options?: Record<string, unknown>;
        flavor?: string;
      };

  export const websocket: {
    connect(opcoes?: OpcoesConexao): Promise<void>;
    disconnect(): Promise<void>;
    isActive(): boolean;
  };

  export const printers: {
    find(nome?: string): Promise<string | string[]>;
    getDefault(): Promise<string>;
  };

  export const configs: {
    create(impressora: string | null, opcoes?: OpcoesConfig): ConfigImpressao;
    setDefaults(opcoes: OpcoesConfig): void;
  };

  export const security: {
    setCertificatePromise(
      resolver: (
        resolve: (certificado: string) => void,
        reject: (erro: unknown) => void,
      ) => void,
    ): void;
    setSignatureAlgorithm(algoritmo: string): void;
    setSignaturePromise(
      resolver: (
        mensagem: string,
      ) => (
        resolve: (assinatura: string) => void,
        reject: (erro: unknown) => void,
      ) => void,
    ): void;
  };

  export function print(
    config: ConfigImpressao,
    dados: DadoImpressao[],
  ): Promise<void>;

  export const api: {
    setPromiseType(fn: unknown): void;
    setSha256Type(fn: unknown): void;
  };

  export interface QzTray {
    websocket: typeof websocket;
    printers: typeof printers;
    configs: typeof configs;
    security: typeof security;
    print: typeof print;
    api: typeof api;
  }

  const qz: QzTray;
  export default qz;
}
