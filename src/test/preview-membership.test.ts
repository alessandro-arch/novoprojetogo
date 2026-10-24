import { describe, it, expect } from "vitest";
import { pularVinculoPadrao } from "@/lib/preview-membership";

const id = "e07a91f4-fc66-4c2e-be20-efcba945ad38";
describe("vínculo padrão no preview", () => {
  it("pula só o ID listado no preview", () => {
    expect(pularVinculoPadrao(id, { DEV: true, VITE_PREVIEW_SKIP_DEFAULT_MEMBERSHIP: id })).toBe(true);
    expect(pularVinculoPadrao("outro", { DEV: true, VITE_PREVIEW_SKIP_DEFAULT_MEMBERSHIP: id })).toBe(false);
  });
  it("produção ignora a flag", () => {
    expect(pularVinculoPadrao(id, { DEV: false, VITE_PREVIEW_SKIP_DEFAULT_MEMBERSHIP: id })).toBe(false);
  });
});
