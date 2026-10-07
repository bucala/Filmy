package sk.bucala.filmy;

import java.util.regex.Pattern;

/** Portable file names and relative paths shared by the native copy boundary. */
final class CopyPolicy {
    private static final Pattern VIDEO = Pattern.compile(
            ".*\\.(mkv|mp4|avi|m4v|mov|wmv|ts|webm|mpg|mpeg|m2ts|vob|iso)$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern RESERVED = Pattern.compile(
            "^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\\..*)?$", Pattern.CASE_INSENSITIVE);

    private CopyPolicy() {}

    static boolean validName(String name) {
        if (name == null || name.isEmpty() || name.length() > 240 ||
                name.endsWith(".") || name.endsWith(" ") ||
                RESERVED.matcher(name).matches() || !VIDEO.matcher(name).matches()) return false;
        for (char ch : name.toCharArray()) {
            if (ch < 32 || "\\/:*?\"<>|".indexOf(ch) >= 0) return false;
        }
        return true;
    }

    static boolean validCandidate(String path) {
        if (path == null || path.isEmpty() || path.length() > 4096) return false;
        for (String part : path.split("/", -1)) {
            if (part.isEmpty() || part.equals(".") || part.equals("..")) return false;
            for (char ch : part.toCharArray()) {
                if (ch < 32 || ch == '\\' || ch == ':') return false;
            }
        }
        return true;
    }
}
