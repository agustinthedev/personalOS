-- AlterTable
ALTER TABLE "KanbanTaskComment" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "KanbanTaskComment_taskId_deletedAt_idx" ON "KanbanTaskComment"("taskId", "deletedAt");
