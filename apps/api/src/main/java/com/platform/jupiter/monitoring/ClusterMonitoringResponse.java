package com.platform.jupiter.monitoring;

import java.util.List;

public record ClusterMonitoringResponse(
        String generatedAt,
        ClusterSummary summary,
        List<NodeUsage> nodes,
        List<NamespaceUsage> namespaces,
        List<ContainerUsage> containers,
        List<String> warnings) {

    public record ClusterSummary(
            long nodeCount,
            long namespaceCount,
            long podCount,
            long runningPodCount,
            long containerCount,
            long serviceCount,
            long deploymentCount,
            long cpuUsageMilli,
            long cpuCapacityMilli,
            double cpuUsagePercent,
            long memoryUsageMi,
            long memoryCapacityMi,
            double memoryUsagePercent,
            long gpuCapacity,
            long gpuAllocatable,
            boolean metricsAvailable) {
    }

    public record NodeUsage(
            String name,
            String role,
            String status,
            long podCount,
            long cpuUsageMilli,
            long cpuCapacityMilli,
            double cpuUsagePercent,
            long memoryUsageMi,
            long memoryCapacityMi,
            double memoryUsagePercent,
            long gpuCapacity,
            long gpuAllocatable) {
    }

    public record NamespaceUsage(
            String name,
            long podCount,
            long runningPodCount,
            long containerCount,
            long cpuUsageMilli,
            long memoryUsageMi) {
    }

    public record ContainerUsage(
            String namespace,
            String pod,
            String container,
            String node,
            String phase,
            long restartCount,
            long cpuUsageMilli,
            long memoryUsageMi) {
    }
}
