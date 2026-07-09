import { prisma } from "@/lib/db";
import type {
  BoardCategory,
  BoardChecklistItem,
  BoardColumn,
  BoardComment,
  BoardPageData,
  BoardTask,
  KanbanPriority,
  KanbanSemantic,
} from "./types";

type TaskRecord = {
  id: string;
  boardId: string;
  columnId: string | null;
  categoryId: string | null;
  title: string;
  description: string | null;
  priority: string;
  dueDate: Date | null;
  position: number;
  archivedAt: Date | null;
  columnChangedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    color: string;
    isDefault: boolean;
  } | null;
  checklistItems: {
    id: string;
    text: string;
    completed: boolean;
    position: number;
  }[];
  comments: {
    id: string;
    body: string;
    createdAt: Date;
  }[];
};

const defaultColumns = [
  {
    name: "To Do",
    position: 0,
    semanticType: "TODO",
    countsAsCompleted: false,
    cardColor: "#7dd3fc",
    cardOpacity: 0.03,
  },
  {
    name: "Doing",
    position: 1,
    semanticType: "ACTIVE",
    countsAsCompleted: false,
    cardColor: "#facc15",
    cardOpacity: 0.03,
  },
  {
    name: "Done",
    position: 2,
    semanticType: "DONE",
    countsAsCompleted: true,
    cardColor: "#86efac",
    cardOpacity: 0.03,
  },
] as const;

const defaultCategory = {
  name: "General",
  color: "#94a3b8",
  isDefault: true,
};

export async function getBoardPageData(): Promise<BoardPageData> {
  const board = await ensureDefaultBoard();

  const [columns, categories, archivedTasks, activeCount, completedCount, archivedCount] =
    await Promise.all([
      prisma.kanbanColumn.findMany({
        where: { boardId: board.id },
        orderBy: { position: "asc" },
        include: {
          tasks: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            include: taskIncludes,
          },
        },
      }),
      prisma.kanbanCategory.findMany({
        where: { boardId: board.id },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      prisma.kanbanTask.findMany({
        where: { boardId: board.id, archivedAt: { not: null } },
        orderBy: { archivedAt: "desc" },
        include: taskIncludes,
      }),
      prisma.kanbanTask.count({
        where: { boardId: board.id, archivedAt: null },
      }),
      prisma.kanbanTask.count({
        where: {
          boardId: board.id,
          archivedAt: null,
          completedAt: { not: null },
          column: { countsAsCompleted: true },
        },
      }),
      prisma.kanbanTask.count({
        where: { boardId: board.id, archivedAt: { not: null } },
      }),
    ]);

  return {
    board: {
      id: board.id,
      name: board.name,
    },
    columns: columns.map(toColumn),
    categories: categories.map(toCategory),
    archivedTasks: archivedTasks.map(toTask),
    summary: {
      active: activeCount,
      completed: completedCount,
      archived: archivedCount,
    },
  };
}

export async function ensureDefaultBoard() {
  const existing = await prisma.kanbanBoard.findFirst({
    where: { isDefault: true },
    include: {
      columns: true,
      categories: true,
    },
  });

  if (!existing) {
    return prisma.kanbanBoard.create({
      data: {
        name: "Personal Board",
        isDefault: true,
        columns: {
          create: defaultColumns.map((column) => ({
            ...column,
            semanticType: column.semanticType,
          })),
        },
        categories: {
          create: defaultCategory,
        },
      },
    });
  }

  await ensureDefaultBoardChildren(existing.id, existing.columns.length, existing.categories.length);

  return existing;
}

async function ensureDefaultBoardChildren(
  boardId: string,
  columnCount: number,
  categoryCount: number,
) {
  if (columnCount === 0) {
    await prisma.kanbanColumn.createMany({
      data: defaultColumns.map((column) => ({
        boardId,
        ...column,
      })),
    });
  }

  if (categoryCount === 0) {
    await prisma.kanbanCategory.create({
      data: {
        boardId,
        ...defaultCategory,
      },
    });
  }
}

const taskIncludes = {
  category: true,
  checklistItems: {
    orderBy: { position: "asc" as const },
  },
  comments: {
    orderBy: { createdAt: "asc" as const },
  },
};

function toColumn(column: {
  id: string;
  name: string;
  position: number;
  semanticType: string;
  countsAsCompleted: boolean;
  cardColor: string;
  cardOpacity: number;
  wipLimit: number;
  tasks: TaskRecord[];
}): BoardColumn {
  return {
    id: column.id,
    name: column.name,
    position: column.position,
    semanticType: column.semanticType as KanbanSemantic,
    countsAsCompleted: column.countsAsCompleted,
    cardColor: column.cardColor,
    cardOpacity: column.cardOpacity,
    wipLimit: column.wipLimit,
    tasks: column.tasks.map(toTask),
  };
}

function toTask(task: TaskRecord): BoardTask {
  return {
    id: task.id,
    boardId: task.boardId,
    columnId: task.columnId,
    categoryId: task.categoryId,
    title: task.title,
    description: task.description ?? "",
    priority: task.priority as KanbanPriority,
    dueDate: task.dueDate ? toDateInputValue(task.dueDate) : null,
    position: task.position,
    archivedAt: task.archivedAt?.toISOString() ?? null,
    columnChangedAt: task.columnChangedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    category: task.category ? toCategory(task.category) : null,
    checklistItems: task.checklistItems.map(toChecklistItem),
    comments: task.comments.map(toComment),
  };
}

function toCategory(category: {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}): BoardCategory {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    isDefault: category.isDefault,
  };
}

function toChecklistItem(item: {
  id: string;
  text: string;
  completed: boolean;
  position: number;
}): BoardChecklistItem {
  return {
    id: item.id,
    text: item.text,
    completed: item.completed,
    position: item.position,
  };
}

function toComment(comment: { id: string; body: string; createdAt: Date }): BoardComment {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
