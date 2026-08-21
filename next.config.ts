import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  // The tutor prompt reads .claude/skills/*.md from disk at runtime
  // (src/lib/skill-files.ts). Next traces imports but not arbitrary fs reads,
  // so bundle those files into the turn functions or they ENOENT on Vercel.
  outputFileTracingIncludes: {
    "/api/turn": [".claude/skills/**"],
    "/api/turn/retry": [".claude/skills/**"],
  },
};

export default nextConfig;
