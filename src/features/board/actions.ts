"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const boardPath = "/board";

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const semanticSchema = z.enum(["TODO", "ACTIVE", "DONE", "CUSTOM"]);

const checklistItemSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1).max(240),
  completed: z.boolean(),
  position: z.number().int().min(0),
});

const taskSchema = z.object({
  boardId: z.string().min(1),
  columnId: z.string().min(1),
  taskId: z.string().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().optional().nullable(),
  priority: prioritySchema,
  dueDate: z.string().optional().nullable(),
  checklistItems: z.array(checklistItemSchema).default([]),
});

const columnSchema = z.object({
  boardId: z.string().min(1),
  columnId: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  semanticType: semanticSchema,
  countsAsCompleted: z.boolean(),
  cardColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  cardOpacity: z.number().min(0).max(0.2),
  wipLimit: z.number().int().min(1).max(100),
});

const columnSettingsSchema = z.object({
  boardId: z.string().min(1),
  columns: z.array(columnSchema.extend({ columnId: z.string().min(1) })),
});

const categorySchema = z.object({
  boardId: z.string().min(1),
  categoryId: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function createTask(input: z.input<typeof taskSchema>) {
  const data = taskSchema.parse(input);
  const now = new Date();
  const column = await prisma.kanbanColumn.findUniqueOrThrow({
    where: { id: data.columnId },
  });
  const nextPosition = await getNextTaskPosition(data.columnId);
  const dueDate = parseDueDate(data.dueDate);

  await prisma.$transaction(async (tx) => {
    const task = await tx.kanbanTask.create({
      data: {
        boardId: data.boardId,
        columnId: data.columnId,
        categoryId: data.categoryId || null,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        dueDate,
        position: nextPosition,
        columnChangedAt: now,
        completedAt: column.countsAsCompleted ? now : null,
        checklistItems: {
          create: data.checklistItems.map((item, index) => ({
            text: item.text,
            completed: item.completed,
            position: index,
          })),
        },
      },
    });

    await tx.kanbanTaskEvent.create({
      data: {
        taskId: task.id,
        boardId: data.boardId,
        type: "CREATED",
        toColumnId: data.columnId,
      },
    });

    if (column.countsAsCompleted) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: task.id,
          boardId: data.boardId,
          type: "COMPLETED",
          toColumnId: data.columnId,
        },
      });
    }

    if (data.checklistItems.length > 0) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: task.id,
          boardId: data.boardId,
          type: "CHECKLIST_UPDATED",
          toColumnId: data.columnId,
          metadata: JSON.stringify({ items: data.checklistItems.length }),
        },
      });
    }
  });

  revalidatePath(boardPath);
}

export async function updateTask(input: z.input<typeof taskSchema>) {
  const data = taskSchema.extend({ taskId: z.string().min(1) }).parse(input);
  const now = new Date();
  const dueDate = parseDueDate(data.dueDate);

  await prisma.$transaction(async (tx) => {
    const [task, targetColumn] = await Promise.all([
      tx.kanbanTask.findUniqueOrThrow({
        where: { id: data.taskId },
        include: { checklistItems: { orderBy: { position: "asc" } } },
      }),
      tx.kanbanColumn.findUniqueOrThrow({
        where: { id: data.columnId },
      }),
    ]);

    const moved = task.columnId !== data.columnId;
    const lastTaskInTarget = moved
      ? await tx.kanbanTask.findFirst({
          where: {
            columnId: data.columnId,
            archivedAt: null,
          },
          orderBy: { position: "desc" },
        })
      : null;
    const nextPosition = moved ? (lastTaskInTarget?.position ?? -1) + 1 : task.position;
    const completedAt = targetColumn.countsAsCompleted
      ? task.completedAt ?? now
      : null;

    await tx.kanbanTask.update({
      where: { id: data.taskId },
      data: {
        columnId: data.columnId,
        categoryId: data.categoryId || null,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        dueDate,
        position: nextPosition,
        archivedAt: null,
        columnChangedAt: moved ? now : task.columnChangedAt,
        completedAt,
        checklistItems: {
          deleteMany: {},
          create: data.checklistItems.map((item, index) => ({
            text: item.text,
            completed: item.completed,
            position: index,
          })),
        },
      },
    });

    await tx.kanbanTaskEvent.create({
      data: {
        taskId: data.taskId,
        boardId: data.boardId,
        type: "UPDATED",
        fromColumnId: task.columnId,
        toColumnId: data.columnId,
      },
    });

    if (checklistChanged(task.checklistItems, data.checklistItems)) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: data.taskId,
          boardId: data.boardId,
          type: "CHECKLIST_UPDATED",
          fromColumnId: task.columnId,
          toColumnId: data.columnId,
          metadata: JSON.stringify({ items: data.checklistItems.length }),
        },
      });
    }

    if (moved) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: data.taskId,
          boardId: data.boardId,
          type: "MOVED",
          fromColumnId: task.columnId,
          toColumnId: data.columnId,
        },
      });
    }

    if (targetColumn.countsAsCompleted && !task.completedAt) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: data.taskId,
          boardId: data.boardId,
          type: "COMPLETED",
          fromColumnId: task.columnId,
          toColumnId: data.columnId,
        },
      });
    }

    if (!targetColumn.countsAsCompleted && task.completedAt) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: data.taskId,
          boardId: data.boardId,
          type: "REOPENED",
          fromColumnId: task.columnId,
          toColumnId: data.columnId,
        },
      });
    }
  });

  revalidatePath(boardPath);
}

