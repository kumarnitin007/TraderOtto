import { describe, expect, it } from "vitest";
import { wifiQrPayload } from "@/lib/wifiQr";

describe("wifi QR payload", () => {
  it("uses WPA and escapes characters that would break the code", () => {
    expect(wifiQrPayload("Home", "p;a:ss")).toBe("WIFI:T:WPA;S:Home;P:p\\;a\\:ss;;");
  });

  it("omits a password when the network is open", () => {
    expect(wifiQrPayload("Cafe", "")).toBe("WIFI:T:nopass;S:Cafe;;");
  });
});
