/** Erro de domínio que a camada HTTP traduz em status + mensagem (ver rota.ts). */
export class ErroApp extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalhes?: unknown,
  ) {
    super(message);
  }
}

export const erroValidacao = (mensagem: string) => new ErroApp(400, mensagem);
export const naoEncontrado = (mensagem: string) => new ErroApp(404, mensagem);
export const conflito = (mensagem: string, detalhes?: unknown) => new ErroApp(409, mensagem, detalhes);
/** Pedido bem formado, mas que viola uma regra de negócio. */
export const regraViolada = (mensagem: string) => new ErroApp(422, mensagem);