export async function archiveTask(taskId: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const task = await tx.kanbanTask.findUniqueOrThrow({ where: { id: taskId } });

    await tx.kanbanTask.update({
      where: { id: taskId },
      data: {
        archivedAt: now,
      },
    });

    await tx.kanbanTaskEvent.create({
      data: {
        taskId,
        boardId: task.boardId,
        type: "ARCHIVED",
        fromColumnId: task.columnId,
      },
    });
  });

  revalidatePath(boardPath);
}

export async function restoreTask(taskId: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const task = await tx.kanbanTask.findUniqueOrThrow({ where: { id: taskId } });
    const column = task.columnId
      ? await tx.kanbanColumn.findUnique({ where: { id: task.columnId } })
      : null;
    const targetColumn =
      column ??
      (await tx.kanbanColumn.findFirstOrThrow({
        where: { boardId: task.boardId },
        orderBy: { position: "asc" },
      }));

    const lastTaskInTarget = await tx.kanbanTask.findFirst({
      where: {
        columnId: targetColumn.id,
        archivedAt: null,
      },
      orderBy: { position: "desc" },
    });
    const position = (lastTaskInTarget?.position ?? -1) + 1;

    await tx.kanbanTask.update({
      where: { id: taskId },
      data: {
        columnId: targetColumn.id,
        position,
        archivedAt: null,
        columnChangedAt: task.columnId === targetColumn.id ? task.columnChangedAt : now,
        completedAt: targetColumn.countsAsCompleted ? task.completedAt ?? now : null,
      },
    });

    await tx.kanbanTaskEvent.create({
      data: {
        taskId,
        boardId: task.boardId,
        type: "RESTORED",
        toColumnId: targetColumn.id,
      },
    });
  });

  revalidatePath(boardPath);
}

export async function reorderTasks(input: {
  boardId: string;
  columns: { columnId: string; taskIds: string[] }[];
}) {
  const data = z
    .object({
      boardId: z.string().min(1),
      columns: z.array(
        z.object({
          columnId: z.string().min(1),
          taskIds: z.array(z.string().min(1)),
        }),
      ),
    })
    .parse(input);

  const now = new Date();
  const taskIds = data.columns.flatMap((column) => column.taskIds);

  await prisma.$transaction(async (tx) => {
    const [tasks, columns] = await Promise.all([
      tx.kanbanTask.findMany({
        where: { id: { in: taskIds } },
      }),
      tx.kanbanColumn.findMany({
        where: { id: { in: data.columns.map((column) => column.columnId) } },
      }),
    ]);

    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const columnById = new Map(columns.map((column) => [column.id, column]));

    for (const column of data.columns) {
      const targetColumn = columnById.get(column.columnId);
      if (!targetColumn) {
        continue;
      }

      for (const [position, taskId] of column.taskIds.entries()) {
        const task = taskById.get(taskId);
        if (!task) {
          continue;
        }

        const moved = task.columnId !== column.columnId;
        const completedAt = targetColumn.countsAsCompleted
          ? task.completedAt ?? now
          : null;

        await tx.kanbanTask.update({
          where: { id: taskId },
          data: {
            columnId: column.columnId,
            position,
            columnChangedAt: moved ? now : task.columnChangedAt,
            completedAt,
          },
        });

        if (moved) {
          await tx.kanbanTaskEvent.create({
            data: {
              taskId,
              boardId: data.boardId,
              type: "MOVED",
              fromColumnId: task.columnId,
              toColumnId: column.columnId,
            },
          });
        }

        if (targetColumn.countsAsCompleted && !task.completedAt) {
          await tx.kanbanTaskEvent.create({
            data: {
              taskId,
              boardId: data.boardId,
              type: "COMPLETED",
              fromColumnId: task.columnId,
              toColumnId: column.columnId,
            },
          });
        }

        if (!targetColumn.countsAsCompleted && task.completedAt) {
          await tx.kanbanTaskEvent.create({
            data: {
              taskId,
              boardId: data.boardId,
              type: "REOPENED",
              fromColumnId: task.columnId,
              toColumnId: column.columnId,
            },
          });
        }
      }
    }
  });

  revalidatePath(boardPath);
}

