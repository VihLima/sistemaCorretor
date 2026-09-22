import { describe, expect, it } from "vitest";
import { sniffImageType } from "@/server/storage/sniff";
import { PNG_1PX } from "../fixtures/images";

describe("sniffImageType", () => {
  it("detecta PNG, JPEG e WebP pelos bytes", () => {
    expect(sniffImageType(PNG_1PX)?.ext).toBe("png");
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext).toBe("jpg");
    expect(sniffImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))?.ext).toBe("webp");
  });
  it("rejeita outros formatos", () => {
    expect(sniffImageType(Buffer.from("<svg></svg>"))).toBeNull();
  });
});
