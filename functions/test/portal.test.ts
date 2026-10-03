import { randomBytes } from "node:crypto";
import { verPortalSchema } from "@cident/shared";
import { describe, expect, it } from "vitest";
import { hashToken } from "../src/portal/enlaces";

describe("token del portal", () => {
  it("32 bytes en base64url cumplen el schema público", () => {
    const token = randomBytes(32).toString("base64url");
    expect(verPortalSchema.safeParse({ token }).success).toBe(true);
  });

  it("el hash es determinista, hex de 64 caracteres y distinto del token", () => {
    const token = randomBytes(32).toString("base64url");
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
