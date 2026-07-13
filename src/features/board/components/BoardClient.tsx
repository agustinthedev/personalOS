"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addTaskComment,
  archiveTask,
  createCategory,
  createColumn,
  createTask,
  deleteColumn,
  deleteTaskComment,
  reorderTasks,
  restoreTask,
  updateCategory,
  updateColumnSettings,
  updateTask,
} from "@/features/board/actions";
import {
  BoardCategory,
  BoardChecklistItem,
  BoardColumn,
  BoardComment,
  BoardPageData,
  BoardTask,
  KanbanPriority,
  KanbanSemantic,
  priorityOptions,
} from "@/features/board/types";

type ActiveModal =
  | { type: "task"; columnId: string; task?: BoardTask }
  | { type: "settings" }
  | { type: "categories" }
  | { type: "archived" }
  | null;

const subtleButtonClass =
  "glass-button cursor-pointer rounded-[28px] text-sm font-semibold text-zinc-200 transition duration-150 hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/[0.055] active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45";

const primaryButtonClass =
  "cursor-pointer rounded-[28px] bg-white text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(255,255,255,0.14)] transition duration-150 hover:-translate-y-0.5 hover:bg-zinc-100 hover:shadow-[0_0_34px_rgba(255,255,255,0.2)] active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60";

const outlineButtonClass =
  "cursor-pointer rounded-[28px] border border-white/12 bg-white/[0.012] text-sm font-semibold text-zinc-300 transition duration-150 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/[0.04] hover:text-zinc-50 active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40";

const dangerIconButtonClass =
  "cursor-pointer rounded-[28px] border border-red-400/20 bg-red-500/[0.035] text-red-200 transition duration-150 hover:-translate-y-0.5 hover:border-red-300/45 hover:bg-red-500/[0.09] hover:text-red-100 active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40";

const dangerTextButtonClass =
  "cursor-pointer rounded-[28px] border border-red-400/24 bg-red-500/[0.045] text-sm font-semibold text-red-200 transition duration-150 hover:-translate-y-0.5 hover:border-red-300/50 hover:bg-red-500/[0.1] hover:text-red-100 active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45";

