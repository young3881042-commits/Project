package com.platform.aiassitant;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import org.json.*;
import android.util.Base64;

final class LocalWorkspaceDocuments {
    private final OrbitWorkspaceFiles files;
    LocalWorkspaceDocuments(File root) throws Exception { files = new OrbitWorkspaceFiles(root); }
    JSONObject call(String tool, JSONObject args) throws Exception {
        synchronized (OrbitWorkspaceFiles.LOCK) { return perform(tool, args); }
    }
    private JSONObject perform(String tool, JSONObject args) throws Exception {
        String path = args.optString("path", ""); File file = files.resolve(path);
        if (tool.equals("list_files")) {
            int offset = args.optInt("offset", 0); if (offset < 0) throw new IOException("목록 위치를 확인해주세요.");
            File[] entries = file.listFiles(); if (entries == null) throw new IOException("폴더를 찾지 못했어요.");
            Arrays.sort(entries); JSONArray rows = new JSONArray();
            for (int i = offset; i < Math.min(entries.length, (long)offset + 200); i++) {
                File entry = entries[i]; if (Files.isSymbolicLink(entry.toPath()) || entry.getName().startsWith(".orbit-write-")) continue;
                rows.put(new JSONObject().put("name", entry.getName()).put("directory", entry.isDirectory()).put("size", entry.length()));
            }
            return new JSONObject().put("entries", rows).put("nextOffset", (long)offset + 200 < entries.length ? offset + 200 : JSONObject.NULL);
        }
        if (tool.equals("read_file")) {
            long offset = args.optLong("offset", 0); int length = args.optInt("length", 16000);
            if (!file.isFile() || offset < 0 || length < 1 || length > 65536) throw new IOException("파일과 읽기 범위를 확인해주세요.");
            byte[] data; boolean more;
            try (RandomAccessFile input = new RandomAccessFile(file, "r")) {
                input.seek(Math.min(offset, input.length())); data = new byte[(int)Math.min(length, input.length() - input.getFilePointer())]; input.readFully(data); more = input.getFilePointer() < input.length();
            }
            String encoding = args.optString("encoding", "utf8");
            if (!encoding.equals("utf8") && !encoding.equals("base64")) throw new IOException("인코딩을 확인해주세요.");
            return new JSONObject().put("content", encoding.equals("base64") ? Base64.encodeToString(data, Base64.NO_WRAP) : new String(data, StandardCharsets.UTF_8))
                .put("bytes", data.length).put("offset", offset).put("nextOffset", more ? offset + data.length : JSONObject.NULL)
                .put("sha256", file.length() <= 4194304 ? OrbitWorkspaceFiles.hash(files.read(path, 4194304)) : JSONObject.NULL);
        }
        if (path.isEmpty()) throw new IOException("기본 작업공간은 변경할 수 없어요.");
        if (tool.equals("create_directory")) { if (!file.mkdir()) throw new IOException("폴더를 만들지 못했어요. 같은 이름이 있는지 확인해주세요."); return new JSONObject().put("created", true); }
        if (tool.equals("delete_entry")) { if (!file.delete()) throw new IOException("파일 또는 빈 폴더만 삭제할 수 있어요."); return new JSONObject().put("deleted", true); }
        if (!tool.equals("write_file")) throw new IOException("지원하지 않는 파일 작업이에요.");
        String content = args.getString("content"), encoding = args.optString("encoding", "utf8");
        if (content.length() > 1500000 || (!encoding.equals("utf8") && !encoding.equals("base64"))) throw new IOException("파일 크기와 인코딩을 확인해주세요.");
        byte[] bytes = encoding.equals("base64") ? Base64.decode(content, Base64.NO_WRAP) : content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 1048576) throw new IOException("AI 파일 수정은 1MB까지 지원해요.");
        if (file.exists() && !OrbitWorkspaceFiles.hash(files.read(path, 1048576)).equals(args.optString("expectedSha256", ""))) throw new IOException("파일이 변경됐어요. 먼저 다시 읽어주세요.");
        files.write(path, bytes);
        return new JSONObject().put("written", true).put("bytes", bytes.length).put("sha256", OrbitWorkspaceFiles.hash(bytes));
    }
}
