package sk.bucala.filmy;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.DocumentsContract;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Foreground-only SAF transfer. No filesystem paths or broad storage grants. */
final class MovieCopier {
    private final ContentResolver resolver;
    private final Consumer<JSONObject> progress;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService cancellationWorker = Executors.newFixedThreadPool(2);
    private Uri source, destination;
    private String sourceName = "", destinationName = "";
    private volatile Job job;
    private volatile boolean cancelled;
    private volatile CancellationSignal signal = new CancellationSignal();
    private volatile CopyResources streams = new CopyResources();
    private CancellationSignal rootSignal;
    private boolean closed;
    private long lastProgress;

    private static final class Document {
        final Uri uri;
        final String name, mime;
        final long size, flags;
        Document(Uri uri, String name, String mime, long size, long flags) {
            this.uri = uri; this.name = name; this.mime = mime; this.size = size; this.flags = flags;
        }
        boolean directory() { return DocumentsContract.Document.MIME_TYPE_DIR.equals(mime); }
    }

    private static final class Children {
        final Map<String, Document> byName = new HashMap<>();
        final Set<String> ambiguous = new HashSet<>();
        void add(Document document) {
            if (byName.putIfAbsent(document.name, document) != null) ambiguous.add(document.name);
        }
        Document get(String name) throws IOException {
            if (ambiguous.contains(name)) throw new IOException("V zdroji je viac súborov s rovnakým názvom.");
            return byName.get(name);
        }
    }

    private static final class Item {
        final String id, title, name;
        final List<String> candidates;
        volatile String state = "pending", error = "";
        volatile long bytes;
        Document document;
        Item(JSONObject value) throws JSONException {
            id = value.getString("id");
            title = value.getString("title");
            name = value.optString("name", "");
            JSONArray paths = value.getJSONArray("candidates");
            if (title.length() > 300 || id.length() > 100 || paths.length() > 32) {
                throw new JSONException("Neplatný výber filmov.");
            }
            candidates = new ArrayList<>();
            for (int i = 0; i < paths.length(); i++) candidates.add(paths.getString(i));
        }
    }

    private static final class Job {
        final String id = UUID.randomUUID().toString();
        final long started = SystemClock.elapsedRealtime();
        final List<Item> items;
        volatile String phase = "scanning", target = "", current = "", error = "";
        volatile long totalBytes, transferredBytes;
        volatile long finished;
        volatile int copied, skipped, failed;
        Job(List<Item> items) { this.items = items; }
        boolean busy() { return phase.equals("scanning") || phase.equals("copying") || phase.equals("cancelling"); }
    }

    MovieCopier(ContentResolver resolver, Consumer<JSONObject> progress) {
        this.resolver = resolver; this.progress = progress;
    }

    synchronized boolean busy() { return job != null && job.busy(); }

    String setRoot(String role, Uri tree) throws IOException {
        if (!"source".equals(role) && !"destination".equals(role)) throw new IOException("Neplatný priečinok.");
        if (tree == null || !"content".equals(tree.getScheme()) || !DocumentsContract.isTreeUri(tree)) {
            throw new IOException("Vyber systémový priečinok.");
        }
        CancellationSignal query = new CancellationSignal();
        synchronized (this) {
            if (closed) throw new IOException("Appka bola zatvorená.");
            if (busy() || rootSignal != null) throw new IOException("Kopírovanie alebo výber priečinka už prebieha.");
            rootSignal = query;
        }
        try {
            Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            Document document = describe(root, query);
            if (!document.directory()) throw new IOException("Vyber priečinok, nie súbor.");
            if (role.equals("destination") &&
                    (document.flags & DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE) == 0) {
                throw new IOException("Do tohto priečinka sa nedá zapisovať.");
            }
            synchronized (this) {
                if (closed || query.isCanceled()) throw new IOException("Zastavené.");
                if (role.equals("source")) { source = root; sourceName = document.name; }
                else { destination = root; destinationName = document.name; }
            }
            return document.name;
        } finally {
            synchronized (this) { if (rootSignal == query) rootSignal = null; }
        }
    }

