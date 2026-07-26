package com.platform.jupiter.files;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.config.AppProperties;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.ExecListener;
import io.fabric8.kubernetes.client.dsl.ExecWatch;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkspaceExecutionService {
    private static final Logger log = LoggerFactory.getLogger(WorkspaceExecutionService.class);
    private static final long DEFAULT_PYTHON_TIMEOUT_SECONDS = 120L;
    private static final long GEMINI_TIMEOUT_SECONDS = 180L;
    private static final long CODEX_TIMEOUT_SECONDS = 180L;
    private static final int MAX_LOGS_PER_USER = 100;
    private static final int MAX_OUTPUT_CHARS = 4000;
    private static final String SAFE_OPENAI_429_MESSAGE = "OpenAI API 사용량 한도 또는 모델 접근 권한 문제로 요청에 실패했습니다. 서버 관리자에게 문의하세요.";
    private static final String SAFE_OPENAI_MODEL_MESSAGE = "OpenAI 모델 설정 또는 접근 권한 문제로 요청을 처리할 수 없습니다. 서버 관리자에게 문의하세요.";
    private static final String SAFE_OPENAI_FAILURE_MESSAGE = "OpenAI API 요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 서버 관리자에게 문의하세요.";

    private final AppProperties appProperties;
    private final KubernetesClient kubernetesClient;
    private final FileService fileService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Map<String, ArrayDeque<WorkspaceExecutionLogDto>> executionLogsByUser = new ConcurrentHashMap<>();

    @Autowired
    public WorkspaceExecutionService(
            AppProperties appProperties,
            KubernetesClient kubernetesClient,
            FileService fileService,
            ObjectMapper objectMapper) {
        this(appProperties, kubernetesClient, fileService, objectMapper, HttpClient.newBuilder().build());
    }

    WorkspaceExecutionService(
            AppProperties appProperties,
            KubernetesClient kubernetesClient,
            FileService fileService,
            ObjectMapper objectMapper,
            HttpClient httpClient) {
        this.appProperties = appProperties;
        this.kubernetesClient = kubernetesClient;
        this.fileService = fileService;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    public WorkspaceRunResponse runPythonFile(
            String relativePath,
            String username,
            boolean admin,
            boolean autoFixOnFailure,
            boolean includeSummary) {
        if (relativePath == null || relativePath.isBlank() || !relativePath.endsWith(".py")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only .py files can be executed");
        }
        Path workspaceRoot = fileService.workspaceRootPath(username, admin);
        Path workspaceHome = fileService.workspaceHomePath(username, admin);
        Path file = fileService.resolveWorkspacePath(relativePath, username, admin);
        if (!java.nio.file.Files.exists(file) || java.nio.file.Files.isDirectory(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Python file not found");
        }

        String command = buildPythonCommand(file);
        String shellCommand = "cd " + shellQuote(workspaceRoot.toString())
                + " && export HOME=" + shellQuote(workspaceHome.toString())
                + " PATH=\"$PATH:/usr/local/bin:/usr/bin:/opt/jupiter-cli/bin\""
                + " TERM=xterm-256color"
                + " && " + command;

        long pythonTimeoutSeconds = pythonTimeoutSeconds();
        PythonExecutionResult firstRun = executeShellCommandWithStreams(shellCommand, pythonTimeoutSeconds);
        List<String> autoFixNotes = new ArrayList<>();
        boolean autoFixApplied = false;

        addLog(
                username,
                "python",
                relativePath,
                command,
                firstRun.exitCode(),
                firstRun.timedOut(),
                firstRun.stdout(),
                firstRun.stderr());

        PythonExecutionResult finalRun = firstRun;
        if (autoFixOnFailure && shouldAttemptAutoFix(firstRun)) {
            String autoFixPrompt = buildAutoFixPrompt(relativePath, firstRun.stdout(), firstRun.stderr());
            String autoFixCommand = "CI=1 NO_COLOR=1 TERM=dumb /opt/jupiter-cli/bin/gemini -y -p " + shellQuote(autoFixPrompt) + " 2>&1";
            String autoFixShellCommand = "cd " + shellQuote(workspaceRoot.toString())
                    + " && export HOME=" + shellQuote(workspaceHome.toString())
                    + " PATH=\"$PATH:/usr/local/bin:/usr/bin:/opt/jupiter-cli/bin\""
                    + " TERM=xterm-256color"
                    + " && " + buildGeminiBootstrap(workspaceHome)
                    + " && " + autoFixCommand;
            ExecutionResult autoFixResult = executeCommand(autoFixShellCommand, GEMINI_TIMEOUT_SECONDS);
            autoFixNotes.add("Gemini auto-fix run exitCode=" + autoFixResult.exitCode() + ", timedOut=" + autoFixResult.timedOut());
            if (!autoFixResult.output().isBlank()) {
                autoFixNotes.add(truncate(autoFixResult.output().trim()));
            }
            addLog(
                    username,
                    "python-autofix",
                    relativePath,
                    autoFixCommand,
                    autoFixResult.exitCode(),
                    autoFixResult.timedOut(),
                    autoFixResult.output(),
                    "");

            if (!autoFixResult.timedOut()) {
                autoFixApplied = true;
                finalRun = executeShellCommandWithStreams(shellCommand, pythonTimeoutSeconds);
                addLog(
                        username,
                        "python-retry",
                        relativePath,
                        command,
                        finalRun.exitCode(),
                        finalRun.timedOut(),
                        finalRun.stdout(),
                        finalRun.stderr());
            }
        }

        String summary = includeSummary ? buildExecutionSummary(finalRun.stdout(), finalRun.stderr(), finalRun.exitCode(), finalRun.timedOut()) : "";
        return new WorkspaceRunResponse(
                command,
                finalRun.exitCode(),
                finalRun.stdout(),
                finalRun.stderr(),
                finalRun.timedOut(),
                summary,
                autoFixApplied,
                autoFixNotes);
    }

    private PythonExecutionResult executeShellCommandWithStreams(String shellCommand, long timeoutSeconds) {
        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        CountDownLatch done = new CountDownLatch(1);
        ExecWatch watch = null;
        try {
            Pod pod = resolveCliPod();
            watch = kubernetesClient.pods()
                    .inNamespace(appProperties.namespace())
                    .withName(pod.getMetadata().getName())
                    .writingOutput(stdout)
                    .writingError(stderr)
                    .usingListener(new ExecListener() {
                        @Override
                        public void onOpen() {
                        }

                        @Override
                        public void onFailure(Throwable t, io.fabric8.kubernetes.client.dsl.ExecListener.Response failureResponse) {
                            done.countDown();
                        }

                        @Override
                        public void onClose(int code, String reason) {
                            done.countDown();
                        }
                    })
                    .exec("sh", "-lc", shellCommand);

            boolean finished = done.await(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                return new PythonExecutionResult(
                        stdout.toString(StandardCharsets.UTF_8),
                        stderr.toString(StandardCharsets.UTF_8),
                        -1,
                        true);
            }
            Integer exitCode = watch.exitCode().getNow(0);
            return new PythonExecutionResult(
                    stdout.toString(StandardCharsets.UTF_8),
                    stderr.toString(StandardCharsets.UTF_8),
                    exitCode == null ? 0 : exitCode,
                    false);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Python execution interrupted", e);
        } catch (Exception e) {
            log.warn("Kubernetes Python execution unavailable, running locally in API container: {}", e.getMessage());
            return executeLocalShellCommandWithStreams(shellCommand, timeoutSeconds);
        } finally {
            if (watch != null) {
                try {
                    watch.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private long pythonTimeoutSeconds() {
        Long configured = appProperties.pythonTimeoutSeconds();
        if (configured == null || configured < 10L) {
            return DEFAULT_PYTHON_TIMEOUT_SECONDS;
        }
        return Math.min(configured, 900L);
    }

    private PythonExecutionResult executeLocalShellCommandWithStreams(String shellCommand, long timeoutSeconds) {
        Process process = null;
        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        try {
            process = new ProcessBuilder("sh", "-lc", shellCommand).start();
            Process runningProcess = process;
            Thread stdoutReader = new Thread(() -> copyProcessStream(runningProcess.getInputStream(), stdout), "python-stdout-reader");
            Thread stderrReader = new Thread(() -> copyProcessStream(runningProcess.getErrorStream(), stderr), "python-stderr-reader");
            stdoutReader.start();
            stderrReader.start();

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
            }
            stdoutReader.join(TimeUnit.SECONDS.toMillis(1));
            stderrReader.join(TimeUnit.SECONDS.toMillis(1));
            return new PythonExecutionResult(
                    stdout.toString(StandardCharsets.UTF_8),
                    stderr.toString(StandardCharsets.UTF_8),
                    finished ? process.exitValue() : -1,
                    !finished);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) {
                process.destroyForcibly();
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Python execution interrupted", e);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to execute Python file locally", e);
        }
    }

    private void copyProcessStream(java.io.InputStream input, ByteArrayOutputStream output) {
        try (input) {
            input.transferTo(output);
        } catch (IOException ignored) {
        }
    }

    public WorkspaceGeminiResponse runGeminiPrompt(WorkspaceGeminiRequest request, String username, boolean admin) {
        String prompt = request.prompt() == null ? "" : request.prompt().trim();
        if (prompt.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prompt is required");
        }

        Path workspaceRoot = fileService.workspaceRootPath(username, admin);
        Path workspaceHome = fileService.workspaceHomePath(username, admin);
        Path workingDirectory = resolveWorkingDirectory(request.directoryPath(), request.filePath(), username, admin, workspaceRoot);
        List<String> contextFiles = resolveContextFiles(request.contextFiles(), request.filePath(), username, admin);
        String compiledPrompt = buildPromptWithContext(prompt, contextFiles, username, admin);
        String providerId = normalizeProvider(request.providerId());
        String model = resolveOpenAiModel(request.model());
        ExecutionResult result;
        String command;
        if ("codex-cli".equals(providerId)) {
            if (!Boolean.TRUE.equals(appProperties.enableCodexCliMode())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Codex CLI Session Mode is disabled on this server");
            }
            command = "codex exec [prompt]";
            String codexCommand = "cd " + shellQuote(workingDirectory.toString())
                    + " && export HOME=" + shellQuote(workspaceHome.toString())
                    + " PATH=\"$PATH:/usr/local/bin:/usr/bin:" + shellDoubleQuoteContent(codexCliBinDir()) + "\""
                    + " TERM=xterm-256color"
                    + " && " + shellQuote(codexCliPath()) + " exec " + shellQuote(compiledPrompt) + " 2>&1";
            result = executeCommand(codexCommand, CODEX_TIMEOUT_SECONDS);
        } else {
            command = "openai.chat.completions";
            result = executeOpenAiPrompt(compiledPrompt, model);
            providerId = "openai";
        }
        String relativeDirectory = workspaceRoot.equals(workingDirectory)
                ? ""
                : workspaceRoot.relativize(workingDirectory).toString().replace('\\', '/');
        WorkspaceGeminiResponse response = new WorkspaceGeminiResponse(
                providerId,
                "openai".equals(providerId) ? model : "codex-cli-session",
                prompt,
                cleanGeminiOutput(result.output()),
                relativeDirectory,
                result.exitCode(),
                result.timedOut(),
                contextFiles);
        addLog(username, providerId, relativeDirectory, command, response.exitCode(), response.timedOut(), response.output(), "");
        return response;
    }

    public WorkspaceLlmConfigResponse llmConfig() {
        boolean openAiConfigured = appProperties.openAiApiKey() != null && !appProperties.openAiApiKey().isBlank();
        boolean codexEnabled = Boolean.TRUE.equals(appProperties.enableCodexCliMode());
        return new WorkspaceLlmConfigResponse(
                resolveOpenAiModel(null),
                openAiConfigured,
                codexEnabled,
                openAiConfigured ? "서버 기본 키 사용 중" : "OpenAI/Codex 키가 설정되지 않았습니다.",
                codexEnabled ? "Codex CLI 세션 모드 사용 가능" : "Codex CLI 세션 모드 비활성화");
    }

    private String buildPythonCommand(Path file) {
        return "python3 " + shellQuote(file.toString());
    }

    private boolean shouldAttemptAutoFix(PythonExecutionResult result) {
        return result.exitCode() != 0 && !result.timedOut();
    }

    private String buildAutoFixPrompt(String relativePath, String stdout, String stderr) {
        return """
                You are fixing a Python file after a failed run.
                Target file: %s
                Requirements:
                - edit only files inside current workspace
                - keep the original behavior intent
                - fix root-cause errors shown below
                - do not add markdown explanation, apply file edits directly
                Recent stdout:
                %s

                Recent stderr:
                %s
                """.formatted(
                relativePath,
                truncate(stdout == null ? "" : stdout.trim()),
                truncate(stderr == null ? "" : stderr.trim()));
    }

    private String buildExecutionSummary(String stdout, String stderr, int exitCode, boolean timedOut) {
        if (timedOut) {
            return "실행이 제한 시간 내 종료되지 않았습니다. 무한 루프/대기 입력 여부를 확인하세요.";
        }
        if (exitCode == 0) {
            String trimmed = (stdout == null ? "" : stdout.trim());
            if (trimmed.isBlank()) {
                return "실행은 성공(exitCode=0)했지만 출력(stdout)이 비어 있습니다.";
            }
            String firstLine = trimmed.lines().findFirst().orElse("");
            return "실행 성공(exitCode=0). 주요 출력: " + truncate(firstLine);
        }
        String errLine = (stderr == null ? "" : stderr.trim()).lines().findFirst().orElse("");
        if (errLine.isBlank()) {
            return "실행 실패(exitCode=" + exitCode + "). stderr가 비어 있어 전체 로그 확인이 필요합니다.";
        }
        return "실행 실패(exitCode=" + exitCode + "). 대표 오류: " + truncate(errLine);
    }

    private List<String> resolveContextFiles(List<String> requestContextFiles, String filePath, String username, boolean admin) {
        List<String> candidates = new ArrayList<>();
        if (requestContextFiles != null) {
            candidates.addAll(requestContextFiles.stream()
                    .filter(path -> path != null && !path.isBlank())
                    .map(String::trim)
                    .distinct()
                    .limit(8)
                    .toList());
        }
        if ((candidates.isEmpty()) && filePath != null && !filePath.isBlank()) {
            candidates.add(filePath.trim());
        }
        List<String> resolved = new ArrayList<>();
        for (String candidate : candidates) {
            Path file = fileService.resolveWorkspacePath(candidate, username, admin);
            if (Files.exists(file) && !Files.isDirectory(file)) {
                resolved.add(candidate);
            }
        }
        return resolved;
    }

    private String buildPromptWithContext(String prompt, List<String> contextFiles, String username, boolean admin) {
        if (contextFiles.isEmpty()) {
            return prompt;
        }
        StringBuilder builder = new StringBuilder();
        builder.append(prompt).append("\n\n");
        builder.append("Additional workspace context files:\n");
        for (String contextFile : contextFiles) {
            Path file = fileService.resolveWorkspacePath(contextFile, username, admin);
            String content;
            try {
                content = Files.readString(file);
            } catch (Exception ex) {
                content = "[unable to read file]";
            }
            builder.append("\n--- FILE: ").append(contextFile).append(" ---\n");
            builder.append(truncate(content)).append('\n');
        }
        builder.append("\nUse these files as context while applying workspace changes.");
        return builder.toString();
    }

    private String normalizeProvider(String providerId) {
        String normalized = providerId == null ? "" : providerId.trim().toLowerCase();
        if ("codex-cli".equals(normalized)) {
            return "codex-cli";
        }
        return "openai";
    }

    private String resolveOpenAiModel(String requestedModel) {
        String fallback = appProperties.openAiModel() == null || appProperties.openAiModel().isBlank()
                ? configuredCodexModel()
                : appProperties.openAiModel().trim();
        if (requestedModel == null || requestedModel.isBlank()) {
            return fallback;
        }
        return requestedModel.trim();
    }

    private String configuredCodexModel() {
        String model = appProperties.codexModel();
        return model == null || model.isBlank() ? "openai" : model.trim();
    }

    private ExecutionResult executeOpenAiPrompt(String compiledPrompt, String model) {
        String openAiApiKey = appProperties.openAiApiKey();
        if (openAiApiKey == null || openAiApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "서버 OpenAI/Codex 키가 설정되지 않았습니다.");
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("messages", List.of(Map.of("role", "user", "content", compiledPrompt)));
            String body = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.openai.com/v1/chat/completions"))
                    .timeout(java.time.Duration.ofSeconds(GEMINI_TIMEOUT_SECONDS))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + openAiApiKey.trim())
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String safeBody = maskSensitive(response.body());
                if (response.statusCode() == 429) {
                    log.warn("OpenAI API 429 error: {}", truncate(safeBody));
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, SAFE_OPENAI_429_MESSAGE);
                }
                if (response.statusCode() == 400 || response.statusCode() == 401 || response.statusCode() == 403 || response.statusCode() == 404) {
                    log.warn("OpenAI API model/access issue status={}, body={}", response.statusCode(), truncate(safeBody));
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, SAFE_OPENAI_MODEL_MESSAGE);
                }
                log.warn("OpenAI API error status={}, body={}", response.statusCode(), truncate(safeBody));
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, SAFE_OPENAI_FAILURE_MESSAGE);
            }
            JsonNode root = objectMapper.readTree(response.body());
            String output = extractAssistantMessage(root);
            if (output.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI API 응답이 비어 있습니다.");
            }
            return new ExecutionResult(output, 0, false);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, SAFE_OPENAI_FAILURE_MESSAGE, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, SAFE_OPENAI_FAILURE_MESSAGE, e);
        }
    }

    private String extractAssistantMessage(JsonNode root) {
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        if (content.isTextual()) {
            return content.asText().trim();
        }
        if (content.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode item : content) {
                String text = item.path("text").asText("");
                if (!text.isBlank()) {
                    if (builder.length() > 0) {
                        builder.append('\n');
                    }
                    builder.append(text.trim());
                }
            }
            return builder.toString().trim();
        }
        return "";
    }

    public List<WorkspaceExecutionLogDto> listExecutionLogs(String username, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_LOGS_PER_USER));
        ArrayDeque<WorkspaceExecutionLogDto> queue = executionLogsByUser.get(username);
        if (queue == null || queue.isEmpty()) {
            return List.of();
        }
        synchronized (queue) {
            return queue.stream().limit(safeLimit).toList();
        }
    }

    private Path resolveWorkingDirectory(
            String directoryPath,
            String filePath,
            String username,
            boolean admin,
            Path workspaceRoot) {
        if (filePath != null && !filePath.isBlank()) {
            Path file = fileService.resolveWorkspacePath(filePath.trim(), username, admin);
            if (!java.nio.file.Files.exists(file)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected file was not found");
            }
            if (java.nio.file.Files.isDirectory(file)) {
                return file;
            }
            Path parent = file.getParent();
            return parent == null ? workspaceRoot : parent;
        }
        if (directoryPath != null && !directoryPath.isBlank()) {
            Path directory = fileService.resolveWorkspacePath(directoryPath.trim(), username, admin);
            if (!java.nio.file.Files.exists(directory) || !java.nio.file.Files.isDirectory(directory)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected directory was not found");
            }
            return directory;
        }
        return workspaceRoot;
    }

    private String buildGeminiBootstrap(Path workspaceHome) {
        String home = workspaceHome.toString().replace("\\", "\\\\").replace("\"", "\\\"");
        String settingsJson = """
                {
                  "security": {
                    "folderTrust": {
                      "enabled": true
                    },
                    "auth": {
                      "selectedType": "oauth-personal",
                      "useExternal": true
                    }
                  },
                  "screenReader": false
                }
                """;
        String trustedFoldersJson = """
                {
                  "%s": "TRUST_FOLDER"
                }
                """.formatted(home);
        return "mkdir -p \"$HOME/.gemini\""
                + " && printf %s " + shellQuote(settingsJson) + " > \"$HOME/.gemini/settings.json\""
                + " && printf %s " + shellQuote(trustedFoldersJson) + " > \"$HOME/.gemini/trustedFolders.json\"";
    }

    private String cleanGeminiOutput(String output) {
        if (output == null || output.isBlank()) {
            return "";
        }
        StringBuilder cleaned = new StringBuilder();
        for (String line : output.replace("\r\n", "\n").replace('\r', '\n').split("\n")) {
            String trimmed = line.trim();
            if (trimmed.isBlank()
                    || trimmed.startsWith("Warning: Basic terminal detected")
                    || trimmed.startsWith("Warning: 256-color support not detected")
                    || trimmed.startsWith("YOLO mode is enabled")
                    || trimmed.startsWith("Nice to meet you. I am Gemini CLI")) {
                continue;
            }
            if (cleaned.length() > 0) {
                cleaned.append('\n');
            }
            cleaned.append(line);
        }
        return cleaned.toString().trim();
    }

    private ExecutionResult executeCommand(String shellCommand, long timeoutSeconds) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        CountDownLatch done = new CountDownLatch(1);
        ExecWatch watch = null;
        try {
            Pod pod = resolveCliPod();
            watch = kubernetesClient.pods()
                    .inNamespace(appProperties.namespace())
                    .withName(pod.getMetadata().getName())
                    .writingOutput(output)
                    .writingError(output)
                    .usingListener(new ExecListener() {
                        @Override
                        public void onOpen() {
                        }

                        @Override
                        public void onFailure(Throwable t, io.fabric8.kubernetes.client.dsl.ExecListener.Response failureResponse) {
                            done.countDown();
                        }

                        @Override
                        public void onClose(int code, String reason) {
                            done.countDown();
                        }
                    })
                    .exec("sh", "-lc", shellCommand);

            boolean finished = done.await(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                return new ExecutionResult(output.toString(StandardCharsets.UTF_8), -1, true);
            }
            Integer exitCode = watch.exitCode().getNow(0);
            return new ExecutionResult(output.toString(StandardCharsets.UTF_8), exitCode == null ? 0 : exitCode, false);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Command execution interrupted", e);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to execute command", e);
        } finally {
            if (watch != null) {
                try {
                    watch.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private Pod resolveCliPod() {
        List<Pod> pods = kubernetesClient.pods()
                .inNamespace(appProperties.namespace())
                .withLabel("app", "jupiter-cli")
                .list()
                .getItems();
        return pods.stream()
                .filter(pod -> pod.getStatus() != null && "Running".equalsIgnoreCase(pod.getStatus().getPhase()))
                .min(Comparator.comparing(pod -> pod.getMetadata().getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "No running jupiter-cli pod found"));
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private String shellDoubleQuoteContent(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("$", "\\$")
                .replace("`", "\\`");
    }

    private String codexCliPath() {
        String path = appProperties.codexCliPath();
        return path == null || path.isBlank() ? "codex" : path.trim();
    }

    private String codexCliBinDir() {
        String binDir = appProperties.codexCliBinDir();
        return binDir == null || binDir.isBlank() ? "/usr/local/bin" : binDir.trim();
    }

    private void addLog(
            String username,
            String type,
            String targetPath,
            String command,
            int exitCode,
            boolean timedOut,
            String stdout,
            String stderr) {
        String output = mergeOutput(stdout, stderr);
        WorkspaceExecutionLogDto log = new WorkspaceExecutionLogDto(
                UUID.randomUUID().toString(),
                type,
                targetPath == null ? "" : targetPath,
                command,
                exitCode,
            timedOut,
            truncate(maskSensitive(output)),
            Instant.now());
        ArrayDeque<WorkspaceExecutionLogDto> queue = executionLogsByUser.computeIfAbsent(username, unused -> new ArrayDeque<>());
        synchronized (queue) {
            queue.addFirst(log);
            while (queue.size() > MAX_LOGS_PER_USER) {
                queue.removeLast();
            }
        }
    }

    private String mergeOutput(String stdout, String stderr) {
        String safeStdout = stdout == null ? "" : stdout.trim();
        String safeStderr = stderr == null ? "" : stderr.trim();
        if (safeStdout.isBlank() && safeStderr.isBlank()) {
            return "";
        }
        if (safeStderr.isBlank()) {
            return safeStdout;
        }
        if (safeStdout.isBlank()) {
            return "[stderr]\n" + safeStderr;
        }
        return safeStdout + "\n\n[stderr]\n" + safeStderr;
    }

    private String truncate(String output) {
        if (output.length() <= MAX_OUTPUT_CHARS) {
            return output;
        }
        return output.substring(0, MAX_OUTPUT_CHARS) + "\n...(truncated)";
    }

    private String maskSensitive(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        return raw
                .replaceAll("(?i)authorization\\s*:\\s*bearer\\s+[A-Za-z0-9._\\-]+", "authorization: bearer [REDACTED]")
                .replaceAll("(?i)bearer\\s+[A-Za-z0-9._\\-]+", "bearer [REDACTED]")
                .replaceAll("(?i)sk-[A-Za-z0-9_-]+", "sk-[REDACTED]")
                .replaceAll("(?i)sk-proj-[A-Za-z0-9_-]+", "sk-proj-[REDACTED]");
    }

    private record ExecutionResult(String output, int exitCode, boolean timedOut) {
    }

    private record PythonExecutionResult(String stdout, String stderr, int exitCode, boolean timedOut) {
    }
}