export async function createColumn(input: z.input<typeof columnSchema>) {
  const data = columnSchema.parse(input);
  const position = await prisma.kanbanColumn.count({
    where: { boardId: data.boardId },
  });

  const column = await prisma.kanbanColumn.create({
    data: {
      boardId: data.boardId,
      name: data.name,
      position,
      semanticType: data.semanticType,
      countsAsCompleted: data.countsAsCompleted,
      cardColor: data.cardColor,
      cardOpacity: data.cardOpacity,
      wipLimit: data.wipLimit,
    },
  });

  revalidatePath(boardPath);

  return {
    id: column.id,
    name: column.name,
    position: column.position,
    semanticType: column.semanticType,
    countsAsCompleted: column.countsAsCompleted,
    cardColor: column.cardColor,
    cardOpacity: column.cardOpacity,
    wipLimit: column.wipLimit,
  };
}

export async function updateColumn(input: z.input<typeof columnSchema>) {
  const data = columnSchema.extend({ columnId: z.string().min(1) }).parse(input);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const current = await tx.kanbanColumn.findUniqueOrThrow({
      where: { id: data.columnId },
    });

    await tx.kanbanColumn.update({
      where: { id: data.columnId },
      data: {
        name: data.name,
        semanticType: data.semanticType,
        countsAsCompleted: data.countsAsCompleted,
        cardColor: data.cardColor,
        cardOpacity: data.cardOpacity,
        wipLimit: data.wipLimit,
      },
    });

    if (current.countsAsCompleted !== data.countsAsCompleted) {
      const tasks = await tx.kanbanTask.findMany({
        where: {
          columnId: data.columnId,
          archivedAt: null,
        },
      });

      for (const task of tasks) {
        await tx.kanbanTask.update({
          where: { id: task.id },
          data: {
            completedAt: data.countsAsCompleted ? task.completedAt ?? now : null,
          },
        });

        await tx.kanbanTaskEvent.create({
          data: {
            taskId: task.id,
            boardId: data.boardId,
            type: data.countsAsCompleted ? "COMPLETED" : "REOPENED",
            fromColumnId: data.columnId,
            toColumnId: data.columnId,
            metadata: JSON.stringify({ reason: "column_completion_setting_changed" }),
          },
        });
      }
    }
  });

  revalidatePath(boardPath);
}

export async function updateColumnSettings(
  input: z.input<typeof columnSettingsSchema>,
) {
  const data = columnSettingsSchema.parse(input);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const currentColumns = await tx.kanbanColumn.findMany({
      where: {
        boardId: data.boardId,
        id: { in: data.columns.map((column) => column.columnId) },
      },
    });
    const currentById = new Map(currentColumns.map((column) => [column.id, column]));

    for (const [position, column] of data.columns.entries()) {
      const current = currentById.get(column.columnId);
      if (!current) {
        continue;
      }

      await tx.kanbanColumn.update({
        where: { id: column.columnId },
        data: {
          name: column.name,
          position,
          semanticType: column.semanticType,
          countsAsCompleted: column.countsAsCompleted,
          cardColor: column.cardColor,
          cardOpacity: column.cardOpacity,
          wipLimit: column.wipLimit,
        },
      });

      if (current.countsAsCompleted !== column.countsAsCompleted) {
        const tasks = await tx.kanbanTask.findMany({
          where: {
            columnId: column.columnId,
            archivedAt: null,
          },
        });

        for (const task of tasks) {
          await tx.kanbanTask.update({
            where: { id: task.id },
            data: {
              completedAt: column.countsAsCompleted ? task.completedAt ?? now : null,
            },
          });

          await tx.kanbanTaskEvent.create({
            data: {
              taskId: task.id,
              boardId: data.boardId,
              type: column.countsAsCompleted ? "COMPLETED" : "REOPENED",
              fromColumnId: column.columnId,
              toColumnId: column.columnId,
              metadata: JSON.stringify({ reason: "column_settings_saved" }),
            },
          });
        }
      }
    }
  });

  revalidatePath(boardPath);
}