    JSONObject start(JSONArray values) throws IOException, JSONException {
        if (values == null || values.length() < 1 || values.length() > 2000) throw new IOException("Vyber 1 až 2000 filmov.");
        List<Item> items = new ArrayList<>();
        for (int i = 0; i < values.length(); i++) items.add(new Item(values.getJSONObject(i)));
        synchronized (this) {
            if (closed) throw new IOException("Appka bola zatvorená.");
            if (busy() || rootSignal != null) throw new IOException("Kopírovanie alebo výber priečinka už prebieha.");
            if (source == null || destination == null) throw new IOException("Vyber zdrojový aj cieľový priečinok.");
            cancelled = false; signal = new CancellationSignal(); streams = new CopyResources();
            job = new Job(items);
            Uri src = source, dest = destination;
            Job transfer = job;
            worker.execute(() -> run(transfer, src, dest));
        }
        return status();
    }

    JSONObject status() {
        Job current;
        String srcName, destName;
        synchronized (this) { current = job; srcName = sourceName; destName = destinationName; }
        JSONObject result = new JSONObject();
        try {
            result.put("source", srcName).put("destination", destName);
            if (current == null) return result.put("phase", "idle");
            result.put("jobId", current.id).put("phase", current.phase).put("target", current.target)
                    .put("current", current.current).put("error", current.error)
                    .put("totalBytes", current.totalBytes).put("transferredBytes", current.transferredBytes)
                    .put("copied", current.copied).put("skipped", current.skipped).put("failed", current.failed)
                    .put("elapsedMs", (current.finished > 0 ? current.finished : SystemClock.elapsedRealtime()) - current.started);
            JSONArray items = new JSONArray();
            for (Item item : current.items) {
                items.put(new JSONObject().put("id", item.id).put("title", item.title).put("name", item.name)
                        .put("bytes", item.bytes).put("state", item.state).put("error", item.error));
            }
            result.put("items", items);
        } catch (JSONException e) { throw new IllegalStateException(e); }
        return result;
    }

    synchronized void cancel() {
        if (closed) return;
        if (rootSignal != null) {
            CancellationSignal query = rootSignal;
            cancellationWorker.execute(query::cancel);
        }
        if (busy() && !cancelled) {
            cancelled = true; job.phase = "cancelling";
            CancellationSignal current = signal;
            Runnable closeStreams = streams.cancel();
            cancellationWorker.execute(current::cancel);
            cancellationWorker.execute(closeStreams);
        }
    }

    synchronized void close() {
        if (closed) return;
        cancel(); closed = true;
        worker.shutdown(); cancellationWorker.shutdown();
    }

    private void checkCancelled() throws IOException {
        if (cancelled || Thread.currentThread().isInterrupted()) throw new IOException("Zastavené.");
    }

    private void emit(boolean force) {
        long now = SystemClock.elapsedRealtime();
        if (force || now - lastProgress >= 100) { lastProgress = now; progress.accept(status()); }
    }

    private Document describe(Uri uri, CancellationSignal query) throws IOException {
        try (Cursor cursor = resolver.query(uri, new String[]{
                DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_FLAGS
        }, null, null, null, query)) {
            if (cursor == null || !cursor.moveToFirst()) throw new IOException("Priečinok alebo súbor nie je dostupný.");
            return new Document(uri, cursor.getString(0), cursor.getString(1),
                    cursor.isNull(2) ? -1 : cursor.getLong(2), cursor.getLong(3));
        }
    }

