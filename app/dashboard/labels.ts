// Spanish labels for enum values (code stays English).
export const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  normal: "Normal",
  informative: "Informativo",
};

export const STATUS_LABEL: Record<string, string> = {
  ai_active: "Resuelto por IA / en curso",
  escalated: "Escalado",
  resolved: "Resuelto",
};

export const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  informative: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};
