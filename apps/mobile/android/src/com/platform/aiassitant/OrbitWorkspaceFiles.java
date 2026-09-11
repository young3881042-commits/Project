package com.platform.aiassitant;

import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.Locale;

/** App-owned workspace only. Credentials and runtime files are siblings, never descendants. */
final class OrbitWorkspaceFiles {
    static final Object LOCK = new Object();
    final File root;
    OrbitWorkspaceFiles(File root) throws IOException {
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Orbit 작업공간을 만들지 못했어요.");
        if (Files.isSymbolicLink(root.toPath())) throw new IOException("작업공간 경로를 확인해주세요.");
        this.root = root.getCanonicalFile();
    }
    File resolve(String path) throws IOException {
        if (path == null || path.length() > 1024 || path.startsWith("/") || path.contains("\\") || path.matches(".*[\\p{Cntrl}].*")) throw new IOException("작업공간 안의 상대 경로를 사용해주세요.");
        File file = root;
        if (path.isEmpty()) return file;
        String[] parts = path.split("/", -1);
        if (parts.length > 40) throw new IOException("폴더 경로가 너무 깊어요.");
        for (String part : parts) {
            if (part.isEmpty() || part.equals(".") || part.equals("..") || part.length() > 255) throw new IOException("상위 폴더 경로는 사용할 수 없어요.");
            file = new File(file, part);
            if (Files.isSymbolicLink(file.toPath()) || !file.getCanonicalPath().startsWith(root.getPath() + File.separator)) throw new IOException("작업공간 밖에는 접근할 수 없어요.");
        }
        return file;
    }
    byte[] read(String path, int limit) throws Exception {
        File file = resolve(path);
        if (!file.isFile() || file.length() > limit) throw new IOException("파일이 없거나 읽기 한도를 넘었어요.");
        try (InputStream input = new FileInputStream(file); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192]; int count;
            while ((count = input.read(bytes)) != -1) { if (out.size() + count > limit) throw new IOException("파일이 너무 커요."); out.write(bytes, 0, count); }
            return out.toByteArray();
        }
    }
    void write(String path, byte[] bytes) throws Exception {
        File file = resolve(path);
        if (file.equals(root) || !file.getParentFile().isDirectory()) throw new IOException("저장할 폴더를 먼저 만들어주세요.");
        File temp = File.createTempFile(".orbit-write-", ".tmp", file.getParentFile());
        try {
            try (FileOutputStream out = new FileOutputStream(temp)) { out.write(bytes); out.getFD().sync(); }
            resolve(path);
            Files.move(temp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally { temp.delete(); }
    }
    static String hash(byte[] bytes) throws Exception {
        StringBuilder out = new StringBuilder(); for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) out.append(String.format(Locale.ROOT, "%02x", b & 255)); return out.toString();
    }
}
