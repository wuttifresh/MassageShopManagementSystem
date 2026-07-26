-- CreateTable
CREATE TABLE "therapist_time_blocks" (
    "id" TEXT NOT NULL,
    "therapist_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapist_time_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "therapist_time_blocks_therapist_id_date_idx" ON "therapist_time_blocks"("therapist_id", "date");

-- AddForeignKey
ALTER TABLE "therapist_time_blocks" ADD CONSTRAINT "therapist_time_blocks_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_time_blocks" ADD CONSTRAINT "therapist_time_blocks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
