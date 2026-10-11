package sk.bucala.filmy;

import org.junit.Test;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class SettingsFileIOTest {
    @Test public void roundTripsUtf8WithoutTakingOwnershipOfStreams() throws Exception {
        String content = "{\"format\":\"filmy-settings\",\"settings\":{\"name\":\"Železný obor\"}}";
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        SettingsFileIO.write(bytes, content);
        assertEquals(content, SettingsFileIO.read(new ByteArrayInputStream(bytes.toByteArray())));
        assertArrayEquals(content.getBytes(StandardCharsets.UTF_8), bytes.toByteArray());
    }

    @Test public void rejectsOversizedFilesAndBoundsTheRead() throws Exception {
        assertEquals(SettingsFileIO.MAX_BYTES, SettingsFileIO.encode("a".repeat(SettingsFileIO.MAX_BYTES)).length);
        for (String invalid : new String[]{"", "a".repeat(SettingsFileIO.MAX_BYTES + 1),
                "á".repeat(SettingsFileIO.MAX_BYTES / 2 + 1)}) {
            try { SettingsFileIO.encode(invalid); fail("Oversized or empty content accepted"); }
            catch (IOException expected) { /* A picker must not open for invalid output. */ }
        }
        ByteArrayInputStream input = new ByteArrayInputStream(new byte[SettingsFileIO.MAX_BYTES * 2]);
        try { SettingsFileIO.read(input); fail("Oversized input accepted"); }
        catch (IOException expected) { assertTrue(input.available() >= SettingsFileIO.MAX_BYTES - 8192); }
    }

    @Test public void rejectsInvalidUtf8AndEmptyInput() throws Exception {
        for (byte[] invalid : new byte[][]{new byte[0], {(byte) 0xc3, 0x28}, {(byte) 0xff}}) {
            try { SettingsFileIO.read(new ByteArrayInputStream(invalid)); fail("Invalid UTF-8 accepted"); }
            catch (IOException expected) { /* Corrupt settings are never silently substituted. */ }
        }
    }

    @Test public void handlesShortAndZeroLengthReads() throws Exception {
        byte[] content = "Nastavenia".getBytes(StandardCharsets.UTF_8);
        InputStream input = new InputStream() {
            int position;
            boolean zero = true;
            @Override public int read() { return position == content.length ? -1 : content[position++]; }
            @Override public int read(byte[] data, int offset, int length) {
                if (zero) { zero = false; return 0; }
                zero = true;
                int value = read();
                if (value < 0) return -1;
                data[offset] = (byte) value; return 1;
            }
        };
        assertEquals("Nastavenia", SettingsFileIO.read(input));
    }

    @Test public void propagatesReadAndWriteFailuresInsteadOfReportingSuccess() throws Exception {
        try {
            SettingsFileIO.read(new InputStream() { @Override public int read() throws IOException { throw new IOException("Read denied"); } });
            fail("Read failure suppressed");
        } catch (IOException expected) { assertEquals("Read denied", expected.getMessage()); }
        try {
            SettingsFileIO.write(new OutputStream() { @Override public void write(int b) throws IOException { throw new IOException("Disk full"); } }, "{}");
            fail("Write failure suppressed");
        } catch (IOException expected) { assertEquals("Disk full", expected.getMessage()); }
    }
}
