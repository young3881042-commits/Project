package com.platform.aiassitant;

final class TravelApiPolicy {
    private TravelApiPolicy() {}
    static boolean validRequestId(String id) {
        return id != null && id.matches("[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");
    }
    static String path(String action, String id) {
        if ("auth-info".equals(action)) return "auth/info";
        if ("auth-status".equals(action)) return "auth/status";
        if ("auth-login".equals(action)) return "auth/login";
        if ("auth-cancel".equals(action)) return "auth/cancel";
        if ("merchant-create".equals(action)) return "merchant/jobs";
        if ("merchant-poll".equals(action) && validRequestId(id)) return "merchant/jobs/" + id;
        if ("chat-list".equals(action) || "chat-create".equals(action)) return "chat/threads";
        if (validRequestId(id)) {
            if ("chat-thread".equals(action)) return "chat/threads/" + id;
            if ("chat-send".equals(action)) return "chat/threads/" + id + "/messages";
            if ("chat-update".equals(action)) return "chat/threads/" + id + "/meta";
            if ("chat-cancel".equals(action)) return "chat/threads/" + id + "/cancel";
        }
        if ("status".equals(action)) return "status";
        if ("pair".equals(action)) return "pair";
        if ("create".equals(action)) return "jobs";
        if (("poll".equals(action) || "cancel".equals(action)) && validRequestId(id)) return "jobs/" + id;
        return null;
    }
    static String method(String action) {
        if ("auth-login".equals(action) || "auth-cancel".equals(action)) return "POST";
        if ("chat-create".equals(action) || "chat-send".equals(action) || "chat-update".equals(action) || "chat-cancel".equals(action)) return "POST";
        if ("pair".equals(action) || "create".equals(action) || "merchant-create".equals(action)) return "POST";
        return "cancel".equals(action) ? "DELETE" : "GET";
    }
}
