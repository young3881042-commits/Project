package com.platform.jupiter.files;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.config.AppProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

@Service
public class FileService {
    private static final String USER_WORKSPACE_DIR = "workspace";
    private static final String LOCALTRIP_PROFILE_DIR = "localtrip";
    private static final String LOCALTRIP_PREFERENCES_FILE = "preferences.json";
    private static final String LOCALTRIP_HISTORY_FILE = "history.jsonl";
    private static final long MAX_UPLOAD_BYTES = 5L * 1024L * 1024L;
    private static final long MAX_TEXT_READ_BYTES = 1024L * 1024L;
    private static final List<String> BLOCKED_EXACT_FILENAMES = List.of(
            ".env",
            ".env.local",
            ".env.production",
            "id_rsa",
            "id_dsa",
            "id_ecdsa",
            "id_ed25519",
            "authorized_keys",
            "known_hosts",
            "credentials",
            "credentials.json",
            "service-account.json");
    private static final List<String> BLOCKED_FILENAME_TOKENS = List.of(
            "secret",
            "private_key",
            "apikey",
            "api_key",
            "access_token",
            "refresh_token",
            "client_secret");
    private static final String DEFAULT_TEST_PY = """
            from pathlib import Path
            from datetime import datetime


            def main():
                output = Path("sample_output.txt")
                output.write_text(
                    "Python sample executed successfully.\\n"
                    f"Created at: {datetime.now().isoformat(timespec='seconds')}\\n",
                    encoding="utf-8",
                )
                print(f"created {output.resolve()}")


            if __name__ == "__main__":
                main()
            """;
    private static final String DEFAULT_LOCALTRIP_PREFERENCES = """
            {
              "version": 1,
              "preferredRegions": [],
              "preferredSectors": [],
              "persona": "custom",
              "pace": "normal",
              "budgetLevel": "NORMAL",
              "transportType": "PUBLIC_TRANSPORT",
              "avoidTags": [],
              "likedTags": [],
              "memo": ""
            }
            """;
    private static final String DEFAULT_STARTER_FILE = "main.py";

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    public FileService(AppProperties appProperties, ObjectMapper objectMapper) {
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
    }

    public FileTreeResponse browseWorkspace(String relativePath) {
        return browse(resolvePath(Path.of(appProperties.workspaceRoot()), relativePath), Path.of(appProperties.workspaceRoot()), relativePath);
    }

    public FileTreeResponse browseWorkspace(String relativePath, String username, boolean admin) {
        Path root = workspaceRoot(username, admin);
        ensureWorkspaceRoot(root, admin ? null : username);
        return browse(resolvePath(root, relativePath), root, relativePath);
    }

    public Resource readWorkspaceFile(String relativePath) {
        rejectSensitivePath(relativePath);
        return openFile(resolvePath(Path.of(appProperties.workspaceRoot()), relativePath));
    }

    public Resource readWorkspaceFile(String relativePath, String username, boolean admin) {
        if (!admin) {
            rejectSensitivePath(relativePath);
        }
        Path root = workspaceRoot(username, admin);
        ensureWorkspaceRoot(root, admin ? null : username);
        Path file = resolvePath(root, relativePath);
        rejectOversizedTextRead(file);
        return openFile(file);
    }

    public void writeWorkspaceFile(String relativePath, String content) {
        rejectSensitivePath(relativePath);
        Path file = resolvePath(Path.of(appProperties.workspaceRoot()), relativePath);
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(
                    file,
                    content,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to write file", e);
        }
    }

    public void writeWorkspaceFile(String relativePath, String content, String username, boolean admin) {
        if (!admin) {
            rejectSensitivePath(relativePath);
        }
        Path file = resolvePath(workspaceRoot(username, admin), relativePath);
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(
                    file,
                    content,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to write file", e);
        }
    }

    public void ensureUserWorkspace(String username) {
        ensureWorkspaceRoot(workspaceRoot(username, false), username);
    }

    public Path workspaceRootPath(String username, boolean admin) {
        Path root = workspaceRoot(username, admin);
        ensureWorkspaceRoot(root, admin ? null : username);
        return root;
    }

    public Path workspaceHomePath(String username, boolean admin) {
        Path root = workspaceHomeRoot(username, admin);
        ensureWorkspaceHome(root, admin ? null : username);
        return root;
    }

    public Path resolveWorkspacePath(String relativePath, String username, boolean admin) {
        Path root = workspaceRoot(username, admin);
        ensureWorkspaceRoot(root, admin ? null : username);
        return resolvePath(root, relativePath);
    }

