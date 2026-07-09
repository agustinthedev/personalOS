export const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

export const semanticOptions = [
  { value: "TODO", label: "To do" },
  { value: "ACTIVE", label: "Active" },
  { value: "DONE", label: "Done" },
  { value: "CUSTOM", label: "Custom" },
] as const;

export type KanbanPriority = (typeof priorityOptions)[number]["value"];
export type KanbanSemantic = (typeof semanticOptions)[number]["value"];

export type BoardCategory = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
};

export type BoardChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
  position: number;
};

export type BoardComment = {
  id: string;
  body: string;
  createdAt: string;
};

export type BoardTask = {
  id: string;
  boardId: string;
  columnId: string | null;
  categoryId: string | null;
  title: string;
  description: string;
  priority: KanbanPriority;
  dueDate: string | null;
  position: number;
  archivedAt: string | null;
  columnChangedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: BoardCategory | null;
  checklistItems: BoardChecklistItem[];
  comments: BoardComment[];
};

export type BoardColumn = {
  id: string;
  name: string;
  position: number;
  semanticType: KanbanSemantic;
  countsAsCompleted: boolean;
  cardColor: string;
  cardOpacity: number;
  wipLimit: number;
  tasks: BoardTask[];
};

export type BoardPageData = {
  board: {
    id: string;
    name: string;
  };
  columns: BoardColumn[];
  categories: BoardCategory[];
  archivedTasks: BoardTask[];
  summary: {
    active: number;
    completed: number;
    archived: number;
  };
};
