package sk.bucala.filmy;

import org.junit.Test;
import static org.junit.Assert.*;

public class CopyPolicyTest {
    @Test
    public void permitsPortableVideoNames() {
        assertTrue(CopyPolicy.validName("1999 - Železný obor.mkv"));
        assertTrue(CopyPolicy.validName("Film.MP4"));
        assertTrue(CopyPolicy.validName("film.iso"));
    }

    @Test
    public void rejectsTraversalCommandsReservedNamesAndNonVideo() {
        for (String name : new String[]{"../Film.mkv", "W:\\Film.mkv", "movie.mkv:ads",
                "CON.mkv", "lpt1.mp4", "film.mkv ", "film.exe", "bad\n.mkv"}) {
            assertFalse(name, CopyPolicy.validName(name));
        }
    }

    @Test
    public void restrictsCandidateToSelectedTree() {
        assertTrue(CopyPolicy.validCandidate("Movies/1999 - Film.mkv"));
        assertFalse(CopyPolicy.validCandidate("../Film.mkv"));
        assertFalse(CopyPolicy.validCandidate("/Film.mkv"));
        assertFalse(CopyPolicy.validCandidate("Movies//Film.mkv"));
        assertFalse(CopyPolicy.validCandidate("W:/Movies/Film.mkv"));
        assertFalse(CopyPolicy.validCandidate("Movies\\Film.mkv"));
        assertFalse(CopyPolicy.validCandidate("Movies/./Film.mkv"));
    }
}
