import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

const adjustmentKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

/** Hold autosave until a range gesture ends, including release outside the input. */
export function useAutosaveInteraction(begin: () => void, end: () => void) {
  const held = useRef(false)
  const start = () => {
    if (held.current) return
    held.current = true
    begin()
  }

  useEffect(() => {
    const finish = () => {
      if (!held.current) return
      held.current = false
      end()
    }
    const keyUp = (event: KeyboardEvent) => { if (adjustmentKeys.has(event.key)) finish() }
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', finish)
    // A tab switch or removed slider must not leave autosave suspended.
    window.addEventListener('focusout', finish)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', finish)
      window.removeEventListener('focusout', finish)
      finish()
    }
  }, [end])

  return {
    onPointerDown: start,
    onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => { if (adjustmentKeys.has(event.key)) start() },
  }
}
