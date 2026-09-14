import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { Window } from '../../shared/Window'

export function NotesScreen() {
  const queryClient = useQueryClient()
  const notes = useQuery({ queryKey: ['notes'], queryFn: () => api.notes() })
  const [body, setBody] = useState('')
  const create = useMutation({
    mutationFn: () => api.createNote(body),
    onSuccess: () => {
      setBody('')
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
  const remove = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    create.mutate()
  }

  return (
    <Window title="Notes">
      <form className="stack" onSubmit={onSubmit}>
        <textarea
          rows={5}
          placeholder="Decision, agreement, or a loose thought"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            if (!body.trim()) return
            create.mutate()
          }}
        >
          Save note
        </button>
      </form>
      <ul className="list notes">
        {(notes.data ?? []).map((note) => (
          <li key={note.id}>
            <pre>{note.body}</pre>
            <button type="button" className="ghost" onClick={() => remove.mutate(note.id)}>
              Del
            </button>
          </li>
        ))}
      </ul>
    </Window>
  )
}
