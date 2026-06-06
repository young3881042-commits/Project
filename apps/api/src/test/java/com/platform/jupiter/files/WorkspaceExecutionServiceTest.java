package com.platform.jupiter.files;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.config.AppProperties;
import io.fabric8.kubernetes.client.KubernetesClient;
import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WorkspaceExecutionServiceTest {

    @Test
    void openAiModeThrows500WhenApiKeyMissing() throws Exception {
        FileService fileService = mock(FileService.class);
        KubernetesClient kubernetesClient = mock(KubernetesClient.class);
        HttpClient httpClient = mock(HttpClient.class);

        Path root = Files.createTempDirectory("workspace-root");
        Path home = Files.createTempDirectory("workspace-home");
        when(fileService.workspaceRootPath("admin1", true)).thenReturn(root);
        when(fileService.workspaceHomePath("admin1", true)).thenReturn(home);
        when(fileService.resolveWorkspacePath("", "admin1", true)).thenReturn(root);

        WorkspaceExecutionService service = new WorkspaceExecutionService(
                props("", "gpt-5.2-codex", false),
                kubernetesClient,
                fileService,
                new ObjectMapper(),
                httpClient);

        WorkspaceGeminiRequest request = new WorkspaceGeminiRequest("hello", "openai", null, "", null, List.of());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.runGeminiPrompt(request, "admin1", true));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, exception.getStatusCode());
        assertTrue(exception.getReason().contains("OPENAI_API_KEY"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void openAi429ReturnsSafeErrorMessage() throws Exception {
        FileService fileService = mock(FileService.class);
        KubernetesClient kubernetesClient = mock(KubernetesClient.class);
        HttpClient httpClient = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);

        Path root = Files.createTempDirectory("workspace-root");
        Path home = Files.createTempDirectory("workspace-home");
        when(fileService.workspaceRootPath("admin1", true)).thenReturn(root);
        when(fileService.workspaceHomePath("admin1", true)).thenReturn(home);
        when(fileService.resolveWorkspacePath("", "admin1", true)).thenReturn(root);

        when(response.statusCode()).thenReturn(429);
        when(response.body()).thenReturn("You exceeded your current quota sk-proj-secret");
        when(httpClient.send(any(), any(HttpResponse.BodyHandler.class))).thenReturn(response);

        WorkspaceExecutionService service = new WorkspaceExecutionService(
                props("sk-proj-xxxxx", "gpt-5.2-codex", false),
                kubernetesClient,
                fileService,
                new ObjectMapper(),
                httpClient);

        WorkspaceGeminiRequest request = new WorkspaceGeminiRequest("hello", "openai", null, "", null, List.of());
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.runGeminiPrompt(request, "admin1", true));

        assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatusCode());
        assertEquals("OpenAI API 사용량 한도 또는 모델 접근 권한 문제로 요청에 실패했습니다. 서버 관리자에게 문의하세요.", exception.getReason());
    }

    private AppProperties props(String openAiApiKey, String openAiModel, boolean codexEnabled) {
        return new AppProperties(
                "jupiter",
                "registry",
                "base",
                "jupyter",
                "frontend",
                "api",
                "gateway",
                "launcher",
                "adminer",
                "artifact-registry",
                "admin",
                "",
                "kafka",
                "",
                "",
                "",
                "external",
                "jovyan",
                "mariadb",
                "jupiter",
                "jupiter",
                "node01",
                "/data/ai-assistant",
                "/data/ai-assistant/conversations",
                "/workspace",
                "/snapshots",
                "/tmp/rag",
                "/tmp/rag/source",
                "http://qdrant:6333",
                "rag",
                128,
                true,
                "https://api.open-meteo.com/v1/forecast",
                "",
                "",
                openAiApiKey,
                openAiModel,
                "",
                codexEnabled,
                "",
                "",
                "");
    }
}
