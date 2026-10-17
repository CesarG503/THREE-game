import "dotenv/config"
import { defineConfig } from "@prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://game_user:game_password@localhost:5432/threejs_game?schema=public",
  },
})
