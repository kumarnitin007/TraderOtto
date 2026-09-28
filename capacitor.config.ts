import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.traderotto.app",
  appName: "Otto's World",
  webDir: "out",
  server: {
    androidScheme: "https",
    hostname: "localhost",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F6EFE2",
  },
};

export default config;
