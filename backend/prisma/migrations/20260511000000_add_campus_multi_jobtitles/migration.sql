-- CreateTable: job_titles (IF NOT EXISTS para compatibilidad con DBs existentes)
CREATE TABLE IF NOT EXISTS "job_titles" (
    "id"         SERIAL       NOT NULL,
    "name"       VARCHAR(150) NOT NULL,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "sort_order" INTEGER      NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_titles_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "job_titles_name_unique" UNIQUE ("name")
);

-- CreateTable: campuses
CREATE TABLE "campuses" (
    "id"         SERIAL       NOT NULL,
    "name"       VARCHAR(150) NOT NULL,
    "address"    VARCHAR(255),
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- AddColumn: campus_id to users
ALTER TABLE "users" ADD COLUMN "campus_id" INTEGER;

-- DropColumn: job_title from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "job_title";

-- CreateTable: user_job_titles
CREATE TABLE "user_job_titles" (
    "user_id"      INTEGER NOT NULL,
    "job_title_id" INTEGER NOT NULL,
    "sort_order"   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "user_job_titles_pkey" PRIMARY KEY ("user_id", "job_title_id")
);

-- AddForeignKey: users.campus_id -> campuses
ALTER TABLE "users" ADD CONSTRAINT "users_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campuses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: user_job_titles.user_id -> users
ALTER TABLE "user_job_titles" ADD CONSTRAINT "user_job_titles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_job_titles.job_title_id -> job_titles
ALTER TABLE "user_job_titles" ADD CONSTRAINT "user_job_titles_job_title_id_fkey"
    FOREIGN KEY ("job_title_id") REFERENCES "job_titles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
