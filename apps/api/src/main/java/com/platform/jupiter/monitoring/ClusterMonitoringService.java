package com.platform.jupiter.monitoring;

import com.platform.jupiter.monitoring.ClusterMonitoringResponse.ClusterSummary;
import com.platform.jupiter.monitoring.ClusterMonitoringResponse.ContainerUsage;
import com.platform.jupiter.monitoring.ClusterMonitoringResponse.NamespaceUsage;
import com.platform.jupiter.monitoring.ClusterMonitoringResponse.NodeUsage;
import io.fabric8.kubernetes.api.model.ContainerStatus;
import io.fabric8.kubernetes.api.model.Node;
import io.fabric8.kubernetes.api.model.NodeCondition;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.Quantity;
import io.fabric8.kubernetes.api.model.metrics.v1beta1.ContainerMetrics;
import io.fabric8.kubernetes.api.model.metrics.v1beta1.NodeMetrics;
import io.fabric8.kubernetes.api.model.metrics.v1beta1.NodeMetricsList;
import io.fabric8.kubernetes.api.model.metrics.v1beta1.PodMetrics;
import io.fabric8.kubernetes.api.model.metrics.v1beta1.PodMetricsList;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import org.springframework.stereotype.Service;

@Service
public class ClusterMonitoringService {
    private static final String GPU_RESOURCE = "nvidia.com/gpu";

    private final KubernetesClient kubernetesClient;

    public ClusterMonitoringService(KubernetesClient kubernetesClient) {
        this.kubernetesClient = kubernetesClient;
    }

    public ClusterMonitoringResponse snapshot() {
        List<String> warnings = new ArrayList<>();
        List<Node> nodes = kubernetesClient.nodes().list().getItems();
        List<Pod> pods = kubernetesClient.pods().inAnyNamespace().list().getItems();
        long namespaceCount = kubernetesClient.namespaces().list().getItems().size();
        long serviceCount = kubernetesClient.services().inAnyNamespace().list().getItems().size();
        long deploymentCount = kubernetesClient.apps().deployments().inAnyNamespace().list().getItems().size();

        Map<String, NodeMetrics> nodeMetrics = nodeMetrics(warnings);
        Map<String, PodMetrics> podMetrics = podMetrics(warnings);
        Map<String, Pod> podByKey = new HashMap<>();
        for (Pod pod : pods) {
            podByKey.put(key(namespace(pod), name(pod)), pod);
        }

        List<ContainerUsage> containers = containerUsages(podMetrics, podByKey);
        List<NodeUsage> nodeUsages = nodeUsages(nodes, pods, nodeMetrics);
        List<NamespaceUsage> namespaceUsages = namespaceUsages(pods, containers);

        long runningPodCount = pods.stream().filter((pod) -> "Running".equalsIgnoreCase(phase(pod))).count();
        long containerCount = pods.stream()
                .map(Pod::getSpec)
                .filter(Objects::nonNull)
                .mapToLong((spec) -> spec.getContainers() == null ? 0 : spec.getContainers().size())
                .sum();
        long cpuUsageMilli = nodeUsages.stream().mapToLong(NodeUsage::cpuUsageMilli).sum();
        long cpuCapacityMilli = nodeUsages.stream().mapToLong(NodeUsage::cpuCapacityMilli).sum();
        long memoryUsageMi = nodeUsages.stream().mapToLong(NodeUsage::memoryUsageMi).sum();
        long memoryCapacityMi = nodeUsages.stream().mapToLong(NodeUsage::memoryCapacityMi).sum();
        long gpuCapacity = nodeUsages.stream().mapToLong(NodeUsage::gpuCapacity).sum();
        long gpuAllocatable = nodeUsages.stream().mapToLong(NodeUsage::gpuAllocatable).sum();

        ClusterSummary summary = new ClusterSummary(
                nodes.size(),
                namespaceCount,
                pods.size(),
                runningPodCount,
                containerCount,
                serviceCount,
                deploymentCount,
                cpuUsageMilli,
                cpuCapacityMilli,
                percent(cpuUsageMilli, cpuCapacityMilli),
                memoryUsageMi,
                memoryCapacityMi,
                percent(memoryUsageMi, memoryCapacityMi),
                gpuCapacity,
                gpuAllocatable,
                warnings.isEmpty());

        return new ClusterMonitoringResponse(
                Instant.now().toString(),
                summary,
                nodeUsages,
                namespaceUsages,
                containers,
                warnings);
    }

    private Map<String, NodeMetrics> nodeMetrics(List<String> warnings) {
        try {
            NodeMetricsList metrics = kubernetesClient.top().nodes().metrics();
            Map<String, NodeMetrics> result = new HashMap<>();
            for (NodeMetrics item : nullSafe(metrics.getItems())) {
                result.put(item.getMetadata().getName(), item);
            }
            return result;
        } catch (KubernetesClientException exception) {
            warnings.add("Node metrics API를 읽지 못했습니다: " + exception.getMessage());
            return Map.of();
        }
    }