    private Children children(Uri parent, Map<Uri, Children> cache) throws IOException {
        if (cache.containsKey(parent)) return cache.get(parent);
        checkCancelled();
        Uri uri = DocumentsContract.buildChildDocumentsUriUsingTree(parent, DocumentsContract.getDocumentId(parent));
        Children index = new Children();
        int count = 0;
        try (Cursor cursor = resolver.query(uri, new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_FLAGS
        }, null, null, null, signal)) {
            if (cursor == null) throw new IOException("Priečinok sa nepodarilo načítať.");
            while (cursor.moveToNext()) {
                checkCancelled();
                if (++count > 100000) throw new IOException("Zvoľ menší zdrojový priečinok.");
                index.add(new Document(DocumentsContract.buildDocumentUriUsingTree(parent, cursor.getString(0)),
                        cursor.getString(1), cursor.getString(2), cursor.isNull(3) ? -1 : cursor.getLong(3), cursor.getLong(4)));
            }
        }
        cache.put(parent, index);
        return index;
    }

    private Document child(Uri parent, String name, Map<Uri, Children> cache) throws IOException {
        return children(parent, cache).get(name);
    }

    private Document resolve(Uri root, Item item, Map<Uri, Children> cache) throws IOException {
        for (String candidate : item.candidates) {
            if (!CopyPolicy.validCandidate(candidate) ||
                    !candidate.substring(candidate.lastIndexOf('/') + 1).equals(item.name)) continue;
            Document file = null;
            Uri parent = root;
            String[] parts = candidate.split("/");
            for (int i = 0; i < parts.length; i++) {
                file = child(parent, parts[i], cache);
                if (file == null || (i < parts.length - 1 && !file.directory())) { file = null; break; }
                parent = file.uri;
            }
            if (file != null && !file.directory()) return file;
        }
        throw new IOException("Súbor sa v zvolenom zdroji nenašiel.");
    }

    private ParcelFileDescriptor open(Uri uri, String mode) throws IOException {
        checkCancelled();
        ParcelFileDescriptor descriptor = resolver.openFileDescriptor(uri, mode, signal);
        if (descriptor == null) throw new IOException("Súbor sa nepodarilo otvoriť.");
        return streams.track(descriptor);
    }

    private void run(Job transfer, Uri src, Uri dest) {
        emit(true);
        try {
            Map<Uri, Children> cache = new HashMap<>();
            Set<String> names = new HashSet<>();
            for (Item item : transfer.items) {
                if (cancelled) break;
                try {
                    if (!CopyPolicy.validName(item.name) || names.contains(item.name.toLowerCase(Locale.ROOT))) {
                        item.state = "skipped"; item.error = "Neplatný alebo opakovaný názov."; transfer.skipped++; continue;
                    }
                    item.document = resolve(src, item, cache);
                    if ((item.document.flags & DocumentsContract.Document.FLAG_VIRTUAL_DOCUMENT) != 0) {
                        throw new IOException("Virtuálny dokument nemožno kopírovať ako filmový súbor.");
                    }
                    item.bytes = item.document.size;
                    if (item.bytes < 0) {
                        ParcelFileDescriptor opened = null;
                        try (ParcelFileDescriptor descriptor = opened = open(item.document.uri, "r")) {
                            item.bytes = descriptor.getStatSize();
                        } finally { streams.release(opened); }
                    }
                    if (item.bytes < 0) throw new IOException("Poskytovateľ neuvádza veľkosť súboru. Vyber lokálny zdroj.");
                    names.add(item.name.toLowerCase(Locale.ROOT));
                    item.state = "ready"; transfer.totalBytes += item.bytes;
                } catch (Exception e) {
                    item.state = cancelled ? "cancelled" : "error";
                    item.error = cancelled ? "Zastavené." : message(e);
                    if (!cancelled) transfer.failed++;
                }
                emit(false);
            }
            checkCancelled();
            if (transfer.items.stream().noneMatch(item -> item.state.equals("ready"))) return;
            transfer.target = "Filmy-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
            if (child(dest, transfer.target, new HashMap<>()) != null) throw new IOException("Cieľ už existuje.");
            Uri target = DocumentsContract.createDocument(resolver, dest, DocumentsContract.Document.MIME_TYPE_DIR, transfer.target);
            if (target == null) throw new IOException("Cieľový priečinok sa nepodarilo vytvoriť.");
            transfer.phase = "copying"; emit(true);
            byte[] buffer = new byte[1024 * 1024];
            for (Item item : transfer.items) {
                if (cancelled) break;
                if (!item.state.equals("ready")) continue;
                Uri created = null;
                try {
                    checkCancelled();
                    item.state = "copying"; transfer.current = item.name; emit(true);
                    if (child(target, item.name, new HashMap<>()) != null) throw new IOException("Cieľový súbor už existuje.");
                    created = DocumentsContract.createDocument(resolver, target,
                            item.document.mime == null ? "application/octet-stream" : item.document.mime, item.name);
                    if (created == null) throw new IOException("Cieľový súbor sa nepodarilo vytvoriť.");
                    ParcelFileDescriptor openedInput = null, openedOutput = null;
                    try (ParcelFileDescriptor inputDescriptor = openedInput = open(item.document.uri, "r");
                         ParcelFileDescriptor outputDescriptor = openedOutput = open(created, "w")) {
                        long size = inputDescriptor.getStatSize();
                        if (size >= 0 && size != item.bytes) throw new IOException("Zdroj sa počas prípravy zmenil.");
                        InputStream openedRead = null;
                        OutputStream openedWrite = null;
                        try (InputStream input = openedRead = streams.track(
                                new ParcelFileDescriptor.AutoCloseInputStream(inputDescriptor));
                             OutputStream output = openedWrite = streams.track(
                                     new ParcelFileDescriptor.AutoCloseOutputStream(outputDescriptor))) {
                            long count = 0;
                            while (count < item.bytes) {
                                checkCancelled();
                                int read = input.read(buffer, 0, (int) Math.min(buffer.length, item.bytes - count));
                                if (read < 0) throw new IOException("Zdroj bol neočakávane skrátený.");
                                if (read == 0) continue;
                                output.write(buffer, 0, read);
                                count += read; transfer.transferredBytes += read; emit(transfer.transferredBytes == read);
                            }
                            checkCancelled();
                            if (input.read() != -1) throw new IOException("Zdroj sa počas kopírovania zväčšil.");
                            checkCancelled(); output.flush();
                        } finally {
                            streams.release(openedRead); streams.release(openedWrite);
                        }
                    } finally {
                        streams.release(openedInput); streams.release(openedOutput);
                    }
                    item.state = "copied"; transfer.copied++;
                } catch (Exception e) {
                    item.state = cancelled ? "cancelled" : "error";
                    item.error = cancelled ? "Zastavené." : message(e);
                    if (!cancelled) transfer.failed++;
                    if (created != null) {
                        try {
                            if (!DocumentsContract.deleteDocument(resolver, created)) item.error += " Nedokončený súbor ostal v cieli.";
                        } catch (Exception cleanup) { item.error += " Nedokončený súbor sa nepodarilo odstrániť."; }
                    }
                }
                emit(true);
            }
        } catch (Exception e) {
            if (!cancelled) { transfer.error = message(e); transfer.failed++; }
        } finally {
            transfer.finished = SystemClock.elapsedRealtime();
            if (cancelled) for (Item item : transfer.items) {
                if (item.state.equals("ready") || item.state.equals("pending")) item.state = "cancelled";
            }
            transfer.current = ""; transfer.phase = cancelled ? "cancelled" : "done"; emit(true);
        }
    }

    private String message(Exception error) {
        if (error instanceof SecurityException) return "Prístup bol odmietnutý. Vyber priečinky znovu.";
        return error.getMessage() == null ? "Prenos sa nepodaril. Skontroluj disk a voľné miesto." : error.getMessage();
    }
}
