package sk.bucala.filmy;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class YouTubeTarget {
    static String url(String videoId, String query) {
        if (videoId != null && !videoId.isEmpty()) {
            if (!videoId.matches("[A-Za-z0-9_-]{11}")) throw new IllegalArgumentException("Neplatné YouTube video.");
            return "https://www.youtube.com/watch?v=" + videoId;
        }
        if (query == null || query.trim().isEmpty() || query.length() > 300) {
            throw new IllegalArgumentException("Neplatné vyhľadávanie traileru.");
        }
        try {
            return "https://www.youtube.com/results?search_query=" +
                    URLEncoder.encode(query.trim(), StandardCharsets.UTF_8.name()).replace("+", "%20");
        } catch (java.io.UnsupportedEncodingException impossible) {
            throw new IllegalStateException("UTF-8 nie je dostupné.", impossible);
        }
    }

    private YouTubeTarget() {}
}