    private Map<String, PodMetrics> podMetrics(List<String> warnings) {
        try {
            PodMetricsList metrics = kubernetesClient.top().pods().metrics();
            Map<String, PodMetrics> result = new HashMap<>();
            for (PodMetrics item : nullSafe(metrics.getItems())) {
                result.put(key(item.getMetadata().getNamespace(), item.getMetadata().getName()), item);
            }
            return result;
        } catch (KubernetesClientException exception) {
            warnings.add("Pod metrics API를 읽지 못했습니다: " + exception.getMessage());
            return Map.of();
        }
    }

    private List<NodeUsage> nodeUsages(List<Node> nodes, List<Pod> pods, Map<String, NodeMetrics> metrics) {
        Map<String, Long> podsByNode = new HashMap<>();
        for (Pod pod : pods) {
            String nodeName = pod.getSpec() == null ? "" : nullToEmpty(pod.getSpec().getNodeName());
            if (!nodeName.isBlank()) {
                podsByNode.merge(nodeName, 1L, Long::sum);
            }
        }

        List<NodeUsage> result = new ArrayList<>();
        for (Node node : nodes) {
            String nodeName = name(node);
            NodeMetrics metric = metrics.get(nodeName);
            long cpuCapacity = cpuMillis(resource(node.getStatus().getCapacity(), "cpu"));
            long memoryCapacity = memoryMi(resource(node.getStatus().getCapacity(), "memory"));
            long cpuUsage = metric == null ? 0 : cpuMillis(resource(metric.getUsage(), "cpu"));
            long memoryUsage = metric == null ? 0 : memoryMi(resource(metric.getUsage(), "memory"));
            result.add(new NodeUsage(
                    nodeName,
                    nodeRole(node),
                    nodeStatus(node),
                    podsByNode.getOrDefault(nodeName, 0L),
                    cpuUsage,
                    cpuCapacity,
                    percent(cpuUsage, cpuCapacity),
                    memoryUsage,
                    memoryCapacity,
                    percent(memoryUsage, memoryCapacity),
                    longQuantity(resource(node.getStatus().getCapacity(), GPU_RESOURCE)),
                    longQuantity(resource(node.getStatus().getAllocatable(), GPU_RESOURCE))));
        }
        result.sort(Comparator.comparing(NodeUsage::name));
        return result;
    }

    private List<ContainerUsage> containerUsages(Map<String, PodMetrics> podMetrics, Map<String, Pod> podByKey) {
        List<ContainerUsage> result = new ArrayList<>();
        for (PodMetrics podMetric : podMetrics.values()) {
            String namespace = podMetric.getMetadata().getNamespace();
            String podName = podMetric.getMetadata().getName();
            Pod pod = podByKey.get(key(namespace, podName));
            Map<String, Long> restarts = restartCounts(pod);

            for (ContainerMetrics container : nullSafe(podMetric.getContainers())) {
                result.add(new ContainerUsage(
                        namespace,
                        podName,
                        container.getName(),
                        pod == null || pod.getSpec() == null ? "" : nullToEmpty(pod.getSpec().getNodeName()),
                        pod == null ? "" : phase(pod),
                        restarts.getOrDefault(container.getName(), 0L),
                        cpuMillis(resource(container.getUsage(), "cpu")),
                        memoryMi(resource(container.getUsage(), "memory"))));
            }
        }
        result.sort(Comparator.comparingLong(ContainerUsage::cpuUsageMilli).reversed()
                .thenComparing(Comparator.comparingLong(ContainerUsage::memoryUsageMi).reversed()));
        return result.size() > 120 ? result.subList(0, 120) : result;
    }

    private List<NamespaceUsage> namespaceUsages(List<Pod> pods, List<ContainerUsage> containers) {
        Map<String, MutableNamespaceUsage> usage = new TreeMap<>();
        for (Pod pod : pods) {
            MutableNamespaceUsage item = usage.computeIfAbsent(namespace(pod), MutableNamespaceUsage::new);
            item.podCount++;
            if ("Running".equalsIgnoreCase(phase(pod))) {
                item.runningPodCount++;
            }
            item.containerCount += pod.getSpec() == null || pod.getSpec().getContainers() == null
                    ? 0
                    : pod.getSpec().getContainers().size();
        }
        for (ContainerUsage container : containers) {
            MutableNamespaceUsage item = usage.computeIfAbsent(container.namespace(), MutableNamespaceUsage::new);
            item.cpuUsageMilli += container.cpuUsageMilli();
            item.memoryUsageMi += container.memoryUsageMi();
        }
        return usage.values().stream()
                .map((item) -> new NamespaceUsage(
                        item.name,
                        item.podCount,
                        item.runningPodCount,
                        item.containerCount,
                        item.cpuUsageMilli,
                        item.memoryUsageMi))
                .sorted(Comparator.comparingLong(NamespaceUsage::cpuUsageMilli).reversed()
                        .thenComparing(Comparator.comparingLong(NamespaceUsage::memoryUsageMi).reversed()))
                .toList();
    }

