package sk.bucala.filmy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/** Bounded UTF-8 settings I/O. The caller owns and closes the granted streams. */
final class SettingsFileIO {
    static final int MAX_BYTES = 256 * 1024;

    static byte[] encode(String content) throws IOException {
        if (content == null) throw new IOException("Chýbajú nastavenia.");
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IOException("Súbor nastavení je príliš veľký alebo prázdny.");
        return bytes;
    }

    static String read(InputStream input) throws IOException {
        if (input == null) throw new IOException("Súbor sa nepodarilo otvoriť.");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        while (true) {
            int count = input.read(chunk);
            if (count < 0) break;
            if (count == 0) {
                int next = input.read();
                if (next < 0) break;
                if (bytes.size() >= MAX_BYTES) throw new IOException("Súbor nastavení je príliš veľký.");
                bytes.write(next);
            } else {
                if (bytes.size() + count > MAX_BYTES) throw new IOException("Súbor nastavení je príliš veľký.");
                bytes.write(chunk, 0, count);
            }
        }
        if (bytes.size() == 0) throw new IOException("Súbor nastavení je prázdny.");
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
        } catch (java.nio.charset.CharacterCodingException error) {
            throw new IOException("Súbor nastavení nie je platné UTF-8.");
        }
    }

    static void write(OutputStream output, String content) throws IOException {
        byte[] bytes = encode(content);
        if (output == null) throw new IOException("Súbor sa nepodarilo otvoriť na zápis.");
        output.write(bytes);
        output.flush();
    }

    private SettingsFileIO() {}
}
