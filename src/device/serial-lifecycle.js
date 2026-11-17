// All owners of a port share one operation queue, including transport cleanup.
const ports = new WeakMap();
function state(port) {
  if (!ports.has(port)) ports.set(port, { tail: Promise.resolve(), stop: null });
  return ports.get(port);
}
export function withSerialPort(port, operation) {
  const entry = state(port);
  const result = entry.tail.then(operation);
  entry.tail = result.catch(() => {});
  return result;
}
export function isPortAlreadyClosed(error) {
  return error?.name === 'InvalidStateError' && /(?:port is |port.*already )closed|already closed/i.test(String(error.message));
}
export async function stopSerialSession(port) {
  await state(port).stop?.();
}
export function createSerialSession() {
  let current;
  let opening = Promise.resolve();
  return {
    connect(port, options, onData, onError) {
      const run = withSerialPort(port, async () => {
        await stopSerialSession(port);
        await port.open(options);
        const session = { port, reader: null, stopped: false, reading: null, writes: new Set() };
        current = session;
        let closing;
        state(port).stop = () => closing ||= (async () => {
          session.stopped = true;
          try { await session.reader?.cancel(); } catch (error) { onError(error); }
          await session.reading;
          await Promise.allSettled([...session.writes]);
          try { await port.close(); } catch (error) { if (!isPortAlreadyClosed(error)) throw error; }
          finally {
            if (current === session) current = null;
            state(port).stop = null;
          }
        })();
        session.reading = (async () => {
          try {
            while (!session.stopped && port.readable) {
              const reader = port.readable.getReader();
              session.reader = reader;
              try {
                while (!session.stopped) {
                  const { value, done } = await reader.read();
                  if (done) { session.stopped = true; break; }
                  if (value) onData(value);
                }
              } finally { reader.releaseLock(); session.reader = null; }
            }
          } catch (error) { if (!session.stopped) onError(error); }
        })();
      });
      opening = run.catch(() => {});
      return run;
    },
    async disconnect() {
      await opening;
      const session = current;
      if (session) await withSerialPort(session.port, () => stopSerialSession(session.port));
    },
    write(value) {
      const session = current;
      if (!session || session.stopped) return Promise.reject(new Error('Serial port is not connected'));
      const task = (async () => {
        const writer = session.port.writable.getWriter();
        try { await writer.write(value); } finally { writer.releaseLock(); }
      })();
      session.writes.add(task);
      task.then(() => session.writes.delete(task), () => session.writes.delete(task));
      return task;
    },
  };
}