    private Map<String, Long> restartCounts(Pod pod) {
        if (pod == null || pod.getStatus() == null || pod.getStatus().getContainerStatuses() == null) {
            return Map.of();
        }
        Map<String, Long> result = new HashMap<>();
        for (ContainerStatus status : pod.getStatus().getContainerStatuses()) {
            result.put(status.getName(), status.getRestartCount() == null ? 0L : status.getRestartCount().longValue());
        }
        return result;
    }

    private String nodeRole(Node node) {
        Map<String, String> labels = node.getMetadata().getLabels();
        if (labels == null) {
            return "worker";
        }
        return labels.keySet().stream()
                .filter((key) -> key.startsWith("node-role.kubernetes.io/"))
                .map((key) -> key.substring("node-role.kubernetes.io/".length()))
                .filter((role) -> !role.isBlank())
                .sorted()
                .findFirst()
                .orElse(labels.containsKey("role") ? labels.get("role") : "worker");
    }

    private String nodeStatus(Node node) {
        if (node.getStatus() == null || node.getStatus().getConditions() == null) {
            return "Unknown";
        }
        for (NodeCondition condition : node.getStatus().getConditions()) {
            if ("Ready".equals(condition.getType())) {
                return "True".equalsIgnoreCase(condition.getStatus()) ? "Ready" : "NotReady";
            }
        }
        return "Unknown";
    }

    private String phase(Pod pod) {
        return pod.getStatus() == null ? "" : nullToEmpty(pod.getStatus().getPhase());
    }

    private String name(Pod pod) {
        return pod.getMetadata() == null ? "" : nullToEmpty(pod.getMetadata().getName());
    }

    private String name(Node node) {
        return node.getMetadata() == null ? "" : nullToEmpty(node.getMetadata().getName());
    }

    private String namespace(Pod pod) {
        return pod.getMetadata() == null ? "" : nullToEmpty(pod.getMetadata().getNamespace());
    }

    private Quantity resource(Map<String, Quantity> resources, String name) {
        return resources == null ? null : resources.get(name);
    }

    private long cpuMillis(Quantity quantity) {
        if (quantity == null) {
            return 0;
        }
        BigDecimal value = new BigDecimal(nullToZero(quantity.getAmount()));
        String format = nullToEmpty(quantity.getFormat());
        BigDecimal result = switch (format) {
            case "n" -> value.divide(BigDecimal.valueOf(1_000_000), 0, RoundingMode.HALF_UP);
            case "u" -> value.divide(BigDecimal.valueOf(1_000), 0, RoundingMode.HALF_UP);
            case "m" -> value;
            case "", "Ki", "Mi", "Gi" -> value.multiply(BigDecimal.valueOf(1000));
            default -> value.multiply(BigDecimal.valueOf(1000));
        };
        return result.max(BigDecimal.ZERO).longValue();
    }

    private long memoryMi(Quantity quantity) {
        if (quantity == null) {
            return 0;
        }
        try {
            return Quantity.getAmountInBytes(quantity)
                    .divide(BigDecimal.valueOf(1024 * 1024L), 0, RoundingMode.HALF_UP)
                    .longValue();
        } catch (ArithmeticException exception) {
            return 0;
        }
    }

    private long longQuantity(Quantity quantity) {
        if (quantity == null) {
            return 0;
        }
        try {
            return new BigDecimal(nullToZero(quantity.getAmount())).longValue();
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private double percent(long used, long capacity) {
        if (capacity <= 0) {
            return 0;
        }
        return BigDecimal.valueOf(used)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(capacity), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private String key(String namespace, String name) {
        return namespace + "/" + name;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String nullToZero(String value) {
        if (value == null || value.isBlank()) {
            return "0";
        }
        return value.toLowerCase(Locale.ROOT).replace("_", "");
    }

    private <T> List<T> nullSafe(List<T> items) {
        return items == null ? List.of() : items;
    }

    private static final class MutableNamespaceUsage {
        private final String name;
        private long podCount;
        private long runningPodCount;
        private long containerCount;
        private long cpuUsageMilli;
        private long memoryUsageMi;

        private MutableNamespaceUsage(String name) {
            this.name = name;
        }
    }
}
