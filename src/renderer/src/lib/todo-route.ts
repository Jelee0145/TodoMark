export function todoReminderPath(todoId: string): string {
  return `/todos?todoId=${encodeURIComponent(todoId)}`
}
