-- CreateTable
CREATE TABLE "KanbanBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KanbanColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "semanticType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "countsAsCompleted" BOOLEAN NOT NULL DEFAULT false,
    "cardColor" TEXT NOT NULL DEFAULT '#ffffff',
    "cardOpacity" REAL NOT NULL DEFAULT 0.03,
    "wipLimit" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KanbanColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "KanbanBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KanbanCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KanbanCategory_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "KanbanBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KanbanTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" DATETIME,
    "position" INTEGER NOT NULL,
    "archivedAt" DATETIME,
    "columnChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KanbanTask_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "KanbanBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KanbanTask_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "KanbanColumn" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KanbanTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KanbanCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KanbanChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KanbanChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KanbanTaskComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KanbanTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KanbanTaskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "boardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromColumnId" TEXT,
    "toColumnId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KanbanTaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KanbanTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KanbanTaskEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "KanbanBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KanbanBoard_isDefault_idx" ON "KanbanBoard"("isDefault");

-- CreateIndex
CREATE INDEX "KanbanColumn_boardId_position_idx" ON "KanbanColumn"("boardId", "position");

-- CreateIndex
CREATE INDEX "KanbanCategory_boardId_name_idx" ON "KanbanCategory"("boardId", "name");

-- CreateIndex
CREATE INDEX "KanbanTask_boardId_archivedAt_idx" ON "KanbanTask"("boardId", "archivedAt");

-- CreateIndex
CREATE INDEX "KanbanTask_boardId_completedAt_idx" ON "KanbanTask"("boardId", "completedAt");

-- CreateIndex
CREATE INDEX "KanbanTask_columnId_position_idx" ON "KanbanTask"("columnId", "position");

-- CreateIndex
CREATE INDEX "KanbanTask_categoryId_idx" ON "KanbanTask"("categoryId");

-- CreateIndex
CREATE INDEX "KanbanTask_priority_idx" ON "KanbanTask"("priority");

-- CreateIndex
CREATE INDEX "KanbanTask_dueDate_idx" ON "KanbanTask"("dueDate");

-- CreateIndex
CREATE INDEX "KanbanChecklistItem_taskId_position_idx" ON "KanbanChecklistItem"("taskId", "position");

-- CreateIndex
CREATE INDEX "KanbanTaskComment_taskId_createdAt_idx" ON "KanbanTaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "KanbanTaskEvent_boardId_createdAt_idx" ON "KanbanTaskEvent"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "KanbanTaskEvent_taskId_createdAt_idx" ON "KanbanTaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "KanbanTaskEvent_type_createdAt_idx" ON "KanbanTaskEvent"("type", "createdAt");
