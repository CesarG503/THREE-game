import "dotenv/config"
import { defineConfig } from "@prisma/config"

export default defineConfig({
  schema: process.env.PRISMA_SCHEMA_PATH || "prisma/schema.prisma",
  datasource: {
    url: process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL,
  },
})

