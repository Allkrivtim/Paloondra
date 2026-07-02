import { useState } from 'react';
import { runRconCommand } from '../../api/rcon';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import Spinner from '../common/Spinner';

export default function Broadcast() {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      await runRconCommand(`say ${text}`);
      toast.success('Broadcast sent');
      setMessage('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send broadcast'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-panel-border bg-panel-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-panel-text">Broadcast</h2>
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message to send to all players..."
          className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-panel-accent2 px-4 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {sending && <Spinner className="h-3.5 w-3.5 text-black" />}
          Send
        </button>
      </div>
    </form>
  );
}
