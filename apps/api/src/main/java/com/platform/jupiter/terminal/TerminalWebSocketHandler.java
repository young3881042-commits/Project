package com.platform.jupiter.terminal;

import com.platform.jupiter.config.AppProperties;
import com.platform.jupiter.auth.AuthService;
import com.platform.jupiter.auth.AuthSession;
import com.platform.jupiter.chat.ChatCredentialService;
import com.platform.jupiter.files.FileService;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.ExecWatch;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class TerminalWebSocketHandler extends TextWebSocketHandler {
    private final AppProperties appProperties;
    private final KubernetesClient kubernetesClient;
    private final AuthService authService;
    private final ChatCredentialService chatCredentialService;
    private final FileService fileService;
    private final Map<String, TerminalProcess> terminals = new ConcurrentHashMap<>();

    public TerminalWebSocketHandler(
            AppProperties appProperties,
            KubernetesClient kubernetesClient,
            AuthService authService,
            ChatCredentialService chatCredentialService,
            FileService fileService) {
        this.appProperties = appProperties;
        this.kubernetesClient = kubernetesClient;
        this.authService = authService;
        this.chatCredentialService = chatCredentialService;
        this.fileService = fileService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Map<String, String> params = queryParams(session.getUri());
        String token = params.getOrDefault("token", "").trim();
        if (token.isBlank()) {
            session.close(CloseStatus.BAD_DATA.withReason("Missing token"));
            return;
        }

        try {
            AuthSession authSession = authService.requireSession(token);
            String tool = normalizeTool(params.get("tool"));
            Path workspaceRoot = fileService.workspaceRootPath(authSession.username(), authSession.admin());
            Path workspaceHome = fileService.workspaceHomePath(authSession.username(), authSession.admin());
            TerminalProcess terminal = startTerminalProcess(session, tool, authSession.username(), workspaceRoot, workspaceHome);
            terminals.put(session.getId(), terminal);
            send(session, """
                    Connected to %s
                    Workspace: %s

                    """.formatted(tool, workspaceRoot));
        } catch (Exception exception) {
            String message = exception.getMessage() == null ? "Terminal startup failed" : exception.getMessage();
            send(session, "Terminal startup failed: " + message + "\n");
            String reason = ("Terminal startup failed: " + message);
            if (reason.length() > 120) {
                reason = reason.substring(0, 120);
            }
            session.close(CloseStatus.SERVER_ERROR.withReason(reason));
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        TerminalProcess terminal = terminals.get(session.getId());
        if (terminal == null) {
            return;
        }
        String payloadText = message.getPayload();
        if (payloadText.startsWith("__RESIZE__:")) {
            String[] parts = payloadText.substring("__RESIZE__:".length()).split("x", 2);
            if (parts.length == 2) {
                try {
                    terminal.watch().resize(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
                } catch (NumberFormatException ignored) {
                }
            }
            return;
        }
        terminal.input().write(payloadText.getBytes(StandardCharsets.UTF_8));
        terminal.input().flush();
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        shutdown(session.getId());
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        shutdown(session.getId());
    }

    private void send(WebSocketSession session, String payload) {
        if (!session.isOpen()) {
            return;
        }
        synchronized (session) {
            try {
                session.sendMessage(new TextMessage(payload));
            } catch (IOException ignored) {
            }
        }
    }

    private void shutdown(String sessionId) {
        TerminalProcess terminal = terminals.remove(sessionId);
        if (terminal == null) {
            return;
        }
        try {
            terminal.input().close();
        } catch (IOException ignored) {
        }
        try {
            terminal.watch().close();
        } catch (Exception ignored) {
        }
    }

    private TerminalProcess startTerminalProcess(WebSocketSession session, String tool, String username, Path workspaceRoot, Path workspaceHome) throws IOException {
        String command = "exec sh -il";
        if ("gemini".equals(tool)) {
            command = "printf %s " + shellQuote(geminiBrowserBanner()) + " && exec sh -il";
        } else if ("codex".equals(tool)) {
            command = buildCodexCommand();
        }

        String shellCommand = "cd " + shellQuote(workspaceRoot.toString())
                + " && export HOME=" + shellQuote(workspaceHome.toString())
                + " TERM=xterm-256color PATH=\"$PATH:/usr/local/bin:/usr/bin:/opt/jupiter-cli/bin\""
                + ("codex".equals(tool) ? codexSessionEnvironment(username) : "")
                + " && " + buildCliBootstrap(workspaceHome)
                + command;

        Pod pod = resolveCliPod();
        SessionOutputStream outputStream = new SessionOutputStream(session);

        ExecWatch watch = kubernetesClient.pods()
                .inNamespace(appProperties.namespace())
                .withName(pod.getMetadata().getName())
                .redirectingInput()
                .writingOutput(outputStream)
                .writingError(outputStream)
                .withTTY()
                .exec("sh", "-lc", shellCommand);

        return new TerminalProcess(watch, watch.getInput());
    }

    private Map<String, String> queryParams(URI uri) {
        return UriComponentsBuilder.fromUri(uri)
                .build()
                .getQueryParams()
                .toSingleValueMap();
    }

    private String normalizeTool(String tool) {
        if (tool == null) {
            return "shell";
        }
        String normalized = tool.trim().toLowerCase();
        if ("codex".equals(normalized) || "gemini".equals(normalized)) {
            return normalized;
        }
        return "shell";
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private String buildCodexCommand() {
        return """
                if [ ! -x /opt/jupiter-cli/bin/codex ]; then
                  echo 'Codex CLI is not installed in jupiter-cli pod. Install @openai/codex or restart the cli pod with npm access.'
                  exec sh -il
                fi
                exec /opt/jupiter-cli/bin/codex -m %s
                """.formatted(shellQuote(ChatCredentialService.DEFAULT_CODEX_MODEL));
    }

    private String codexSessionEnvironment(String username) {
        return chatCredentialService.resolveOpenAiApiKey(username)
                .map(apiKey -> " OPENAI_API_KEY=" + shellQuote(apiKey) + " CODEX_MODEL=" + shellQuote(ChatCredentialService.DEFAULT_CODEX_MODEL))
                .orElseThrow(() -> new IllegalStateException(ChatCredentialService.CONNECT_OPENAI_API_KEY_MESSAGE));
    }

    private String buildCliBootstrap(Path workspaceHome) {
        String home = workspaceHome.toString();
        StringBuilder bootstrap = new StringBuilder();
        bootstrap.append("mkdir -p \"$HOME/.gemini\"\n");
        String profile = """
                export PATH="$PATH:/usr/local/bin:/usr/bin:/opt/jupiter-cli/bin"
                export TERM="${TERM:-xterm-256color}"
                alias codex='/opt/jupiter-cli/bin/codex'
                alias gemini='/opt/jupiter-cli/bin/gemini'
                gprompt() {
                  if [ "$#" -eq 0 ]; then
                    echo 'usage: gprompt "<request>"'
                    return 1
                  fi
                  output_file="$(mktemp)"
                  if CI=1 NO_COLOR=1 TERM=dumb /opt/jupiter-cli/bin/gemini -y -p "$*" </dev/null >"$output_file" 2>&1; then
                    cat "$output_file"
                    rm -f "$output_file"
                    return 0
                  fi
                  status=$?
                  cat "$output_file"
                  rm -f "$output_file"
                  return $status
                }
                """;
        bootstrap.append("cat > \"$HOME/.profile\" <<'EOF'\n")
                .append(profile)
                .append("EOF\n");
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
                """.formatted(home.replace("\\", "\\\\").replace("\"", "\\\""));
        bootstrap.append("printf %s ").append(shellQuote(settingsJson))
                .append(" > \"$HOME/.gemini/settings.json\"\n")
                .append("printf %s ").append(shellQuote(trustedFoldersJson))
                .append(" > \"$HOME/.gemini/trustedFolders.json\"\n");
        return bootstrap.toString();
    }

    private String geminiBrowserBanner() {
        return """
                Gemini browser shell is ready.
                - Use: gprompt "<request>"
                - Example: gprompt "Create main.py that prints hello"
                - Plain shell commands still work normally.

                The full-screen Gemini TUI is not started in the browser terminal because Enter and approval handling are unreliable over the websocket TTY.

                """;
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
                .orElseThrow(() -> new IllegalStateException("No running jupiter-cli pod found"));
    }

    private record TerminalProcess(ExecWatch watch, OutputStream input) {
    }

    private final class SessionOutputStream extends OutputStream {
        private final WebSocketSession session;

        private SessionOutputStream(WebSocketSession session) {
            this.session = session;
        }

        @Override
        public void write(int b) throws IOException {
            write(new byte[] { (byte) b }, 0, 1);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            send(session, new String(b, off, len, StandardCharsets.UTF_8));
        }
    }
}
