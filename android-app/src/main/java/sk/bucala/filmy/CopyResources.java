package sk.bucala.filmy;

import java.io.Closeable;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** A per-transfer registry, including resources opened concurrently with cancellation. */
final class CopyResources {
    private final Set<Closeable> open = new HashSet<>();
    private boolean cancelled;

    <T extends Closeable> T track(T resource) throws IOException {
        synchronized (this) {
            if (!cancelled) {
                open.add(resource);
                return resource;
            }
        }
        closeQuietly(resource);
        throw new IOException("Zastavené.");
    }

    synchronized void release(Closeable resource) { open.remove(resource); }

    // Mark cancellation synchronously, but let the caller close potentially
    // blocking provider streams on its cancellation executor, not the UI thread.
    synchronized Runnable cancel() {
        cancelled = true;
        List<Closeable> resources = new ArrayList<>(open);
        open.clear();
        return () -> resources.forEach(CopyResources::closeQuietly);
    }

    private static void closeQuietly(Closeable resource) {
        try { resource.close(); }
        catch (Exception ignored) { /* The transfer reports its error and attempts partial-file cleanup. */ }
    }
}
