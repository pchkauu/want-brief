import type { NavigateFunction } from 'react-router-dom'

export function taskSearch(id: string, search = window.location.search): string {
  const params = new URLSearchParams(search)
  params.set('task', id)
  return params.toString()
}

export function openTask(navigate: NavigateFunction, id: string) {
  navigate({ search: taskSearch(id) })
}

export function taskHref(id: string, search = window.location.search) {
  return { search: taskSearch(id, search) }
}
