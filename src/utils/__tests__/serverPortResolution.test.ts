import { describe, it, expect } from "vitest";
import { resolveServerPort, extractArgPort } from "../../../serverPort";

describe("Contrato de Infraestrutura: Resolução de Portas (GIP Flow)", () => {
  it("CENÁRIO 1: PORT=3004 com NODE_ENV=production deve retornar 3004", () => {
    const port = resolveServerPort({
      envPort: 3004,
      nodeEnv: "production"
    });
    expect(port).toBe(3004);
  });

  it("CENÁRIO 2: PORT=3004 com NODE_ENV=development deve retornar 3004", () => {
    const port = resolveServerPort({
      envPort: 3004,
      nodeEnv: "development"
    });
    expect(port).toBe(3004);
  });

  it("CENÁRIO 3: PORT ausente com NODE_ENV=production deve retornar 3004 (VPS Nginx target)", () => {
    const port = resolveServerPort({
      envPort: undefined,
      nodeEnv: "production"
    });
    expect(port).toBe(3004);
  });

  it("CENÁRIO 4: PORT ausente com NODE_ENV=development deve retornar 3000 (Preview IA Studio)", () => {
    const port = resolveServerPort({
      envPort: undefined,
      nodeEnv: "development"
    });
    expect(port).toBe(3000);
  });

  it("CENÁRIO 5: PORT=8080 (injetado por preview) com NODE_ENV=development deve retornar 3000", () => {
    const port = resolveServerPort({
      envPort: 8080,
      nodeEnv: "development"
    });
    expect(port).toBe(3000);
  });

  it("CENÁRIO 6: PORT=8080 com NODE_ENV=production deve retornar 3004", () => {
    const port = resolveServerPort({
      envPort: 8080,
      nodeEnv: "production"
    });
    expect(port).toBe(3004);
  });

  it("CENÁRIO 7: argumento explícito --port 3000 deve ter prioridade máxima", () => {
    const port = resolveServerPort({
      argPort: 3000,
      envPort: 3004,
      nodeEnv: "production"
    });
    expect(port).toBe(3000);
  });

  it("CENÁRIO 8: argumento explícito --port 4000 deve respeitar o valor passado", () => {
    const port = resolveServerPort({
      argPort: 4000,
      envPort: 3004,
      nodeEnv: "production"
    });
    expect(port).toBe(4000);
  });

  it("CENÁRIO 9: suporte a string na variável PORT (ex: '3004' lido de process.env)", () => {
    const port = resolveServerPort({
      envPort: "3004",
      nodeEnv: "production"
    });
    expect(port).toBe(3004);
  });

  it("CENÁRIO 10: chamada sem argumentos resolve para 3000 em ambiente padrão", () => {
    const port = resolveServerPort();
    expect(port).toBe(3000);
  });

  describe("extractArgPort", () => {
    it("deve extrair a porta corretamente de argv", () => {
      expect(extractArgPort(["node", "server.ts", "--port", "3004"])).toBe(3004);
      expect(extractArgPort(["node", "server.ts", "--port", "3000"])).toBe(3000);
      expect(extractArgPort(["node", "server.ts"])).toBeUndefined();
      expect(extractArgPort(["node", "server.ts", "--port"])).toBeUndefined();
      expect(extractArgPort(["node", "server.ts", "--port", "invalid"])).toBeUndefined();
    });
  });
});
