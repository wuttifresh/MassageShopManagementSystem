import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [
      // Must come before the general "@" alias below (Vite/Vitest matches in order) — see
      // test/mocks/prisma-client.ts for why this stand-in exists.
      { find: "@/generated/prisma/client", replacement: path.resolve(__dirname, "./test/mocks/prisma-client.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
