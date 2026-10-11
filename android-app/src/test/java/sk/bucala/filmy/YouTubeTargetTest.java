package sk.bucala.filmy;

import org.junit.Test;
import static org.junit.Assert.*;

public class YouTubeTargetTest {
    @Test public void opensOnlyAValidatedVideoOnTheFixedYouTubeHost() {
        assertEquals("https://www.youtube.com/watch?v=dQw4w9WgXcQ", YouTubeTarget.url("dQw4w9WgXcQ", ""));
        for (String invalid : new String[]{"short", "javascript:", "https://evil.example", "../escape"}) {
            try { YouTubeTarget.url(invalid, "trailer"); fail("Invalid video accepted"); }
            catch (IllegalArgumentException expected) { /* Never passes an arbitrary URI to Android. */ }
        }
    }

    @Test public void encodesAQueryAndRejectsOversizedOrEmptySearches() {
        assertEquals("https://www.youtube.com/results?search_query=Film%20%26%20trailer", YouTubeTarget.url("", "Film & trailer"));
        for (String invalid : new String[]{"", " ", new String(new char[301]).replace('\0', 'A')}) {
            try { YouTubeTarget.url("", invalid); fail("Invalid query accepted"); }
            catch (IllegalArgumentException expected) { /* Bounded input. */ }
        }
    }
}
