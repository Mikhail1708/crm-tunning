-- A fresh generation for every existing/new user, including reused numeric IDs.
-- PostgreSQL 13+ provides gen_random_uuid() without an extension.
ALTER TABLE "User"
ADD COLUMN "authGeneration" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;
