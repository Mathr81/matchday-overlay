import type { Ack, Command, CommandBody, Cue, Role, ServerMessage, Snapshot } from '../shared/types';

export interface Connection {
  send(body: CommandBody): Promise<Ack>;
  close(): void;
}

interface Handlers {
  /** `offset` = heure du serveur moins heure locale, à ajouter à Date.now() pour le chrono. */
  onSnapshot(snapshot: Snapshot, offset: number): void;
  onCue?(cue: Cue): void;
  onStatus?(online: boolean): void;
}

// crypto.randomUUID n'existe pas en http sur le réseau local (contexte non sécurisé).
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** WebSocket qui se reconnecte seul et renvoie les commandes restées sans réponse. */
export function connect(role: Role, handlers: Handlers): Connection {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=${role}`;
  const pending = new Map<string, { command: Command; resolve: (ack: Ack) => void }>();
  let ws: WebSocket | null = null;
  let closed = false;
  let delay = 500;

  const transmit = (command: Command) => ws?.send(JSON.stringify({ type: 'command', command }));

  function open() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      delay = 500;
      handlers.onStatus?.(true);
      for (const p of pending.values()) transmit(p.command);
    };
    ws.onmessage = (ev) => {
      const message: ServerMessage = JSON.parse(ev.data);
      if (message.type === 'snapshot') {
        handlers.onSnapshot(message, message.serverNow - Date.now());
      } else if (message.type === 'cue') {
        handlers.onCue?.(message.cue);
      } else {
        pending.get(message.cid)?.resolve(message);
        pending.delete(message.cid);
      }
    };
    ws.onclose = () => {
      handlers.onStatus?.(false);
      if (closed) return;
      setTimeout(open, delay);
      delay = Math.min(delay * 2, 5000);
    };
  }
  open();

  return {
    send(body) {
      const command = { ...body, cid: newId() } as Command;
      return new Promise((resolve) => {
        pending.set(command.cid, { command, resolve });
        if (ws?.readyState === WebSocket.OPEN) transmit(command);
      });
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}
