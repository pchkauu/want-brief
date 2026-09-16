import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { TaskLogDialog } from './TaskLogDialog'

const TaskLogContext = createContext<(itemId: string) => void>(() => {})

export function useTaskLogPrompt() {
  return useContext(TaskLogContext)
}

export function TaskLogProvider({ children }: { children: ReactNode }) {
  const [itemId, setItemId] = useState<string | null>(null)
  const prompt = useCallback((id: string) => setItemId(id), [])
  return (
    <TaskLogContext.Provider value={prompt}>
      {children}
      <TaskLogDialog itemId={itemId} onClose={() => setItemId(null)} />
    </TaskLogContext.Provider>
  )
}