export async function reorderColumns(input: {
  boardId: string;
  columnIds: string[];
}) {
  const data = z
    .object({
      boardId: z.string().min(1),
      columnIds: z.array(z.string().min(1)),
    })
    .parse(input);

  await prisma.$transaction(
    data.columnIds.map((columnId, position) =>
      prisma.kanbanColumn.update({
        where: { id: columnId },
        data: { position },
      }),
    ),
  );

  revalidatePath(boardPath);
}

export async function deleteColumn(columnId: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const column = await tx.kanbanColumn.findUniqueOrThrow({
      where: { id: columnId },
      include: { tasks: { where: { archivedAt: null } } },
    });

    for (const task of column.tasks) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: task.id,
          boardId: task.boardId,
          type: "ARCHIVED",
          fromColumnId: columnId,
          metadata: JSON.stringify({ reason: "column_deleted" }),
        },
      });
    }

    await tx.kanbanTask.updateMany({
      where: { columnId },
      data: {
        archivedAt: now,
        columnId: null,
        completedAt: null,
      },
    });

    await tx.kanbanColumn.delete({
      where: { id: columnId },
    });

    const remaining = await tx.kanbanColumn.findMany({
      where: { boardId: column.boardId },
      orderBy: { position: "asc" },
    });

    for (const [position, remainingColumn] of remaining.entries()) {
      await tx.kanbanColumn.update({
        where: { id: remainingColumn.id },
        data: { position },
      });
    }
  });

  revalidatePath(boardPath);
}

export async function createCategory(input: z.input<typeof categorySchema>) {
  const data = categorySchema.parse(input);

  await prisma.kanbanCategory.create({
    data: {
      boardId: data.boardId,
      name: data.name,
      color: data.color,
      isDefault: false,
    },
  });

  revalidatePath(boardPath);
}

export async function updateCategory(input: z.input<typeof categorySchema>) {
  const data = categorySchema.extend({ categoryId: z.string().min(1) }).parse(input);

  await prisma.kanbanCategory.update({
    where: { id: data.categoryId },
    data: {
      name: data.name,
      color: data.color,
    },
  });

  revalidatePath(boardPath);
}

export async function addTaskComment(input: {
  boardId: string;
  taskId: string;
  body: string;
}) {
  const data = z
    .object({
      boardId: z.string().min(1),
      taskId: z.string().min(1),
      body: z.string().trim().min(1).max(1200),
    })
    .parse(input);

  const comment = await prisma.$transaction(async (tx) => {
    const createdComment = await tx.kanbanTaskComment.create({
      data: {
        taskId: data.taskId,
        body: data.body,
      },
    });

    await tx.kanbanTaskEvent.create({
      data: {
        taskId: data.taskId,
        boardId: data.boardId,
        type: "COMMENTED",
      },
    });

    return createdComment;
  });

  revalidatePath(boardPath);

  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function deleteTaskComment(input: {
  boardId: string;
  taskId: string;
  commentId: string;
}) {
  const data = z
    .object({
      boardId: z.string().min(1),
      taskId: z.string().min(1),
      commentId: z.string().min(1),
    })
    .parse(input);

  await prisma.$transaction(async (tx) => {
    const deletedComment = await tx.kanbanTaskComment.updateMany({
      where: {
        id: data.commentId,
        taskId: data.taskId,
        task: { boardId: data.boardId },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (deletedComment.count > 0) {
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: data.taskId,
          boardId: data.boardId,
          type: "COMMENTED",
          metadata: JSON.stringify({
            action: "comment_deleted",
            commentId: data.commentId,
          }),
        },
      });
    }
  });

  revalidatePath(boardPath);
}

async function getNextTaskPosition(columnId: string) {
  const lastTask = await prisma.kanbanTask.findFirst({
    where: {
      columnId,
      archivedAt: null,
    },
    orderBy: { position: "desc" },
  });

  return (lastTask?.position ?? -1) + 1;
}

function parseDueDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function checklistChanged(
  current: { text: string; completed: boolean; position: number }[],
  next: { text: string; completed: boolean; position: number }[],
) {
  return JSON.stringify(normalizeChecklist(current)) !== JSON.stringify(normalizeChecklist(next));
}

function normalizeChecklist(
  items: { text: string; completed: boolean; position: number }[],
) {
  return items
    .map((item, index) => ({
      text: item.text.trim(),
      completed: item.completed,
      position: index,
    }))
    .sort((a, b) => a.position - b.position);
}
