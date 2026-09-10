package com.platform.aiassitant;

public final class TravelApiPolicyStaticTest {
    public static void main(String[] args) {
        require("auth/info".equals(TravelApiPolicy.path("auth-info", "")));
        require("GET".equals(TravelApiPolicy.method("auth-info")));
        require(AiChatAttachmentPolicy.acceptsRequestedTypes(new String[] { ".pdf,.txt,.md", "application/json" }));
        require(!AiChatAttachmentPolicy.acceptsRequestedTypes(new String[] { "*/*" }));
        require(!AiChatAttachmentPolicy.acceptsRequestedTypes(new String[] { "application/pdf", "text/html" }));
        require(AiChatAttachmentPolicy.allowedName("여행 자료.PDF"));
        require(!AiChatAttachmentPolicy.allowedName("../private.txt"));
        require(!AiChatAttachmentPolicy.allowedName("program.apk"));
        require("map/search".equals(TravelApiPolicy.path("map-search", "")));
        require("POST".equals(TravelApiPolicy.method("map-search")));
        String id = "01234567-89ab-4def-8123-456789abcdef";
        require(TravelApiPolicy.validRequestId(id));
        require("auth/status".equals(TravelApiPolicy.path("auth-status", "")));
        require("auth/login".equals(TravelApiPolicy.path("auth-login", "")));
        require("POST".equals(TravelApiPolicy.method("auth-login")));
        require("POST".equals(TravelApiPolicy.method("auth-cancel")));
        require(TravelApiPolicy.path("account/read", "") == null);
        require(TravelApiPolicy.path("account/login/start", "") == null);
        require(TravelApiPolicy.path("auth-token", "") == null);
        require("merchant/jobs".equals(TravelApiPolicy.path("merchant-create", "")));
        require(("merchant/jobs/" + id).equals(TravelApiPolicy.path("merchant-poll", id)));
        require("POST".equals(TravelApiPolicy.method("merchant-create")));
        require("GET".equals(TravelApiPolicy.method("merchant-poll")));
        require(TravelApiPolicy.path("merchant-poll", "../auth") == null);
        require("chat/threads".equals(TravelApiPolicy.path("chat-list", "")));
        require(("chat/threads/" + id + "/messages").equals(TravelApiPolicy.path("chat-send", id)));
        require("POST".equals(TravelApiPolicy.method("chat-send")));
        require(TravelApiPolicy.path("chat-thread", "../auth") == null);
        require(TravelApiPolicy.path("chat-export-file", id) == null);
        require(!TravelApiPolicy.validRequestId(null));
        require("jobs/".concat(id).equals(TravelApiPolicy.path("poll", id)));
        require("DELETE".equals(TravelApiPolicy.method("cancel")));
        require("POST".equals(TravelApiPolicy.method("create")));
        require("GET".equals(TravelApiPolicy.method("status")));
        for (String action : new String[] { "exec", "shell", "http", "https://example.com", "../jobs", null }) {
            require(TravelApiPolicy.path(action, id) == null);
        }
        for (String bad : new String[] { "../status", id + "?x", id + "/..", "", "https://example.com" }) {
            require(TravelApiPolicy.path("poll", bad) == null);
        }
        System.out.println("Travel API policy smoke tests passed");
    }
    private static void require(boolean condition) {
        if (!condition) throw new AssertionError("Unsafe travel API routing");
    }
}
