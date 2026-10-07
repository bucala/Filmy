package sk.bucala.filmy;

import org.junit.Test;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.*;

public class CopyResourcesTest {
    @Test
    public void closesAnActiveStreamToReleaseABlockedRead() throws Exception {
        CopyResources resources = new CopyResources();
        CountDownLatch reading = new CountDownLatch(1), closed = new CountDownLatch(1), finished = new CountDownLatch(1);
        InputStream stream = resources.track(new InputStream() {
            @Override public int read() throws IOException {
                reading.countDown();
                try {
                    if (!closed.await(2, TimeUnit.SECONDS)) throw new IOException("Read remained blocked");
                } catch (InterruptedException error) { throw new IOException(error); }
                throw new IOException("Closed");
            }
            @Override public void close() { closed.countDown(); }
        });
        Thread reader = new Thread(() -> {
            try { stream.read(); }
            catch (IOException expected) { /* Closing the stream interrupts its I/O. */ }
            finally { finished.countDown(); }
        });
        reader.start();
        try {
            assertTrue(reading.await(1, TimeUnit.SECONDS));
            Runnable closeStreams = resources.cancel();
            assertEquals(1, closed.getCount()); // Cancellation itself does not perform provider I/O.
            closeStreams.run();
            assertTrue(finished.await(1, TimeUnit.SECONDS));
        } finally { stream.close(); reader.join(2000); }
    }

    @Test
    public void closesAndRejectsAResourceOpenedAfterCancellation() throws Exception {
        CopyResources resources = new CopyResources();
        resources.cancel();
        AtomicInteger closes = new AtomicInteger();
        try {
            resources.track((Closeable) closes::incrementAndGet);
            fail("Cancelled transfer accepted a new resource");
        } catch (IOException expected) { assertEquals("Zastavené.", expected.getMessage()); }
        assertEquals(1, closes.get());
    }

    @Test
    public void closesAnActiveStreamToReleaseABlockedWrite() throws Exception {
        CopyResources resources = new CopyResources();
        CountDownLatch writing = new CountDownLatch(1), closed = new CountDownLatch(1), finished = new CountDownLatch(1);
        OutputStream stream = resources.track(new OutputStream() {
            @Override public void write(int value) throws IOException {
                writing.countDown();
                try {
                    if (!closed.await(2, TimeUnit.SECONDS)) throw new IOException("Write remained blocked");
                } catch (InterruptedException error) { throw new IOException(error); }
                throw new IOException("Closed");
            }
            @Override public void close() { closed.countDown(); }
        });
        Thread writer = new Thread(() -> {
            try { stream.write(42); }
            catch (IOException expected) { /* Closing the stream interrupts its I/O. */ }
            finally { finished.countDown(); }
        });
        writer.start();
        try {
            assertTrue(writing.await(1, TimeUnit.SECONDS));
            resources.cancel().run();
            assertTrue(finished.await(1, TimeUnit.SECONDS));
        } finally { stream.close(); writer.join(2000); }
    }

    @Test
    public void doesNotCloseReleasedResourcesAndContinuesAfterACloseFailure() throws Exception {
        CopyResources resources = new CopyResources();
        AtomicInteger closes = new AtomicInteger(), releasedCloses = new AtomicInteger();
        Closeable released = resources.track((Closeable) releasedCloses::incrementAndGet);
        resources.release(released);
        resources.track((Closeable) () -> { throw new IOException("Provider refused close"); });
        resources.track((Closeable) closes::incrementAndGet);
        resources.cancel().run();
        resources.cancel().run();
        assertEquals(1, closes.get());
        assertEquals(0, releasedCloses.get());
    }
}
