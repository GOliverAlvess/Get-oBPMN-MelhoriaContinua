/**
 * Resolução oficial e protegida de portas do GIP Flow.
 * 
 * CONTRATO DE INFRAESTRUTURA:
 * - Produção (VPS): porta 3004 (definida via PORT=3004 ou fallback de NODE_ENV=production)
 * - Preview / IA Studio / Dev: porta 3000
 * - PORT=8080 injetada pelo runtime de preview: descartada, caindo na regra de ambiente
 * - Argumento CLI --port: prioridade absoluta quando fornecido
 *
 * ATENÇÃO: Esta função é PURA e isolada para impedir quebras de deploy e 502 Bad Gateway no Nginx.
 */

export interface ResolveServerPortOptions {
  argPort?: number | string | null;
  envPort?: number | string | null;
  nodeEnv?: string | null;
}

/**
 * Extrai o argumento --port da lista de argumentos do processo.
 */
export function extractArgPort(argv: string[] = process.argv): number | undefined {
  const argPortIndex = argv.indexOf("--port");
  if (argPortIndex !== -1 && argv[argPortIndex + 1]) {
    const parsed = parseInt(argv[argPortIndex + 1], 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

/**
 * Resolve a porta efetiva do servidor com base na hierarquia estrita de regras.
 */
export function resolveServerPort(options: ResolveServerPortOptions = {}): number {
  const { argPort, envPort, nodeEnv } = options;

  // 1. Argumento explícito CLI --port possui a maior prioridade
  const parsedArg =
    typeof argPort === "string"
      ? parseInt(argPort, 10)
      : typeof argPort === "number"
      ? argPort
      : undefined;

  if (parsedArg !== undefined && !isNaN(parsedArg) && parsedArg > 0) {
    return parsedArg;
  }

  // 2. Variável de ambiente PORT (respeita 3004 da VPS, ignora 8080 de preview)
  const parsedEnv =
    typeof envPort === "string"
      ? parseInt(envPort, 10)
      : typeof envPort === "number"
      ? envPort
      : undefined;

  if (parsedEnv !== undefined && !isNaN(parsedEnv) && parsedEnv > 0 && parsedEnv !== 8080) {
    return parsedEnv;
  }

  // 3. Fallback contextual por ambiente: Produção = 3004 (compatível com Nginx VPS), Dev = 3000
  return nodeEnv === "production" ? 3004 : 3000;
}
