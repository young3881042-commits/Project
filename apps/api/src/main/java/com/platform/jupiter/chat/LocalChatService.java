package com.platform.jupiter.chat;

import com.platform.jupiter.rag.RagAnswerResponse;
import com.platform.jupiter.rag.RagQueryRequest;
import com.platform.jupiter.rag.RagService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocalChatService {
    private final RagService ragService;

    public LocalChatService(RagService ragService) {
        this.ragService = ragService;
    }

    public OpenAiChatCompletionResponse complete(OpenAiChatCompletionRequest request) {
        String prompt = latestUserMessage(request.messages());
        RagAnswerResponse rag = ragService.answer(new RagQueryRequest(prompt, 3));
        String content = """
                Local workspace model reply

                %s
                """.formatted(rag.answer().trim()).trim();

        return new OpenAiChatCompletionResponse(
                "chatcmpl-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16),
                "chat.completion",
                Instant.now().getEpochSecond(),
                request.model().trim(),
                List.of(new OpenAiChatCompletionChoice(
                        0,
                        new ChatMessage("assistant", content),
                        "stop")));
    }

    private String latestUserMessage(List<ChatMessage> messages) {
        for (int index = messages.size() - 1; index >= 0; index--) {
            ChatMessage message = messages.get(index);
            if ("user".equalsIgnoreCase(message.role()) && !message.content().isBlank()) {
                return message.content().trim();
            }
        }
        throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "At least one user message is required");
    }
}
