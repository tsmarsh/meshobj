import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  "./packages/restlette/vitest.config.ts",
  "./packages/graphlette/vitest.config.ts",
  "./packages/meshql/vitest.config.ts",
  "./packages/casbin_auth/vitest.config.ts",
  "./packages/memory_repo/vitest.config.ts",
  "./packages/sqlite_repo/vitest.config.ts",
  "./packages/mongo_repo/vitest.config.ts"
])
