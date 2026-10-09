import { useEffect, useState, useSyncExternalStore } from 'react'
import { IndexedDbWorkspaceRepository } from './workspaceRepository'
import { WorkspaceStore } from './workspaceStore'

export function useWorkspace() {
  const [store] = useState(() => new WorkspaceStore(new IndexedDbWorkspaceRepository()))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    Object.setPrototypeOf(store, WorkspaceStore.prototype)
    void store.refreshRepository(new IndexedDbWorkspaceRepository())
  }, [store])

  useEffect(() => {
    void store.load()
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!store.hasUnsavedChanges()) return
      void store.flush()
      event.preventDefault()
      event.returnValue = ''
    }
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void store.flush()
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', flushWhenHidden)
      void store.flush()
    }
  }, [store])

  return { ...snapshot, store }
}
