-- Tài khoản người thu theo khu vực (COLLECTOR)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COLLECTOR';

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "user_username_key" ON "user"("username") WHERE "username" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "collector_route" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collector_route_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "collector_route_user_id_route_id_key"
  ON "collector_route"("user_id", "route_id");

ALTER TABLE "collector_route"
  DROP CONSTRAINT IF EXISTS "collector_route_user_id_fkey";
ALTER TABLE "collector_route"
  ADD CONSTRAINT "collector_route_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collector_route"
  DROP CONSTRAINT IF EXISTS "collector_route_route_id_fkey";
ALTER TABLE "collector_route"
  ADD CONSTRAINT "collector_route_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "collection_route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
