import { useId, useState } from 'react'
import { MAX_HELP_MESSAGE, type Match } from '../lib/api'
import { FIELD } from '../lib/format'
import { Btn, Card, Pill, Sub } from './ui'

/**
 * "Ask an Admin" on a match room: a button that opens a short form and raises a Help request.
 * Shown when the server says the match is open or was completed in the last 90 days.
 * Once you've asked, it says so until an Admin closes the request.
 */
export default function AskAdmin({ match, onAsk }: { match: Match; onAsk: (message: string) => void }) {
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const errorId = useId()

  if (match.helpRequest)
    return (
      <Card role="region" aria-label="Help request">
        <Sub>help requested</Sub>
        <b className="text-sm">An Admin will look at this match.</b>
        <span className="whitespace-pre-wrap text-sm text-fg-dim">
          You wrote: <q>{match.helpRequest.message}</q>
        </span>
      </Card>
    )
  if (!match.canAskAdmin) return null
  if (!asking)
    return (
      <Pill className="self-start" onClick={() => setAsking(true)}>
        Ask an Admin
      </Pill>
    )
  return (
    <Card>
      <form
        aria-label="Ask an Admin"
        aria-describedby={error ? errorId : undefined}
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!message.trim()) return setError('Say what you need help with.')
          setError(null)
          onAsk(message.trim())
        }}
      >
        <label htmlFor={fieldId} className="text-xs text-muted">
          What do you need help with?
        </label>
        <textarea
          id={fieldId}
          value={message}
          maxLength={MAX_HELP_MESSAGE}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={error ? true : undefined}
          placeholder="For example: my opponent left and isn't answering"
          className={FIELD}
        />
        {error && (
          <span id={errorId} role="alert" className="text-xs text-chaos-soft">
            {error}
          </span>
        )}
        <div className="flex gap-2">
          <Btn type="submit">Send to the Admins</Btn>
          <Pill onClick={() => setAsking(false)}>Cancel</Pill>
        </div>
      </form>
    </Card>
  )
}
