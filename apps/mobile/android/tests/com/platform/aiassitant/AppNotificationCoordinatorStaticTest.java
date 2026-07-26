package com.platform.aiassitant;

public final class AppNotificationCoordinatorStaticTest {
    private AppNotificationCoordinatorStaticTest() {}

    public static void main(String[] args) {
        require(AppNotificationCoordinator.isValidRequestId("notification-123:abc"));
        require(!AppNotificationCoordinator.isValidRequestId("notification request"));
        require(!AppNotificationCoordinator.isValidRequestId(""));

        require(AppNotificationCoordinator.isValidNotificationId("routine:schedule-1:2026-07-12"));
        require(!AppNotificationCoordinator.isValidNotificationId("bad\nidentifier"));

        require(AppNotificationCoordinator.isAllowedInternalPath("/schedule?edit=schedule-1"));
        require(AppNotificationCoordinator.isAllowedInternalPath("/ai"));
        require(AppNotificationCoordinator.isAllowedInternalPath("/ai/edit"));
        require(AppNotificationCoordinator.isAllowedInternalPath("/ai/settings"));
        require(!AppNotificationCoordinator.isAllowedInternalPath("https://example.com/ai"));
        require(!AppNotificationCoordinator.isAllowedInternalPath("//example.com/ai"));
        require(!AppNotificationCoordinator.isAllowedInternalPath("/account"));
        require(!AppNotificationCoordinator.isAllowedInternalPath("/schedule/../account"));
    }

    private static void require(boolean condition) {
        if (!condition) {
            throw new AssertionError("App notification validation invariant failed");
        }
    }
}
