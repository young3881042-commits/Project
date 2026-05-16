package com.platform.jupiter.web;

import com.platform.jupiter.auth.AuthLoginRequest;
import com.platform.jupiter.auth.AuthResponse;
import com.platform.jupiter.auth.AccountPasswordUpdateRequest;
import com.platform.jupiter.auth.AuthService;
import com.platform.jupiter.auth.AuthSession;
import com.platform.jupiter.auth.AuthSignupRequest;
import com.platform.jupiter.build.BuildRecordDto;
import com.platform.jupiter.build.BuildRequest;
import com.platform.jupiter.build.BuildService;
import com.platform.jupiter.chat.ChatRequest;
import com.platform.jupiter.chat.ChatResponse;
import com.platform.jupiter.chat.ChatService;
import com.platform.jupiter.chat.ChatCredentialService;
import com.platform.jupiter.chat.ChatProviderStatus;
import com.platform.jupiter.chat.LocalChatService;
import com.platform.jupiter.chat.OpenAiChatCompletionRequest;
import com.platform.jupiter.chat.OpenAiChatCompletionResponse;
import com.platform.jupiter.chat.SaveApiKeyRequest;
import com.platform.jupiter.chat.ChatUsageResponse;
import com.platform.jupiter.chat.ChatUsageService;
import com.platform.jupiter.config.AppProperties;
import com.platform.jupiter.foodshow.FoodShowAnalyticsService;
import com.platform.jupiter.foodshow.FoodShowDashboardResponse;
import com.platform.jupiter.files.FileService;
import com.platform.jupiter.files.FileTreeResponse;
import com.platform.jupiter.files.SnapshotDto;
import com.platform.jupiter.files.VirusScanService;
import com.platform.jupiter.files.WorkspaceGeminiRequest;
import com.platform.jupiter.files.WorkspaceGeminiResponse;
import com.platform.jupiter.files.WorkspaceExecutionLogDto;
import com.platform.jupiter.files.WorkspaceExecutionService;
import com.platform.jupiter.files.WorkspaceFileRequest;
import com.platform.jupiter.files.WorkspaceLlmConfigResponse;
import com.platform.jupiter.files.WorkspaceRenameRequest;
import com.platform.jupiter.files.WorkspaceRenameResponse;
import com.platform.jupiter.files.WorkspaceRunResponse;
import com.platform.jupiter.notebook.NotebookInstanceDto;
import com.platform.jupiter.notebook.NotebookRequest;
import com.platform.jupiter.notebook.NotebookService;
import com.platform.jupiter.monitoring.ClusterMonitoringResponse;
import com.platform.jupiter.monitoring.ClusterMonitoringService;
import com.platform.jupiter.rag.RagAnswerResponse;
import com.platform.jupiter.rag.RagDocumentSummary;
import com.platform.jupiter.rag.RagQueryRequest;
import com.platform.jupiter.rag.RagService;
import com.platform.jupiter.rag.RagWorkspaceImportRequest;
import com.platform.jupiter.rag.DomainRagStatusResponse;
import com.platform.jupiter.rag.RagWorkspaceRequest;
import com.platform.jupiter.rag.RagWorkspaceResponse;
import com.platform.jupiter.rag.RagWorkspaceService;
import com.platform.jupiter.rag.WeatherRagStatusResponse;
import com.platform.jupiter.travel.TravelAnalyticsService;
import com.platform.jupiter.travel.TravelDashboardResponse;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class JupiterController {
    private final AppProperties appProperties;
    private final BuildService buildService;
    private final AuthService authService;
    private final FileService fileService;
    private final WorkspaceExecutionService workspaceExecutionService;
    private final VirusScanService virusScanService;
    private final ChatService chatService;
    private final ChatCredentialService chatCredentialService;
    private final ChatUsageService chatUsageService;
    private final LocalChatService localChatService;
    private final NotebookService notebookService;
    private final FoodShowAnalyticsService foodShowAnalyticsService;
    private final TravelAnalyticsService travelAnalyticsService;
    private final RagService ragService;
    private final RagWorkspaceService ragWorkspaceService;
    private final ClusterMonitoringService clusterMonitoringService;

    public JupiterController(
            AppProperties appProperties,
            BuildService buildService,
            AuthService authService,
            FileService fileService,
            WorkspaceExecutionService workspaceExecutionService,
            VirusScanService virusScanService,
            ChatService chatService,
            ChatCredentialService chatCredentialService,
            ChatUsageService chatUsageService,
            LocalChatService localChatService,
            NotebookService notebookService,
            FoodShowAnalyticsService foodShowAnalyticsService,
            TravelAnalyticsService travelAnalyticsService,
            RagService ragService,
            RagWorkspaceService ragWorkspaceService,
            ClusterMonitoringService clusterMonitoringService) {
        this.appProperties = appProperties;
        this.buildService = buildService;
        this.authService = authService;
        this.fileService = fileService;
        this.workspaceExecutionService = workspaceExecutionService;
        this.virusScanService = virusScanService;
        this.chatService = chatService;
        this.chatCredentialService = chatCredentialService;
        this.chatUsageService = chatUsageService;
        this.localChatService = localChatService;
        this.notebookService = notebookService;
        this.foodShowAnalyticsService = foodShowAnalyticsService;
        this.travelAnalyticsService = travelAnalyticsService;
        this.ragService = ragService;
        this.ragWorkspaceService = ragWorkspaceService;
        this.clusterMonitoringService = clusterMonitoringService;
    }

    @GetMapping("/overview")
    public OverviewResponse overview() {
        return new OverviewResponse(
                appProperties.baseImage(),
                appProperties.jupyterUrl(),
                appProperties.frontendUrl(),
                appProperties.apiUrl(),
                appProperties.gatewayUrl(),
                appProperties.externalHost(),
                buildService.countBuilds(),
                fileService.listSnapshots().size(),
                notebookService.countNotebooks());
    }

    @GetMapping("/auth/providers")
    public AuthProvidersResponse authProviders() {
        boolean geminiEnabled = chatCredentialService.isGeminiOauthConfigured();

        String geminiUrl = geminiEnabled
                ? "https://accounts.google.com/o/oauth2/v2/auth"
                + "?client_id=" + encode(appProperties.geminiOauthClientId())
                + "&redirect_uri=" + encode(appProperties.geminiOauthRedirectUri())
                + "&response_type=code"
                + "&scope=" + encode("https://www.googleapis.com/auth/generative-language.retriever https://www.googleapis.com/auth/cloud-platform")
                + "&access_type=offline"
                + "&prompt=consent"
                : "";

        return new AuthProvidersResponse(List.of(
                new AuthProviderDto(
                        "chatgpt",
                        "ChatGPT Login",
                        true,
                        "https://chatgpt.com/",
                        "Opens the official ChatGPT login page in a new tab."),
                new AuthProviderDto(
                        "gemini",
                        "Google Gemini OAuth",
                        geminiEnabled,
                        geminiUrl,
                        geminiEnabled
                                ? "Starts the Google OAuth consent flow for Gemini."
                                : "Set APP_GEMINI_OAUTH_CLIENT_ID and APP_GEMINI_OAUTH_REDIRECT_URI to enable.")));
    }

    @GetMapping("/builds")
    public List<BuildRecordDto> builds() {
        return buildService.listBuilds();
    }

    @PostMapping("/auth/signup")
    public AuthResponse signup(@Valid @RequestBody AuthSignupRequest request) {
        return authService.signup(request);
    }

    @PostMapping("/auth/login")
    public AuthResponse login(@Valid @RequestBody AuthLoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/auth/session")
    public AuthResponse session(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return new AuthResponse(
                session.username(),
                session.role(),
                session.token(),
                session.admin() ? appProperties.launcherUrl() : "");
    }

    @PostMapping("/auth/account/password")
    public ResponseEntity<Void> updatePassword(@Valid @RequestBody AccountPasswordUpdateRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        authService.updatePassword(session.username(), request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/builds")
    public BuildRecordDto createBuild(@Valid @RequestBody BuildRequest request) {
        return buildService.createBuild(request);
    }

    @GetMapping("/workspace/tree")
    public FileTreeResponse workspaceTree(@RequestParam(defaultValue = "") String path, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return fileService.browseWorkspace(path, session.username(), session.admin());
    }

    @GetMapping("/workspace/file")
    public ResponseEntity<Resource> workspaceFile(@RequestParam String path, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return asResponse(fileService.readWorkspaceFile(path, session.username(), session.admin()));
    }

    @GetMapping("/workspace/download")
    public ResponseEntity<Resource> workspaceDownload(@RequestParam String path, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        Resource resource = fileService.readWorkspaceFile(path, session.username(), session.admin());
        String filename = resource.getFilename() == null ? "file" : resource.getFilename();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .body(resource);
    }

    @PostMapping("/workspace/file")
    public ResponseEntity<Void> workspaceSave(@Valid @RequestBody WorkspaceFileRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        fileService.writeWorkspaceFile(request.path(), request.content() == null ? "" : request.content(), session.username(), session.admin());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/workspace/folder")
    public ResponseEntity<Void> workspaceFolder(@RequestParam String path, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        fileService.createDirectory(path, session.username(), session.admin());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/workspace/item")
    public ResponseEntity<Void> workspaceDelete(@RequestParam String path, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        fileService.deleteWorkspaceItem(path, session.username(), session.admin());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/workspace/rename")
    public ResponseEntity<WorkspaceRenameResponse> workspaceRename(@Valid @RequestBody WorkspaceRenameRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        String renamedPath = fileService.renameWorkspaceItem(request.path(), request.newName(), session.username(), session.admin());
        return ResponseEntity.ok(new WorkspaceRenameResponse(renamedPath));
    }

    @PostMapping(value = "/workspace/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> workspaceUpload(
            @RequestParam(defaultValue = "") String path,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        virusScanService.scan(file);
        fileService.uploadWorkspaceFile(path, file, session.username(), session.admin());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/workspace/run-python")
    public WorkspaceRunResponse workspaceRunPython(
            @RequestParam String path,
            @RequestParam(defaultValue = "false") boolean autoFix,
            @RequestParam(defaultValue = "true") boolean summarize,
            HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return workspaceExecutionService.runPythonFile(path, session.username(), session.admin(), autoFix, summarize);
    }

    @PostMapping("/workspace/gemini")
    public WorkspaceGeminiResponse workspaceGemini(@Valid @RequestBody WorkspaceGeminiRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return workspaceExecutionService.runGeminiPrompt(request, session.username(), session.admin());
    }

    @GetMapping("/workspace/llm/config")
    public WorkspaceLlmConfigResponse workspaceLlmConfig(HttpServletRequest servletRequest) {
        authService.requireSession(servletRequest);
        return workspaceExecutionService.llmConfig();
    }

    @GetMapping("/workspace/executions")
    public List<WorkspaceExecutionLogDto> workspaceExecutions(
            @RequestParam(defaultValue = "20") int limit,
            HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return workspaceExecutionService.listExecutionLogs(session.username(), limit);
    }

    @PostMapping("/chat/query")
    public ChatResponse chatQuery(@Valid @RequestBody ChatRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return chatService.chat(request, session.username(), session.admin());
    }

    @GetMapping("/chat/providers")
    public List<ChatProviderStatus> chatProviders(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return chatCredentialService.listProviderStatuses(session.username());
    }

    @GetMapping("/chat/usage")
    public ChatUsageResponse chatUsage(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return chatUsageService.usage(session.username());
    }

    @PostMapping("/chat/providers/openai")
    public ResponseEntity<Void> saveOpenAiKey(@Valid @RequestBody SaveApiKeyRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        chatCredentialService.saveOpenAiApiKey(session.username(), request.apiKey());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/chat/providers/openai")
    public ResponseEntity<Void> deleteOpenAiKey(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        chatCredentialService.deleteCredential(session.username(), "openai");
        return ResponseEntity.ok().build();
    }

    @PostMapping("/chat/providers/gemini/link")
    public ChatProviderLinkResponse startGeminiLink(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return new ChatProviderLinkResponse(chatCredentialService.createGeminiAuthorizationUrl(session.username()));
    }

    @DeleteMapping("/chat/providers/gemini")
    public ResponseEntity<Void> deleteGeminiCredential(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        chatCredentialService.deleteCredential(session.username(), "gemini");
        return ResponseEntity.ok().build();
    }

    @GetMapping(value = "/chat/oauth/gemini/callback", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String completeGeminiLink(
            @RequestParam String code,
            @RequestParam String state) {
        chatCredentialService.completeGeminiAuthorization(code, state);
        return """
                <!doctype html>
                <html>
                <body>
                <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'jupiter-gemini-oauth', status: 'success' }, window.location.origin);
                  window.close();
                }
                </script>
                Gemini account connected. You can close this window.
                </body>
                </html>
                """;
    }

    @PostMapping("/chat/local/v1/chat/completions")
    public OpenAiChatCompletionResponse localChatCompletion(@Valid @RequestBody OpenAiChatCompletionRequest request) {
        return localChatService.complete(request);
    }

    @GetMapping("/snapshots")
    public List<SnapshotDto> snapshots() {
        return fileService.listSnapshots();
    }

    @GetMapping("/notebooks")
    public List<NotebookInstanceDto> notebooks() {
        return notebookService.listNotebooks();
    }

    @PostMapping("/notebooks")
    public NotebookInstanceDto createNotebook(@Valid @RequestBody NotebookRequest request) {
        return notebookService.createNotebook(request);
    }

    @PostMapping("/workspace-sessions")
    public NotebookInstanceDto createWorkspaceSession(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return notebookService.createWorkspaceSession(session.username());
    }

    @GetMapping("/access")
    public AccessResponse access() {
        List<ServiceLink> services = new ArrayList<>(List.of(
                new ServiceLink(
                        "Jupiter",
                        appProperties.jupyterUrl(),
                        appProperties.notebookUser(),
                        "jupiter",
                        "Shared base Jupyter workspace."),
                new ServiceLink(
                        "Nexus",
                        appProperties.nexusUrl(),
                        maskIfPresent(appProperties.nexusUsername()),
                        "hidden",
                        "Registry UI for pushed Jupiter images and package proxy."),
                new ServiceLink(
                        "Launcher",
                        appProperties.launcherUrl(),
                        "-",
                        "-",
                        "Kubernetes launcher UI."),
                new ServiceLink(
                        "Kafka",
                        appProperties.kafkaUrl(),
                        "-",
                        "-",
                        "Kafka bootstrap endpoint."),
                new ServiceLink(
                        "Archive",
                        appProperties.gatewayUrl() + "/api/food-shows/dashboard",
                        "-",
                        "-",
                        "Food show dataset API endpoint.")));
        String elkUrl = appProperties.elkUrl() == null ? "" : appProperties.elkUrl().trim();
        services.add(new ServiceLink(
                "ELK",
                elkUrl,
                "-",
                "-",
                elkUrl.isBlank()
                        ? "Kibana endpoint is not configured in this cluster yet."
                        : "Batch logs and operational dashboards in Kibana."));
        return new AccessResponse(
                services,
                List.of(
                        new DocLink("Food Shows API", appProperties.gatewayUrl() + "/api/food-shows/dashboard"),
                        new DocLink("Travel Platform", appProperties.gatewayUrl() + "/docs/TRAVEL_PLATFORM.md"),
                        new DocLink("Service Access", appProperties.gatewayUrl() + "/docs/SERVICE_ACCESS.md"),
                        new DocLink("External Hosting", appProperties.gatewayUrl() + "/docs/EXTERNAL_HOSTING.md"),
                        new DocLink("Debug Summary", appProperties.gatewayUrl() + "/docs/DEBUG_SUMMARY.md")));
    }

    @GetMapping("/food-shows/dashboard")
    public FoodShowDashboardResponse foodShowDashboard() {
        return foodShowAnalyticsService.dashboard();
    }

    @GetMapping("/travel/dashboard")
    public TravelDashboardResponse travelDashboard() {
        return travelAnalyticsService.dashboard();
    }

    @GetMapping("/monitoring/cluster")
    public ClusterMonitoringResponse clusterMonitoring(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        if (!session.admin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin only");
        }
        return clusterMonitoringService.snapshot();
    }

    @GetMapping("/rag/documents")
    public List<RagDocumentSummary> ragDocuments() {
        return ragService.listDocuments();
    }

    @PostMapping(value = "/rag/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public RagDocumentSummary uploadRagDocument(@RequestParam("file") MultipartFile file) {
        return ragService.upload(file);
    }

    @PostMapping("/rag/documents/workspace")
    public List<RagDocumentSummary> importWorkspaceDocuments(
            @RequestBody RagWorkspaceImportRequest request,
            HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return ragWorkspaceService.importWorkspaceSelection(request, session.username(), session.admin());
    }

    @PostMapping("/rag/query")
    public RagAnswerResponse ragQuery(@Valid @RequestBody RagQueryRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return ragService.answer(request, session.username());
    }

    @GetMapping("/rag/weather")
    public WeatherRagStatusResponse ragWeatherStatus() {
        return ragService.weatherStatus();
    }

    @GetMapping("/rag/domains")
    public DomainRagStatusResponse ragDomainStatus() {
        return ragService.domainStatus();
    }

    @PostMapping("/rag/domains/refresh")
    public DomainRagStatusResponse ragDomainRefresh() {
        return ragService.refreshDomainData();
    }

    @PostMapping("/rag/weather/refresh")
    public WeatherRagStatusResponse ragWeatherRefresh() {
        return ragService.refreshWeatherData();
    }

    @PostMapping("/rag/query-and-save")
    public RagWorkspaceResponse ragQueryAndSave(@Valid @RequestBody RagWorkspaceRequest request, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return ragWorkspaceService.answerAndSave(request, session.username(), session.admin());
    }

    @GetMapping("/snapshots/{tag}/file")
    public ResponseEntity<Resource> snapshotFile(@PathVariable String tag, @RequestParam String path) {
        return asResponse(fileService.readSnapshotFile(tag, path));
    }

    private ResponseEntity<Resource> asResponse(Resource resource) {
        String filename = resource.getFilename() == null ? "file" : resource.getFilename();
        MediaType type = filename.endsWith(".json") ? MediaType.APPLICATION_JSON
                : filename.endsWith(".txt") ? MediaType.TEXT_PLAIN
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(filename).build().toString())
                .body(resource);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String maskIfPresent(String value) {
        return value == null || value.isBlank() ? "-" : "hidden";
    }

    public record ChatProviderLinkResponse(String authorizationUrl) {
    }
}