    public void createDirectory(String relativePath, String username, boolean admin) {
        Path directory = resolvePath(workspaceRoot(username, admin), relativePath);
        try {
            Files.createDirectories(directory);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to create directory", e);
        }
    }

    public String renameWorkspaceItem(String relativePath, String newName, String username, boolean admin) {
        Path root = workspaceRoot(username, admin);
        Path source = resolvePath(root, relativePath);
        if (!Files.exists(source)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Path not found");
        }
        if (newName == null || newName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New name is required");
        }
        if (newName.contains("/") || newName.contains("\\") || ".".equals(newName) || "..".equals(newName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid target name");
        }

        Path sourceRoot = root.normalize();
        if (source.equals(sourceRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workspace root cannot be renamed");
        }

        Path parent = source.getParent();
        if (parent == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid path");
        }
        Path target = parent.resolve(newName).normalize();
        if (!target.startsWith(sourceRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid target path");
        }
        if (Files.exists(target)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Target already exists");
        }

        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException atomicMoveError) {
            try {
                Files.move(source, target);
            } catch (IOException moveError) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to rename item", moveError);
            }
        }
        return root.relativize(target).toString();
    }

    public void deleteWorkspaceItem(String relativePath, String username, boolean admin) {
        Path target = resolvePath(workspaceRoot(username, admin), relativePath);
        if (!Files.exists(target)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Path not found");
        }
        try {
            if (Files.isDirectory(target)) {
                try (Stream<Path> stream = Files.walk(target)) {
                    stream.sorted(Comparator.reverseOrder()).forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    });
                }
            } else {
                Files.deleteIfExists(target);
            }
        } catch (RuntimeException | IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to delete item", e);
        }
    }

    public void uploadWorkspaceFile(String relativeDirectory, MultipartFile file, String username, boolean admin) {
        Path directory = resolvePath(workspaceRoot(username, admin), relativeDirectory == null ? "" : relativeDirectory);
        try {
            Files.createDirectories(directory);
            String filename = Path.of(file.getOriginalFilename() == null ? "upload.bin" : file.getOriginalFilename())
                    .getFileName()
                    .toString();
            if (file.getSize() > MAX_UPLOAD_BYTES) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "업로드 파일은 5MB 이하만 허용됩니다.");
            }
            if (!admin) {
                rejectSensitivePath(filename);
            }
            Path destination = directory.resolve(filename).normalize();
            if (!destination.startsWith(directory.normalize())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload path");
            }
            try (InputStream stream = file.getInputStream()) {
                Files.copy(stream, destination, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to upload file", e);
        }
    }

    public List<SnapshotDto> listSnapshots() {
        Path root = Path.of(appProperties.snapshotRoot());
        if (!Files.exists(root)) {
            return List.of();
        }
        try (Stream<Path> stream = Files.list(root)) {
            return stream.filter(Files::isDirectory)
                    .sorted(Comparator.comparing(this::lastModified).reversed())
                    .map(this::toSnapshot)
                    .toList();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read snapshot directory", e);
        }
    }

    public Resource readSnapshotFile(String tag, String relativePath) {
        return openFile(resolvePath(Path.of(appProperties.snapshotRoot(), tag), relativePath));
    }

    private FileTreeResponse browse(Path current, Path root, String relativePath) {
        if (!Files.exists(current)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Path not found");
        }
        if (!Files.isDirectory(current)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Path is not a directory");
        }
        try (Stream<Path> stream = Files.list(current)) {
            List<FileTreeEntry> entries = stream
                    .sorted(Comparator
                            .comparing((Path path) -> Files.isDirectory(path) ? 0 : 1)
                            .thenComparing(path -> path.getFileName().toString().toLowerCase()))
                    .map(path -> new FileTreeEntry(
                            path.getFileName().toString(),
                            root.relativize(path).toString(),
                            Files.isDirectory(path) ? "dir" : "file",
                            fileSize(path)))
                    .toList();

            String currentPath = relativePath == null ? "" : relativePath;
            String parentPath = "";
            if (!currentPath.isBlank()) {
                Path parent = Path.of(currentPath).getParent();
                parentPath = parent == null ? "" : parent.toString();
            }
            return new FileTreeResponse(currentPath, parentPath, entries);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to list directory", e);
        }
    }

    private SnapshotDto toSnapshot(Path directory) {
        Path metadataPath = directory.resolve("metadata.json");
        if (!Files.exists(metadataPath)) {
            return new SnapshotDto(
                    directory.getFileName().toString(),
                    "",
                    "",
                    "",
                    "",
                    List.of(),
                    Instant.ofEpochMilli(lastModified(directory)));
        }
        try {
            JsonNode node = objectMapper.readTree(Files.readString(metadataPath));
            List<String> files = objectMapper.convertValue(
                    node.path("workspace_files"),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            return new SnapshotDto(
                    directory.getFileName().toString(),
                    node.path("image").asText(),
                    node.path("base_image").asText(),
                    node.path("pip_packages").asText(),
                    node.path("note").asText(),
                    files,
                    Instant.ofEpochSecond(node.path("created_at_epoch").asLong(lastModified(directory) / 1000)));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read snapshot metadata", e);
        }
    }

    private Resource openFile(Path file) {
        if (!Files.exists(file) || Files.isDirectory(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
        return new FileSystemResource(file);
    }

    private void rejectOversizedTextRead(Path file) {
        try {
            if (Files.isRegularFile(file) && Files.size(file) > MAX_TEXT_READ_BYTES) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "파일이 너무 커서 미리보기로 열 수 없습니다. 다운로드 또는 파일 크기를 줄여주세요.");
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 크기를 확인할 수 없습니다.", e);
        }
    }

    private void rejectSensitivePath(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return;
        }
        for (String part : relativePath.replace('\\', '/').split("/")) {
            String filename = part.trim().toLowerCase(Locale.ROOT);
            if (filename.isBlank()) {
                continue;
            }
            if (BLOCKED_EXACT_FILENAMES.contains(filename) || filename.endsWith(".pem") || filename.endsWith(".key") || filename.endsWith(".p12") || filename.endsWith(".pfx")) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "민감 파일명은 워크스페이스에서 열거나 업로드할 수 없습니다.");
            }
            for (String token : BLOCKED_FILENAME_TOKENS) {
                if (filename.contains(token)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "민감 정보가 포함된 파일명은 허용되지 않습니다.");
                }
            }
        }
    }

    private Path workspaceRoot(String username, boolean admin) {
        Path home = workspaceHomeRoot(username, admin);
        if (admin) {
            return home;
        }
        return home.resolve(USER_WORKSPACE_DIR).normalize();
    }

    private Path workspaceHomeRoot(String username, boolean admin) {
        Path root = Path.of(appProperties.workspaceRoot());
        if (admin) {
            return root;
        }
        return root.resolve("users").resolve(username).normalize();
    }

    private void ensureWorkspaceRoot(Path root, String username) {
        try {
            Files.createDirectories(root);
            if (username != null && !username.isBlank()) {
                Path testFile = root.resolve(DEFAULT_STARTER_FILE);
                if (!Files.exists(testFile)) {
                    Files.writeString(
                            testFile,
                            DEFAULT_TEST_PY,
                            StandardOpenOption.CREATE_NEW,
                            StandardOpenOption.WRITE);
                }
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to prepare workspace", e);
        }
    }

    private void ensureWorkspaceHome(Path root, String username) {
        try {
            Files.createDirectories(root);
            if (username != null && !username.isBlank()) {
                Files.createDirectories(root.resolve(USER_WORKSPACE_DIR));
                Path localTripDir = root.resolve(LOCALTRIP_PROFILE_DIR);
                Files.createDirectories(localTripDir);
                Path preferencesFile = localTripDir.resolve(LOCALTRIP_PREFERENCES_FILE);
                if (!Files.exists(preferencesFile)) {
                    Files.writeString(
                            preferencesFile,
                            DEFAULT_LOCALTRIP_PREFERENCES,
                            StandardOpenOption.CREATE_NEW,
                            StandardOpenOption.WRITE);
                }
                Path historyFile = localTripDir.resolve(LOCALTRIP_HISTORY_FILE);
                if (!Files.exists(historyFile)) {
                    Files.writeString(
                            historyFile,
                            "",
                            StandardOpenOption.CREATE_NEW,
                            StandardOpenOption.WRITE);
                }
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to prepare workspace home", e);
        }
    }

    private Path resolvePath(Path root, String relativePath) {
        Path resolved = root;
        if (relativePath != null && !relativePath.isBlank()) {
            resolved = root.resolve(relativePath).normalize();
        }
        if (!resolved.startsWith(root.normalize())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid path");
        }
        return resolved;
    }

    private long fileSize(Path path) {
        if (Files.isDirectory(path)) {
            return 0L;
        }
        try {
            return Files.size(path);
        } catch (IOException e) {
            return 0L;
        }
    }

    private long lastModified(Path path) {
        try {
            return Files.getLastModifiedTime(path).toMillis();
        } catch (IOException e) {
            return 0L;
        }
    }
}
