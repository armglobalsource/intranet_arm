-- CreateEnum
CREATE TYPE "OrgNodeType" AS ENUM ('leader', 'group', 'person');

-- CreateTable
CREATE TABLE "org_areas" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(10) NOT NULL,
    "desc" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_nodes" (
    "id" SERIAL NOT NULL,
    "area_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "type" "OrgNodeType" NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "role" VARCHAR(255),
    "description" TEXT,
    "icon" VARCHAR(10),
    "col_position" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_areas_slug_key" ON "org_areas"("slug");

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "org_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
