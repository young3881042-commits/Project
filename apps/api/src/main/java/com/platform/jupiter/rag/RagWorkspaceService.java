package com.platform.jupiter.rag;

import com.platform.jupiter.files.FileService;
import com.platform.jupiter.files.FileTreeEntry;
import com.platform.jupiter.files.FileTreeResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.text.Normalizer;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RagWorkspaceService {
    private static final DateTimeFormatter FILE_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
            .withZone(ZoneId.of("Asia/Seoul"));
    private static final int MAX_WORKSPACE_FILE_CHARS = 6000;
    private static final int MAX_WORKSPACE_DIRECTORY_FILES = 3;
    private static final int MAX_IMPORT_FILES = 12;
    private static final Set<String> TEXT_FILE_EXTENSIONS = Set.of(
            "txt", "md", "csv", "json", "log", "yaml", "yml",
            "py", "java", "js", "jsx", "ts", "tsx",
            "sql", "properties", "sh", "xml", "html", "css");
    private static final Set<String> RAG_IMPORT_EXTENSIONS = Set.of(
            "txt", "md", "csv", "json", "log", "yaml", "yml");

    private final RagService ragService;
    private final FileService fileService;
    private final CodexRagService codexRagService;

    public RagWorkspaceService(RagService ragService, FileService fileService, CodexRagService codexRagService) {
        this.ragService = ragService;
        this.fileService = fileService;
        this.codexRagService = codexRagService;
    }

    public RagWorkspaceResponse answerAndSave(RagWorkspaceRequest request, String username, boolean admin) {
        RagService.RagRetrievalResult retrieval = ragService.retrieve(new RagQueryRequest(request.question(), request.topK()));
        WorkspaceContext workspaceContext = buildWorkspaceContext(request, username, admin);
        RagAnswerResponse response = generateAnswer(request.question(), request.topK(), retrieval, workspaceContext, username);
        String title = resolveTitle(request);
        String transcriptPath = resolveTranscriptPath(request, response.generatedAt());
        fileService.writeWorkspaceFile(transcriptPath, renderTranscript(response, title, transcriptPath), username, admin);
        return new RagWorkspaceResponse(
                response.question(),
                response.answer(),
                response.citations(),
                response.generatedAt(),
                transcriptPath,
                title);
    }

    public List<RagDocumentSummary> importWorkspaceSelection(RagWorkspaceImportRequest request, String username, boolean admin) {
        List<Path> files = resolveImportFiles(request, username, admin);
        if (files.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "가져올 수 있는 텍스트 파일이 없습니다.");
        }

        List<RagDocumentSummary> imported = new ArrayList<>();
        for (Path file : files) {
            String filename = file.getFileName() == null ? "document.txt" : file.getFileName().toString();
            imported.add(ragService.importWorkspaceFile(filename, file));
        }
        return imported;
    }

    private RagAnswerResponse generateAnswer(
            String question,
            Integer topK,
            RagService.RagRetrievalResult retrieval,
            WorkspaceContext workspaceContext,
            String username) {
        List<RagCitation> citations = mergeCitations(retrieval.citations(), workspaceContext.citations());
        try {
            String prompt = buildPrompt(question, retrieval.candidates(), workspaceContext);
            String answer = codexRagService.generate(prompt, username);
            if (answer.isBlank()) {
                throw new IllegalStateException("empty codex answer");
            }
            return new RagAnswerResponse(question, answer, citations, Instant.now());
        } catch (Exception exception) {
            String fallbackAnswer = synthesizeFallbackAnswer(question, retrieval.candidates(), workspaceContext);
            if (!fallbackAnswer.isBlank()) {
                return new RagAnswerResponse(
                        question,
                        fallbackAnswer,
                        citations,
                        Instant.now());
            }
            if (!workspaceContext.citations().isEmpty()) {
                return new RagAnswerResponse(
                        question,
                        "선택한 워크스페이스 파일이나 폴더 문맥은 잡혔지만 Codex 답변 생성에 실패했습니다. OpenAI API 키 설정을 확인하거나 잠시 후 다시 시도해 주세요.",
                        workspaceContext.citations(),
                        Instant.now());
            }
            return new RagAnswerResponse(
                    question,
                    "질문과 가까운 인덱스 문서나 현재 워크스페이스 문맥을 찾지 못했습니다. 다른 키워드로 다시 질문하거나 문서를 더 올려 주세요.",
                    citations,
                    Instant.now());
        }
    }

    private WorkspaceContext buildWorkspaceContext(RagWorkspaceRequest request, String username, boolean admin) {
        List<WorkspaceContextItem> items = new ArrayList<>();
        if (request.filePath() != null && !request.filePath().isBlank()) {
            WorkspaceContextItem selectedFile = loadWorkspaceFile(request.filePath().trim(), username, admin);
            if (selectedFile != null) {
                items.add(selectedFile);
                return new WorkspaceContext(items);
            }
        }

        if (request.directoryPath() == null || request.directoryPath().isBlank()) {
            return new WorkspaceContext(items);
        }

        FileTreeResponse tree = fileService.browseWorkspace(request.directoryPath().trim(), username, admin);
        List<FileTreeEntry> fileEntries = tree.entries().stream()
                .filter(entry -> "file".equals(entry.type()))
                .filter(entry -> isTextFile(entry.path()))
                .limit(MAX_WORKSPACE_DIRECTORY_FILES)
                .toList();

        for (FileTreeEntry entry : fileEntries) {
            WorkspaceContextItem item = loadWorkspaceFile(entry.path(), username, admin);
            if (item != null) {
                items.add(item);
            }
        }

        if (!items.isEmpty()) {
            return new WorkspaceContext(items);
        }

        StringBuilder listing = new StringBuilder();
        listing.append("Current folder path: ")
                .append(tree.currentPath() == null || tree.currentPath().isBlank() ? "/" : tree.currentPath())
                .append("\n");
        listing.append("Current folder entries:\n");
        List<FileTreeEntry> entries = tree.entries();
        if (entries.isEmpty()) {
            listing.append("(empty)\n");
        } else {
            for (int index = 0; index < Math.min(entries.size(), 30); index++) {
                FileTreeEntry entry = entries.get(index);
                listing.append("- ")
                        .append(entry.type())
                        .append(": ")
                        .append(entry.name())
                        .append(" [")
                        .append(entry.path())
                        .append("]");
                if ("file".equals(entry.type())) {
                    listing.append(" size=").append(entry.size());
                }
                listing.append("\n");
            }
        }
        String directorySummary = listing.toString().trim();
        items.add(new WorkspaceContextItem(
                request.directoryPath().trim(),
                directorySummary,
                abbreviate(directorySummary, 240)));
        return new WorkspaceContext(items);
    }

    private List<Path> resolveImportFiles(RagWorkspaceImportRequest request, String username, boolean admin) {
        if (request.filePath() != null && !request.filePath().isBlank()) {
            Path file = fileService.resolveWorkspacePath(request.filePath().trim(), username, admin);
            if (!Files.exists(file) || Files.isDirectory(file) || !isRagImportFile(file.getFileName().toString())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "선택한 파일은 RAG로 가져올 수 없습니다.");
            }
            return List.of(file);
        }

        if (request.directoryPath() == null || request.directoryPath().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "폴더 또는 파일 경로가 필요합니다.");
        }

        Path directory = fileService.resolveWorkspacePath(request.directoryPath().trim(), username, admin);
        if (!Files.exists(directory) || !Files.isDirectory(directory)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "선택한 폴더를 찾을 수 없습니다.");
        }

        try (var stream = Files.walk(directory, 2)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> isRagImportFile(path.getFileName().toString()))
                    .sorted(Comparator.naturalOrder())
                    .limit(MAX_IMPORT_FILES)
                    .toList();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "워크스페이스 파일을 가져오지 못했습니다.", exception);
        }
    }

    private WorkspaceContextItem loadWorkspaceFile(String relativePath, String username, boolean admin) {
        try {
            if (!isTextFile(relativePath)) {
                return null;
            }
            Path path = fileService.resolveWorkspacePath(relativePath, username, admin);
            if (!Files.exists(path) || Files.isDirectory(path)) {
                return null;
            }
            String content = normalizeWhitespace(Files.readString(path, StandardCharsets.UTF_8));
            if (content.isBlank()) {
                return null;
            }
            String clipped = abbreviate(content, MAX_WORKSPACE_FILE_CHARS);
            return new WorkspaceContextItem(
                    relativePath,
                    clipped,
                    abbreviate(clipped, 240));
        } catch (IOException exception) {
            return null;
        }
    }

    private String buildPrompt(String question, List<RagService.RagContextChunk> chunks, WorkspaceContext workspaceContext) {
        StringBuilder builder = new StringBuilder();
        builder.append("You are Codex acting as a RAG assistant for a Korean portfolio workspace.\n");
        builder.append("If the user asks what files or folders exist in the current path, answer from the current workspace selection directly and list them explicitly.\n");
        builder.append("Answer from the current workspace selection first when it is relevant.\n");
        builder.append("Then use indexed RAG context.\n");
        builder.append("If the available context is empty or insufficient, answer from general knowledge and explicitly say that the indexed docs or workspace selection did not fully cover it.\n");
        builder.append("Return a concise answer in Korean.\n\n");
        builder.append("Question:\n").append(question.trim()).append("\n\n");
        builder.append("Current workspace selection:\n");
        if (workspaceContext.items().isEmpty()) {
            builder.append("(no current workspace file or folder context was selected)\n\n");
        } else {
            for (int index = 0; index < workspaceContext.items().size(); index++) {
                WorkspaceContextItem item = workspaceContext.items().get(index);
                builder.append("[W").append(index + 1).append("] ")
                        .append(item.path())
                        .append("\n")
                        .append(item.content().trim())
                        .append("\n\n");
            }
        }
        builder.append("Indexed RAG context:\n");
        if (chunks.isEmpty()) {
            builder.append("(no relevant indexed documents were found)\n");
        } else {
            for (int index = 0; index < chunks.size(); index++) {
                RagService.RagContextChunk chunk = chunks.get(index);
                builder.append("[R").append(index + 1).append("] ")
                        .append(chunk.documentTitle())
                        .append(" (chunk ").append(chunk.chunkIndex()).append(", score ")
                        .append(chunk.score()).append(")\n")
                        .append(chunk.text().trim())
                        .append("\n\n");
            }
        }
        return builder.toString().trim();
    }

    private String synthesizeFallbackAnswer(
            String question,
            List<RagService.RagContextChunk> chunks,
            WorkspaceContext workspaceContext) {
        if (isDirectoryListingQuestion(question) && !workspaceContext.items().isEmpty()) {
            return synthesizeDirectoryListingAnswer(workspaceContext);
        }

        List<String> lines = new ArrayList<>();
        lines.add("현재 서버에서 Codex가 연결되지 않아 로컬 RAG 결과로 정리했습니다.");
        lines.add("질문: " + question.trim());

        if (!workspaceContext.items().isEmpty()) {
            lines.add("");
            lines.add("현재 선택 경로 기준");
            for (int index = 0; index < workspaceContext.items().size(); index++) {
                WorkspaceContextItem item = workspaceContext.items().get(index);
                lines.add((index + 1) + ". " + item.path() + ": " + abbreviate(item.content(), 220));
            }
        }

        if (!chunks.isEmpty()) {
            lines.add("");
            lines.add("관련 색인 문서 기준");
            for (int index = 0; index < Math.min(chunks.size(), 3); index++) {
                RagService.RagContextChunk chunk = chunks.get(index);
                lines.add((index + 1) + ". " + chunk.documentTitle() + ": " + abbreviate(chunk.text(), 220));
            }
        }

        if (workspaceContext.items().isEmpty() && chunks.isEmpty()) {
            return "";
        }

        lines.add("");
        lines.add("상세 근거는 아래 출처 목록에서 확인할 수 있습니다.");
        return String.join("\n", lines).trim();
    }

    private String synthesizeDirectoryListingAnswer(WorkspaceContext workspaceContext) {
        WorkspaceContextItem item = workspaceContext.items().get(0);
        List<String> lines = new ArrayList<>();
        lines.add("현재 경로의 항목입니다.");
        for (String line : item.content().split("\n")) {
            if (line.startsWith("- ")) {
                lines.add(line);
            }
        }
        if (lines.size() == 1) {
            lines.add("- (empty)");
        }
        return String.join("\n", lines);
    }

    private boolean isDirectoryListingQuestion(String question) {
        String normalized = question == null ? "" : question.toLowerCase(Locale.ROOT);
        return normalized.contains("현재경로")
                || normalized.contains("현재 경로")
                || normalized.contains("파일 뭐")
                || normalized.contains("파일 뭐있")
                || normalized.contains("무슨 파일")
                || normalized.contains("목록")
                || normalized.contains("리스트")
                || normalized.contains("폴더 뭐")
                || normalized.contains("폴더 뭐있");
    }

    private List<RagCitation> mergeCitations(List<RagCitation> ragCitations, List<RagCitation> workspaceCitations) {
        List<RagCitation> merged = new ArrayList<>(workspaceCitations.size() + ragCitations.size());
        merged.addAll(workspaceCitations);
        merged.addAll(ragCitations);
        return merged;
    }

    private String renderTranscript(RagAnswerResponse response, String title, String transcriptPath) {
        StringBuilder builder = new StringBuilder();
        builder.append("# ").append(title).append("\n\n");
        builder.append("- generated_at: ").append(response.generatedAt()).append("\n");
        builder.append("- transcript_path: ").append(transcriptPath).append("\n\n");
        builder.append("## Question\n\n");
        builder.append(response.question().trim()).append("\n\n");
        builder.append("## Answer\n\n");
        builder.append(response.answer().trim()).append("\n\n");
        builder.append("## Citations\n\n");
        if (response.citations().isEmpty()) {
            builder.append("검색된 출처가 없습니다.\n");
        } else {
            for (int index = 0; index < response.citations().size(); index++) {
                RagCitation citation = response.citations().get(index);
                builder.append(index + 1).append(". ")
                        .append(citation.documentTitle())
                        .append(" [chunk ").append(citation.chunkIndex()).append("]")
                        .append(" score=").append(citation.score())
                        .append("\n");
                builder.append(citation.excerpt().trim()).append("\n\n");
            }
        }
        return builder.toString().trim() + "\n";
    }

    private String resolveTranscriptPath(RagWorkspaceRequest request, Instant generatedAt) {
        String filename = FILE_STAMP.format(generatedAt) + "-rag-" + slugify(resolveTitle(request)) + ".md";
        if (request.filePath() != null && !request.filePath().isBlank()) {
            String parent = parentPath(request.filePath().trim());
            return parent.isBlank() ? filename : parent + "/" + filename;
        }
        String directoryPath = request.directoryPath() == null ? "" : request.directoryPath().trim();
        if (directoryPath.isBlank()) {
            return filename;
        }
        return directoryPath + "/" + filename;
    }

    private String resolveTitle(RagWorkspaceRequest request) {
        if (request.title() != null && !request.title().isBlank()) {
            return request.title().trim();
        }
        String question = request.question().replaceAll("\\s+", " ").trim();
        if (question.length() <= 48) {
            return question;
        }
        return question.substring(0, 48).trim() + "...";
    }

    private boolean isTextFile(String path) {
        int index = path.lastIndexOf('.');
        if (index < 0 || index == path.length() - 1) {
            return false;
        }
        String extension = path.substring(index + 1).toLowerCase(Locale.ROOT);
        return TEXT_FILE_EXTENSIONS.contains(extension);
    }

    private boolean isRagImportFile(String path) {
        int index = path.lastIndexOf('.');
        if (index < 0 || index == path.length() - 1) {
            return false;
        }
        String extension = path.substring(index + 1).toLowerCase(Locale.ROOT);
        return RAG_IMPORT_EXTENSIONS.contains(extension);
    }

    private String parentPath(String path) {
        int index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
        if (index < 0) {
            return "";
        }
        return path.substring(0, index);
    }

    private String normalizeWhitespace(String value) {
        return value.replace("\r", "\n")
                .replaceAll("\n{3,}", "\n\n")
                .replaceAll("[\\t\\x0B\\f]+", " ")
                .replaceAll(" {2,}", " ")
                .trim();
    }

    private String abbreviate(String value, int maxLength) {
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength - 1).trim() + "...";
    }

    private String slugify(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .replaceAll("[^\\p{Alnum}\\s-]", " ")
                .replaceAll("\\s+", "-")
                .replaceAll("-{2,}", "-")
                .toLowerCase()
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? "rag-session" : normalized;
    }

    private record WorkspaceContext(List<WorkspaceContextItem> items) {
        List<RagCitation> citations() {
            List<RagCitation> citations = new ArrayList<>();
            for (int index = 0; index < items.size(); index++) {
                WorkspaceContextItem item = items.get(index);
                citations.add(new RagCitation(
                        "workspace/" + item.path(),
                        "workspace:" + item.path(),
                        0,
                        Math.max(0.1, 1.0 - (index * 0.05)),
                        item.excerpt()));
            }
            return citations;
        }
    }

    private record WorkspaceContextItem(
            String path,
            String content,
            String excerpt) {
    }
}