function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function BoardClient({ initialData }: { initialData: BoardPageData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(initialData);
  }, [initialData]);

  function refresh() {
    router.refresh();
  }

  function closeModal() {
    setActiveModal(null);
  }

  function applyColumnSettings(columns: BoardColumn[]) {
    const orderedColumns = columns
      .map((column, position) => ({ ...column, position }))
      .sort((a, b) => a.position - b.position);

    setData((current) => ({
      ...current,
      columns: orderedColumns,
    }));
  }

  function findTaskLocation(taskId: string, columns = data.columns) {
    for (const column of columns) {
      const taskIndex = column.tasks.findIndex((task) => task.id === taskId);
      if (taskIndex >= 0) {
        return { columnId: column.id, taskIndex };
      }
    }

    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeTaskId = String(active.id);
    const source = findTaskLocation(activeTaskId);
    if (!source) {
      return;
    }

    const overId = String(over.id);
    const targetColumnId = overId.startsWith("column:")
      ? overId.replace("column:", "")
      : findTaskLocation(overId)?.columnId;

    if (!targetColumnId) {
      return;
    }

    const nextColumns = data.columns.map((column) => ({
      ...column,
      tasks: [...column.tasks],
    }));
    const sourceColumn = nextColumns.find((column) => column.id === source.columnId);
    const targetColumn = nextColumns.find((column) => column.id === targetColumnId);

    if (!sourceColumn || !targetColumn) {
      return;
    }

    const [movedTask] = sourceColumn.tasks.splice(source.taskIndex, 1);
    const targetIndex = overId.startsWith("column:")
      ? targetColumn.tasks.length
      : Math.max(
          0,
          targetColumn.tasks.findIndex((task) => task.id === overId),
        );

    const nextTask = {
      ...movedTask,
      columnId: targetColumnId,
      completedAt: targetColumn.countsAsCompleted
        ? movedTask.completedAt ?? new Date().toISOString()
        : null,
      columnChangedAt:
        movedTask.columnId === targetColumnId
          ? movedTask.columnChangedAt
          : new Date().toISOString(),
    };

    targetColumn.tasks.splice(targetIndex, 0, nextTask);

    const positionedColumns = nextColumns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task, position) => ({ ...task, position })),
    }));

    setData((current) => ({
      ...current,
      columns: positionedColumns,
    }));

    startTransition(async () => {
      await reorderTasks({
        boardId: data.board.id,
        columns: positionedColumns.map((column) => ({
          columnId: column.id,
          taskIds: column.tasks.map((task) => task.id),
        })),
      });
      refresh();
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveModal({ type: "settings" })}
            className={`${subtleButtonClass} h-9 px-3`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveModal({ type: "categories" })}
            className={`${subtleButtonClass} h-9 px-3`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => setActiveModal({ type: "archived" })}
            className={`${subtleButtonClass} h-9 px-3`}
          >
            Archived
          </button>
        </div>
        {isPending ? (
          <p className="font-mono text-xs text-zinc-400">syncing.board</p>
        ) : null}
      </div>

      {isHydrated ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-4 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            {data.columns.map((column) => (
              <BoardColumnView
                key={column.id}
                column={column}
                onAddTask={() => setActiveModal({ type: "task", columnId: column.id })}
                onOpenTask={(task) =>
                  setActiveModal({ type: "task", columnId: column.id, task })
                }
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          {data.columns.map((column) => (
            <StaticBoardColumnView
              key={column.id}
              column={column}
              onAddTask={() => setActiveModal({ type: "task", columnId: column.id })}
              onOpenTask={(task) =>
                setActiveModal({ type: "task", columnId: column.id, task })
              }
            />
          ))}
        </div>
      )}

      {activeModal?.type === "task" ? (
        <TaskModal
          key={activeModal.task?.id ?? `new-${activeModal.columnId}`}
          boardId={data.board.id}
          columns={data.columns}
          categories={data.categories}
          columnId={activeModal.columnId}
          task={activeModal.task}
          onClose={closeModal}
          onSaved={refresh}
        />
      ) : null}

      {activeModal?.type === "settings" ? (
        <SettingsModal
          boardId={data.board.id}
          columns={data.columns}
          onClose={closeModal}
          onSaved={applyColumnSettings}
        />
      ) : null}

      {activeModal?.type === "categories" ? (
        <CategoriesModal
          boardId={data.board.id}
          categories={data.categories}
          onClose={closeModal}
          onSaved={refresh}
        />
      ) : null}

      {activeModal?.type === "archived" ? (
        <ArchivedModal
          tasks={data.archivedTasks}
          onClose={closeModal}
          onSaved={refresh}
        />
      ) : null}

    </>
  );
}

function emptySubscribe() {
  return () => {};
}

function BoardColumnView({
  column,
  onAddTask,
  onOpenTask,
}: {
  column: BoardColumn;
  onAddTask: () => void;
  onOpenTask: (task: BoardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });

  return (
    <section
      ref={setNodeRef}
      className={`panel min-h-[280px] rounded-[28px] p-4 transition ${
        isOver ? "border-white/45" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            {column.countsAsCompleted ? "Completed" : column.semanticType.toLowerCase()}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{column.name}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-1 font-mono text-xs text-zinc-300">
          {column.tasks.length}/{column.wipLimit}
        </span>
      </div>

      <SortableContext
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="mt-4 grid gap-3">
          {column.tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              column={column}
              onOpen={() => onOpenTask(task)}
            />
          ))}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={onAddTask}
        className="mt-4 h-10 w-full cursor-pointer rounded-[28px] border border-dashed border-white/18 bg-white/[0.015] text-sm font-semibold text-zinc-200 transition duration-150 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/[0.045] active:translate-y-0 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
      >
        New task
      </button>
    </section>
  );
}

function StaticBoardColumnView({
  column,
  onAddTask,
  onOpenTask,
}: {
  column: BoardColumn;
  onAddTask: () => void;
  onOpenTask: (task: BoardTask) => void;
}) {
  return (
    <section className="panel min-h-[280px] rounded-[28px] p-4 transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            {column.countsAsCompleted ? "Completed" : column.semanticType.toLowerCase()}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{column.name}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-1 font-mono text-xs text-zinc-300">
          {column.tasks.length}/{column.wipLimit}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {column.tasks.map((task) => (
          <StaticTaskCard
            key={task.id}
            task={task}
            column={column}
            onOpen={() => onOpenTask(task)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddTask}
        className="mt-4 h-10 w-full cursor-pointer rounded-[28px] border border-dashed border-white/18 bg-white/[0.015] text-sm font-semibold text-zinc-200 transition duration-150 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/[0.045] active:translate-y-0 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
      >
        New task
      </button>
    </section>
  );
}

function SortableTaskCard({
  task,
  column,
  onOpen,
}: {
  task: BoardTask;
  column: BoardColumn;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const completedChecklist = task.checklistItems.filter((item) => item.completed).length;

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: hexToRgba(column.cardColor, column.cardOpacity),
      }}
      className={`rounded-[18px] border border-white/12 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition ${
        isDragging ? "scale-[1.015] border-white/45 opacity-80" : "hover:border-white/32"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-pointer rounded-[14px] text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
        {...attributes}
        {...listeners}
      >
        <TaskCardContent task={task} completedChecklist={completedChecklist} />
      </button>
    </article>
  );
}

function StaticTaskCard({
  task,
  column,
  onOpen,
}: {
  task: BoardTask;
  column: BoardColumn;
  onOpen: () => void;
}) {
  const completedChecklist = task.checklistItems.filter((item) => item.completed).length;

  return (
    <article
      style={{
        backgroundColor: hexToRgba(column.cardColor, column.cardOpacity),
      }}
      className="rounded-[18px] border border-white/12 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition hover:border-white/32"
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-pointer rounded-[14px] text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
      >
        <TaskCardContent task={task} completedChecklist={completedChecklist} />
      </button>
    </article>
  );
}

function TaskCardContent({
  task,
  completedChecklist,
}: {
  task: BoardTask;
  completedChecklist: number;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-semibold leading-6 text-zinc-50">
          {task.title}
        </h3>
        <span className="shrink-0 rounded-full border border-white/12 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
          {priorityLabel(task.priority)}
        </span>
      </div>

      {task.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {task.category ? (
          <span
            className="rounded-full px-2 py-1 text-xs font-semibold text-zinc-950"
            style={{ backgroundColor: task.category.color }}
          >
            {task.category.name}
          </span>
        ) : null}
        {task.dueDate ? (
          <span className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-1 font-mono text-xs text-zinc-300">
            {formatDate(task.dueDate)}
          </span>
        ) : null}
        {task.checklistItems.length > 0 ? (
          <span className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-1 font-mono text-xs text-zinc-300">
            {completedChecklist}/{task.checklistItems.length}
          </span>
        ) : null}
      </div>
    </>
  );
}

function TaskModal({
  boardId,
  columns,
  categories,
  columnId,
  task,
  onClose,
  onSaved,
}: {
  boardId: string;
  columns: BoardColumn[];
  categories: BoardCategory[];
  columnId: string;
  task?: BoardTask;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [selectedColumnId, setSelectedColumnId] = useState(task?.columnId ?? columnId);
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? categories[0]?.id ?? "");
  const [priority, setPriority] = useState<KanbanPriority>(task?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [checklist, setChecklist] = useState<BoardChecklistItem[]>(
    task?.checklistItems ?? [],
  );
  const [comments, setComments] = useState<BoardComment[]>(task?.comments ?? []);
  const [comment, setComment] = useState("");

  function saveTask() {
    startTransition(async () => {
      const payload = {
        boardId,
        columnId: selectedColumnId,
        taskId: task?.id,
        title,
        description,
        categoryId: categoryId || null,
        priority,
        dueDate: dueDate || null,
        checklistItems: checklist.map((item, index) => ({
          id: item.id,
          text: item.text,
          completed: item.completed,
          position: index,
        })),
      };

      if (task) {
        await updateTask(payload);
      } else {
        await createTask(payload);
      }

      onSaved();
      onClose();
    });
  }

  function addChecklistItem() {
    setChecklist((items) => [
      ...items,
      {
        id: `draft-${crypto.randomUUID()}`,
        text: "",
        completed: false,
        position: items.length,
      },
    ]);
  }

  function updateChecklistItem(
    itemId: string,
    update: Partial<Pick<BoardChecklistItem, "text" | "completed">>,
  ) {
    setChecklist((items) =>
      items.map((item) => (item.id === itemId ? { ...item, ...update } : item)),
    );
  }

  function removeChecklistItem(itemId: string) {
    setChecklist((items) => items.filter((item) => item.id !== itemId));
  }

  function addComment() {
    if (!task || !comment.trim()) {
      return;
    }

    startTransition(async () => {
      const createdComment = await addTaskComment({ boardId, taskId: task.id, body: comment });
      setComments((items) => [...items, createdComment]);
      setComment("");
      onSaved();
    });
  }

  function deleteComment(commentId: string) {
    if (!task) {
      return;
    }

    startTransition(async () => {
      await deleteTaskComment({ boardId, taskId: task.id, commentId });
      setComments((items) => items.filter((item) => item.id !== commentId));
      onSaved();
    });
  }

  function archiveCurrentTask() {
    if (!task) {
      return;
    }

    startTransition(async () => {
      await archiveTask(task.id);
      onSaved();
      onClose();
    });
  }

  return (
    <ModalShell title={task ? "Edit task" : "New task"} onClose={onClose}>
      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Title
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-2xl border border-white/12 bg-white/[0.025] px-3 py-2 text-zinc-50 outline-none transition focus:border-white/45"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="resize-none rounded-2xl border border-white/12 bg-white/[0.025] px-3 py-2 text-zinc-50 outline-none transition focus:border-white/45"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Column"
            value={selectedColumnId}
            onChange={setSelectedColumnId}
            options={columns.map((column) => ({ value: column.id, label: column.name }))}
          />
          <SelectField
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
          <SelectField
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as KanbanPriority)}
            options={priorityOptions}
          />
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Due date
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-10 rounded-2xl border border-white/12 bg-white/[0.025] px-3 text-zinc-50 outline-none transition focus:border-white/45"
            />
          </label>
        </div>

        <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.015] p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-zinc-50">Checklist</h3>
            <button
              type="button"
              onClick={addChecklistItem}
              className={`${outlineButtonClass} px-3 py-1`}
            >
              Add
            </button>
          </div>
          {checklist.map((item) => (
            <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(event) =>
                  updateChecklistItem(item.id, { completed: event.target.checked })
                }
                className="h-4 w-4 accent-zinc-100"
              />
              <input
                value={item.text}
                onChange={(event) =>
                  updateChecklistItem(item.id, { text: event.target.value })
                }
                className="min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-50 outline-none"
              />
              <button
                type="button"
                onClick={() => removeChecklistItem(item.id)}
                className={`${outlineButtonClass} px-2 py-1 text-xs`}
              >
                Remove
              </button>
            </div>
          ))}
        </section>

        {task ? (
          <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.015] p-3">
            <h3 className="font-semibold text-zinc-50">Comments</h3>
            <div className="glass-scrollbar grid max-h-48 gap-2 overflow-auto pr-1">
              {comments.length > 0 ? (
                comments.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-xl bg-black/14 p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-sm leading-6 text-zinc-200">{item.body}</p>
                      <p className="mt-2 font-mono text-[11px] text-zinc-500">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteComment(item.id)}
                      aria-label="Delete comment"
                      title="Delete comment"
                      disabled={isPending}
                      className={`${dangerIconButtonClass} flex h-8 w-8 items-center justify-center p-0`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">No comments yet.</p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-50 outline-none"
              />
              <button
                type="button"
                onClick={addComment}
                disabled={isPending}
                className={`${primaryButtonClass} rounded-xl px-4 py-2`}
              >
                Comment
              </button>
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap justify-between gap-3">
          {task ? (
            <button
              type="button"
              onClick={archiveCurrentTask}
              disabled={isPending}
              className={`${dangerTextButtonClass} px-4 py-2`}
            >
              Archive
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`${outlineButtonClass} px-4 py-2`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveTask}
              disabled={isPending || !title.trim()}
              className={`${primaryButtonClass} px-4 py-2`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function SettingsModal({
  boardId,
  columns,
  onClose,
  onSaved,
}: {
  boardId: string;
  columns: BoardColumn[];
  onClose: () => void;
  onSaved: (columns: BoardColumn[]) => void;
}) {
  const [draftColumns, setDraftColumns] = useState(columns);
  const [newColumn, setNewColumn] = useState({
    name: "",
    semanticType: "CUSTOM" as KanbanSemantic,
    countsAsCompleted: false,
    cardColor: "#ffffff",
    cardOpacity: 0.03,
    wipLimit: 100,
  });
  const [isPending, startTransition] = useTransition();

  function updateDraft(columnId: string, update: Partial<BoardColumn>) {
    setDraftColumns((items) =>
      items.map((column) => (column.id === columnId ? { ...column, ...update } : column)),
    );
  }

  function toMaxItems(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 1;
    }

    return Math.min(100, Math.max(1, Math.trunc(parsed)));
  }

  function saveColumns() {
    const orderedColumns = draftColumns.map((column, position) => ({
      ...column,
      position,
    }));

    startTransition(async () => {
      await updateColumnSettings({
        boardId,
        columns: orderedColumns.map((column) => ({
          boardId,
          columnId: column.id,
          name: column.name,
          semanticType: column.semanticType,
          countsAsCompleted: column.countsAsCompleted,
          cardColor: column.cardColor,
          cardOpacity: Number(column.cardOpacity),
          wipLimit: Number(column.wipLimit),
        })),
      });
      setDraftColumns(orderedColumns);
      onSaved(orderedColumns);
    });
  }

  function moveColumn(columnId: string, direction: -1 | 1) {
    const index = draftColumns.findIndex((column) => column.id === columnId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draftColumns.length) {
      return;
    }

    const next = [...draftColumns];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setDraftColumns(next);
  }

  function addColumn() {
    startTransition(async () => {
      const createdColumn = await createColumn({
        boardId,
        name: newColumn.name,
        semanticType: newColumn.semanticType,
        countsAsCompleted: newColumn.countsAsCompleted,
        cardColor: newColumn.cardColor,
        cardOpacity: Number(newColumn.cardOpacity),
        wipLimit: Number(newColumn.wipLimit),
      });
      setNewColumn({
        name: "",
        semanticType: "CUSTOM",
        countsAsCompleted: false,
        cardColor: "#ffffff",
        cardOpacity: 0.03,
        wipLimit: 100,
      });
      const nextColumns = [
        ...draftColumns,
        {
          ...createdColumn,
          semanticType: createdColumn.semanticType as KanbanSemantic,
          tasks: [],
        },
      ];
      setDraftColumns(nextColumns);
      onSaved(nextColumns);
    });
  }

  function removeColumn(column: BoardColumn) {
    const message =
      column.tasks.length > 0
        ? `Deleting "${column.name}" will archive ${column.tasks.length} associated task(s).`
        : `Delete "${column.name}"?`;

    if (!window.confirm(message)) {
      return;
    }

    startTransition(async () => {
      await deleteColumn(column.id);
      const nextColumns = draftColumns.filter((item) => item.id !== column.id);
      setDraftColumns(nextColumns);
      onSaved(nextColumns);
    });
  }

  return (
    <ModalShell title="Column settings" onClose={onClose} wide>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="flex flex-wrap items-center justify-end gap-2 xl:col-span-2">
          <button
            type="button"
            onClick={saveColumns}
            aria-label="Save column settings"
            title="Save changes"
            disabled={isPending || draftColumns.some((column) => !column.name.trim())}
            className={`${primaryButtonClass} flex h-10 w-10 items-center justify-center p-0`}
          >
            <SaveIcon />
          </button>
        </div>

        {draftColumns.map((column, index) => (
          <section
            key={column.id}
            className="rounded-2xl border border-white/10 bg-white/[0.015] p-3"
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Name
                </span>
                <input
                  value={column.name}
                  onChange={(event) => updateDraft(column.id, { name: event.target.value })}
                  className="h-10 min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-zinc-50 outline-none transition focus:border-white/45"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Max items
                </span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={column.wipLimit}
                  onChange={(event) =>
                    updateDraft(column.id, { wipLimit: toMaxItems(event.target.value) })
                  }
                  className="h-10 min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-zinc-50 outline-none transition focus:border-white/45"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Color
                </span>
                <input
                  type="color"
                  value={column.cardColor}
                  onChange={(event) =>
                    updateDraft(column.id, { cardColor: event.target.value })
                  }
                  className="h-10 rounded-xl border border-white/10 bg-black/10 px-2"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Opacity {Math.round(column.cardOpacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="0.2"
                  step="0.01"
                  value={column.cardOpacity}
                  onChange={(event) =>
                    updateDraft(column.id, { cardOpacity: Number(event.target.value) })
                  }
                  className="accent-zinc-100"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={column.countsAsCompleted}
                  onChange={(event) =>
                    updateDraft(column.id, { countsAsCompleted: event.target.checked })
                  }
                  className="h-4 w-4 accent-zinc-100"
                />
                Completed
              </label>
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveColumn(column.id, -1)}
                  aria-label={`Move ${column.name} up`}
                  title="Move up"
                  disabled={index === 0 || isPending}
                  className={`${outlineButtonClass} flex h-8 w-8 items-center justify-center p-0 text-base`}
                >
                  <span className="h-0 w-0 border-x-[5px] border-b-[7px] border-x-transparent border-b-current" />
                </button>
                <button
                  type="button"
                  onClick={() => moveColumn(column.id, 1)}
                  aria-label={`Move ${column.name} down`}
                  title="Move down"
                  disabled={index === draftColumns.length - 1 || isPending}
                  className={`${outlineButtonClass} flex h-8 w-8 items-center justify-center p-0 text-base`}
                >
                  <span className="h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-current" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => removeColumn(column)}
                  aria-label={`Delete ${column.name}`}
                  title="Delete"
                  disabled={isPending || draftColumns.length <= 1}
                  className={`${dangerIconButtonClass} flex h-8 w-8 items-center justify-center p-0`}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-dashed border-white/14 bg-white/[0.01] p-3 xl:col-span-2">
          <h3 className="font-semibold text-zinc-50">New column</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_82px_auto_auto] sm:items-center">
            <input
              value={newColumn.name}
              onChange={(event) => setNewColumn({ ...newColumn, name: event.target.value })}
              placeholder="Name"
              className="h-10 min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 text-zinc-50 outline-none transition focus:border-white/45"
            />
            <input
              type="number"
              min="1"
              max="100"
              aria-label="New column max items"
              value={newColumn.wipLimit}
              onChange={(event) =>
                setNewColumn({
                  ...newColumn,
                  wipLimit: toMaxItems(event.target.value),
                })
              }
              className="h-10 min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 text-zinc-50 outline-none transition focus:border-white/45"
            />
            <input
              type="color"
              value={newColumn.cardColor}
              onChange={(event) =>
                setNewColumn({ ...newColumn, cardColor: event.target.value })
              }
              className="h-10 rounded-xl border border-white/10 bg-black/10 px-2"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={newColumn.countsAsCompleted}
                onChange={(event) =>
                  setNewColumn({
                    ...newColumn,
                    countsAsCompleted: event.target.checked,
                  })
                }
                className="h-4 w-4 accent-zinc-100"
              />
              Completed
            </label>
            <button
              type="button"
              onClick={addColumn}
              disabled={isPending || !newColumn.name.trim()}
              className={`${primaryButtonClass} h-10 px-4`}
            >
              Create
            </button>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}

function CategoriesModal({
  boardId,
  categories,
  onClose,
  onSaved,
}: {
  boardId: string;
  categories: BoardCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState(categories);
  const [newCategory, setNewCategory] = useState({ name: "", color: "#94a3b8" });
  const [isPending, startTransition] = useTransition();

  function saveCategory(category: BoardCategory) {
    startTransition(async () => {
      await updateCategory({
        boardId,
        categoryId: category.id,
        name: category.name,
        color: category.color,
      });
      onSaved();
    });
  }

  function addCategory() {
    startTransition(async () => {
      await createCategory({
        boardId,
        name: newCategory.name,
        color: newCategory.color,
      });
      setNewCategory({ name: "", color: "#94a3b8" });
      onSaved();
    });
  }

  return (
    <ModalShell title="Categories" onClose={onClose}>
      <div className="grid gap-3">
        {drafts.map((category) => (
          <div key={category.id} className="grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              value={category.name}
              onChange={(event) =>
                setDrafts((items) =>
                  items.map((item) =>
                    item.id === category.id ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
              className="min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-zinc-50 outline-none transition focus:border-white/45"
            />
            <input
              type="color"
              value={category.color}
              onChange={(event) =>
                setDrafts((items) =>
                  items.map((item) =>
                    item.id === category.id
                      ? { ...item, color: event.target.value }
                      : item,
                  ),
                )
              }
              className="h-10 rounded-xl border border-white/10 bg-black/10 px-2"
            />
            <button
              type="button"
              onClick={() => saveCategory(category)}
              disabled={isPending || !category.name.trim()}
              className={`${primaryButtonClass} rounded-xl px-3`}
            >
              Save
            </button>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t border-white/10 pt-3">
          <input
            value={newCategory.name}
            onChange={(event) =>
              setNewCategory({ ...newCategory, name: event.target.value })
            }
            placeholder="New category"
            className="min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-zinc-50 outline-none transition focus:border-white/45"
          />
          <input
            type="color"
            value={newCategory.color}
            onChange={(event) =>
              setNewCategory({ ...newCategory, color: event.target.value })
            }
            className="h-10 rounded-xl border border-white/10 bg-black/10 px-2"
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={isPending || !newCategory.name.trim()}
            className={`${primaryButtonClass} rounded-xl px-3`}
          >
            Create
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ArchivedModal({
  tasks,
  onClose,
  onSaved,
}: {
  tasks: BoardTask[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function restore(taskId: string) {
    startTransition(async () => {
      await restoreTask(taskId);
      onSaved();
    });
  }

  return (
    <ModalShell title="Archived tasks" onClose={onClose}>
      <div className="grid gap-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div
              key={task.id}
              className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.015] p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <h3 className="font-semibold text-zinc-50">{task.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Archived {task.archivedAt ? formatDateTime(task.archivedAt) : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restore(task.id)}
                disabled={isPending}
                className={`${primaryButtonClass} px-4 py-2`}
              >
                Restore
              </button>
            </div>
          ))
        ) : (
          <p className="text-zinc-300">No archived tasks.</p>
        )}
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/58 px-3 py-4 backdrop-blur-md md:px-5 md:py-6">
      <div
        className={`panel glass-scrollbar flex max-h-[calc(100vh-32px)] w-full flex-col rounded-[28px] ${
          wide ? "max-w-6xl" : "max-w-2xl"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 p-5">
          <h2 className="text-2xl font-semibold text-zinc-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={`${subtleButtonClass} h-9 px-3`}
          >
            Close
          </button>
        </header>
        <div className="glass-scrollbar min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-2xl border border-white/12 bg-zinc-950 px-3 text-zinc-50 outline-none transition focus:border-white/45"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function priorityLabel(priority: KanbanPriority) {
  const labels = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
  };

  return labels[priority];
}

function hexToRgba(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
