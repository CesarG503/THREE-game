import "dotenv/config"
import { defineConfig, env } from "@prisma/config"

export default defineConfig({
  schema: env("PRISMA_SCHEMA_PATH") || "prisma/schema.prisma",
  datasource: {
    url: env("PRISMA_DATABASE_URL") || env("DATABASE_URL"),
  },
})
