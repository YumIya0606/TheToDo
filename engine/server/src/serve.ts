import { startServer } from "./index.js";

/**
 * Command-line entry point. Running this file starts TheToDo on a fixed port and
 * prints where it is; the desktop app instead calls startServer() directly so
 * it can choose an ephemeral port and own the lifecycle.
 */
void startServer().then((running) => {
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      void running.close().finally(() => process.exit(0));
    });
  }
});
