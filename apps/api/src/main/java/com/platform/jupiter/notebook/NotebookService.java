package com.platform.jupiter.notebook;

import com.platform.jupiter.config.AppProperties;
import io.fabric8.kubernetes.api.model.HostPathVolumeSourceBuilder;
import io.fabric8.kubernetes.api.model.ConfigMap;
import io.fabric8.kubernetes.api.model.ConfigMapBuilder;
import io.fabric8.kubernetes.api.model.IntOrString;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.ServiceBuilder;
import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.api.model.apps.DeploymentBuilder;
import io.fabric8.kubernetes.api.model.batch.v1.Job;
import io.fabric8.kubernetes.api.model.batch.v1.JobBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotebookService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String GATEWAY_CONFIGMAP = "jupiter-gateway-config";
    private static final String GATEWAY_DEPLOYMENT = "jupiter-gateway";
    private static final int PREPULL_TIMEOUT_SECONDS = 90;

    private final NotebookRepository repository;
    private final KubernetesClient kubernetesClient;
    private final AppProperties appProperties;

    public NotebookService(NotebookRepository repository, KubernetesClient kubernetesClient, AppProperties appProperties) {
        this.repository = repository;
        this.kubernetesClient = kubernetesClient;
        this.appProperties = appProperties;
    }

    @Transactional
    public NotebookInstanceDto createNotebook(NotebookRequest request) {
        String slug = toSlug(request.imageTag());
        NotebookInstance instance = repository.findBySlug(slug).orElseGet(NotebookInstance::new);

        String imageName = resolveImageName(request.imageTag());
        instance.setSlug(slug);
        instance.setImageTag(request.imageTag());
        instance.setImageName(imageName);
        instance.setDisplayName(
                request.displayName() == null || request.displayName().isBlank()
                        ? request.imageTag()
                        : request.displayName().trim());
        instance.setDeploymentName("jupyter-nb-" + slug);
        instance.setServiceName("jupyter-nb-" + slug);
        instance.setAccessUrl(appProperties.gatewayUrl() + "/notebooks/" + slug + "/lab");
        instance.setAccessToken(instance.getAccessToken() == null ? newToken() : instance.getAccessToken());
        instance.setStatus("PrePulling");

        prePullImage(instance);

        createOrReplaceService(instance);
        createOrReplaceDeployment(instance);

        NotebookInstance saved = repository.save(instance);
        reconcileGateway(repository.findAllByOrderByCreatedAtDesc());
        return NotebookInstanceDto.from(refreshStatus(saved));
    }

    @Transactional
    public List<NotebookInstanceDto> listNotebooks() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::refreshStatus)
                .map(NotebookInstanceDto::from)
                .toList();
    }

    public long countNotebooks() {
        return repository.count();
    }

    @Transactional
    public NotebookInstanceDto createWorkspaceSession(String userId) {
        String slug = toSlug("ws-" + userId);
        NotebookInstance instance = repository.findBySlug(slug).orElseGet(NotebookInstance::new);

        instance.setSlug(slug);
        instance.setImageTag("base");
        instance.setImageName(appProperties.baseImage());
        instance.setDisplayName(userId.trim());
        instance.setDeploymentName("jupyter-nb-" + slug);
        instance.setServiceName("jupyter-nb-" + slug);
        instance.setAccessUrl(appProperties.gatewayUrl() + "/notebooks/" + slug + "/lab");
        instance.setAccessToken(instance.getAccessToken() == null ? newToken() : instance.getAccessToken());
        instance.setStatus("PrePulling");

        prePullImage(instance);
        createOrReplaceService(instance);
        createOrReplaceDeployment(instance);

        NotebookInstance saved = repository.save(instance);
        reconcileGateway(repository.findAllByOrderByCreatedAtDesc());
        return NotebookInstanceDto.from(refreshStatus(saved));
    }

    private void createOrReplaceService(NotebookInstance instance) {
        io.fabric8.kubernetes.api.model.Service service = new ServiceBuilder()
                .withNewMetadata()
                    .withName(instance.getServiceName())
                    .withNamespace(appProperties.namespace())
                    .addToLabels("app", "jupyter-notebook-instance")
                    .addToLabels("jupiter/notebook-slug", instance.getSlug())
                .endMetadata()
                .withNewSpec()
                    .addToSelector("app", "jupyter-notebook-instance")
                    .addToSelector("jupiter/notebook-slug", instance.getSlug())
                    .addNewPort()
                        .withName("http")
                        .withPort(8888)
                        .withTargetPort(new IntOrString(8888))
                    .endPort()
                .endSpec()
                .build();

        kubernetesClient.services().inNamespace(appProperties.namespace()).resource(service).createOrReplace();
    }

    private void createOrReplaceDeployment(NotebookInstance instance) {
        String baseUrl = "/notebooks/" + instance.getSlug() + "/";
        Deployment deployment = new DeploymentBuilder()
                .withNewMetadata()
                    .withName(instance.getDeploymentName())
                    .withNamespace(appProperties.namespace())
                    .addToLabels("app", "jupyter-notebook-instance")
                    .addToLabels("jupiter/notebook-slug", instance.getSlug())
                .endMetadata()
                .withNewSpec()
                    .withReplicas(1)
                    .withNewSelector()
                        .addToMatchLabels("app", "jupyter-notebook-instance")
                        .addToMatchLabels("jupiter/notebook-slug", instance.getSlug())
                    .endSelector()
                    .withNewTemplate()
                        .withNewMetadata()
                            .addToLabels("app", "jupyter-notebook-instance")
                            .addToLabels("jupiter/notebook-slug", instance.getSlug())
                            .addToAnnotations("jupiter/image", instance.getImageName())
                            .addToAnnotations("jupiter/restarted-at", Instant.now().toString())
                        .endMetadata()
                        .withNewSpec()
                            .withNodeSelector(Map.of("kubernetes.io/hostname", appProperties.workspaceNode()))
                            .addNewInitContainer()
                                .withName("prepare-workspace")
                                .withImage("busybox:1.36")
                                .withCommand(
                                        "sh",
                                        "-c",
                                        "mkdir -p /shared/instances/" + instance.getSlug()
                                                + " && chown -R 1000:100 /shared/instances/" + instance.getSlug())
                                .withNewSecurityContext().withRunAsUser(0L).endSecurityContext()
                                .addNewVolumeMount().withName("workspace").withMountPath("/shared").endVolumeMount()
                            .endInitContainer()
                            .addNewContainer()
                                .withName("notebook")
                                .withImage(instance.getImageName())
                                .withImagePullPolicy("IfNotPresent")
                                .withArgs(
                                        "start-notebook.py",
                                        "--IdentityProvider.token=" + instance.getAccessToken(),
                                        "--ServerApp.base_url=" + baseUrl,
                                        "--ServerApp.default_url=/lab")
                                .addNewEnv().withName("JUPYTER_ENABLE_LAB").withValue("yes").endEnv()
                                .addNewEnv().withName("PIP_INDEX_URL").withValue(appProperties.pypiProxyUrl()).endEnv()
                                .addNewEnv().withName("PIP_TRUSTED_HOST").withValue(appProperties.pypiProxyHost()).endEnv()
                                .addNewPort().withContainerPort(8888).endPort()
                                .addNewVolumeMount()
                                    .withName("workspace")
                                    .withMountPath("/home/jovyan/work")
                                    .withSubPath("instances/" + instance.getSlug())
                                .endVolumeMount()
                            .endContainer()
                            .addNewVolume()
                                .withName("workspace")
                                .withNewPersistentVolumeClaim().withClaimName("jupiter-workspace").endPersistentVolumeClaim()
                            .endVolume()
                        .endSpec()
                    .endTemplate()
                .endSpec()
                .build();

        kubernetesClient.apps().deployments().inNamespace(appProperties.namespace()).resource(deployment).createOrReplace();
    }

    private void prePullImage(NotebookInstance instance) {
        String jobName = "jupyter-prepull-" + instance.getSlug();
        kubernetesClient.batch().v1().jobs().inNamespace(appProperties.namespace()).withName(jobName).delete();

        Job job = new JobBuilder()
                .withNewMetadata()
                    .withName(jobName)
                    .withNamespace(appProperties.namespace())
                    .addToLabels("app", "jupyter-image-prepull")
                    .addToLabels("jupiter/notebook-slug", instance.getSlug())
                .endMetadata()
                .withNewSpec()
                    .withBackoffLimit(0)
                    .withNewTemplate()
                        .withNewSpec()
                            .withNodeSelector(Map.of("kubernetes.io/hostname", appProperties.workspaceNode()))
                            .withRestartPolicy("Never")
                            .addNewContainer()
                                .withName("prepull")
                                .withImage("busybox:1.36")
                                .withCommand(
                                        "sh",
                                        "-c",
                                        "chroot /host ctr --namespace k8s.io images pull --plain-http " + instance.getImageName())
                                .withNewSecurityContext()
                                    .withPrivileged(true)
                                    .withRunAsUser(0L)
                                .endSecurityContext()
                                .addNewVolumeMount().withName("host-root").withMountPath("/host").endVolumeMount()
                            .endContainer()
                            .addNewVolume()
                                .withName("host-root")
                                .withHostPath(new HostPathVolumeSourceBuilder().withPath("/").build())
                            .endVolume()
                        .endSpec()
                    .endTemplate()
                .endSpec()
                .build();

        kubernetesClient.batch().v1().jobs().inNamespace(appProperties.namespace()).resource(job).create();
        waitForPrePull(jobName);
    }

    private void waitForPrePull(String jobName) {
        long deadline = System.currentTimeMillis() + (PREPULL_TIMEOUT_SECONDS * 1000L);
        while (System.currentTimeMillis() < deadline) {
            Job job = kubernetesClient.batch().v1().jobs().inNamespace(appProperties.namespace()).withName(jobName).get();
            if (job != null && job.getStatus() != null) {
                Integer succeeded = job.getStatus().getSucceeded();
                Integer failed = job.getStatus().getFailed();
                if (succeeded != null && succeeded > 0) {
                    return;
                }
                if (failed != null && failed > 0) {
                    throw new IllegalStateException("Image pre-pull job failed: " + jobName);
                }
            }
            sleep(2000L);
        }
        throw new IllegalStateException("Timed out waiting for image pre-pull: " + jobName);
    }

    private void reconcileGateway(List<NotebookInstance> instances) {
        ConfigMap configMap = new ConfigMapBuilder()
                .withNewMetadata()
                    .withName(GATEWAY_CONFIGMAP)
                    .withNamespace(appProperties.namespace())
                .endMetadata()
                .addToData("haproxy.cfg", renderConfig(instances))
                .build();

        kubernetesClient.configMaps().inNamespace(appProperties.namespace()).resource(configMap).createOrReplace();
        kubernetesClient.apps().deployments().inNamespace(appProperties.namespace()).withName(GATEWAY_DEPLOYMENT)
                .edit(deployment -> new DeploymentBuilder(deployment)
                        .editSpec()
                            .editTemplate()
                                .editMetadata()
                                    .addToAnnotations("jupiter/config-reloaded-at", Instant.now().toString())
                                .endMetadata()
                            .endTemplate()
                        .endSpec()
                        .build());
    }

    private String renderConfig(List<NotebookInstance> instances) {
        StringBuilder builder = new StringBuilder();
        builder.append("global\n")
                .append("  log stdout format raw local0\n")
                .append("defaults\n")
                .append("  log global\n")
                .append("  mode http\n")
                .append("  option httplog\n")
                .append("  option forwardfor\n")
                .append("  timeout connect 10s\n")
                .append("  timeout client 300s\n")
                .append("  timeout server 300s\n")
                .append("  timeout tunnel 3600s\n")
                .append("frontend public\n")
                .append("  bind *:8080\n")
                .append("  http-request set-header X-Forwarded-Proto http\n")
                .append("  acl path_api path_beg /api\n")
                .append("  acl path_docs path_beg /docs\n");

        for (NotebookInstance instance : instances) {
            builder.append("  acl nb_")
                    .append(instance.getSlug())
                    .append(" path_beg /notebooks/")
                    .append(instance.getSlug())
                    .append("\n")
                    .append("  use_backend nb_")
                    .append(instance.getSlug())
                    .append(" if nb_")
                    .append(instance.getSlug())
                    .append("\n");
        }

        builder.append("  use_backend api_backend if path_api\n")
                .append("  use_backend api_backend if path_docs\n")
                .append("  default_backend web_backend\n")
                .append("backend api_backend\n")
                .append("  server api jupiter-api:8080 check\n")
                .append("backend web_backend\n")
                .append("  server web jupiter-web:5173 check\n");

        for (NotebookInstance instance : instances) {
            builder.append("backend nb_")
                    .append(instance.getSlug())
                    .append("\n")
                    .append("  server notebook ")
                    .append(instance.getServiceName())
                    .append(".")
                    .append(appProperties.namespace())
                    .append(".svc.cluster.local:8888 check\n");
        }
        return builder.toString();
    }

    private NotebookInstance refreshStatus(NotebookInstance instance) {
        Deployment deployment = kubernetesClient.apps().deployments().inNamespace(appProperties.namespace())
                .withName(instance.getDeploymentName()).get();
        String status = "Missing";
        if (deployment != null && deployment.getStatus() != null) {
            Integer readyReplicas = deployment.getStatus().getReadyReplicas();
            if (readyReplicas != null && readyReplicas > 0) {
                status = "Running";
            } else {
                status = podReason(instance.getSlug());
            }
        }
        if (!status.equals(instance.getStatus())) {
            instance.setStatus(status);
            return repository.save(instance);
        }
        return instance;
    }

    private String podReason(String slug) {
        List<Pod> pods = kubernetesClient.pods().inNamespace(appProperties.namespace())
                .withLabel("jupiter/notebook-slug", slug)
                .list()
                .getItems();
        if (pods.isEmpty()) {
            return "Provisioning";
        }
        for (Pod pod : pods) {
            if (pod.getStatus() == null || pod.getStatus().getContainerStatuses() == null) {
                continue;
            }
            for (var status : pod.getStatus().getContainerStatuses()) {
                if (status.getState() != null && status.getState().getWaiting() != null) {
                    return status.getState().getWaiting().getReason();
                }
                if (status.getReady()) {
                    return "Running";
                }
            }
        }
        return "Starting";
    }

    private String resolveImageName(String imageTag) {
        if ("base".equals(imageTag)) {
            return appProperties.baseImage();
        }
        return appProperties.registry() + "/jupiter/" + imageTag + ":latest";
    }

    private String toSlug(String value) {
        String slug = value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.length() > 40 ? slug.substring(0, 40) : slug;
    }

    private String newToken() {
        byte[] bytes = new byte[8];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for pre-pull", e);
        }
    }
}
