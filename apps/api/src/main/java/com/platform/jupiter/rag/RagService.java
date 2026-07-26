package com.platform.jupiter.rag;

import com.platform.jupiter.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class RagService {
    private static final Logger log = LoggerFactory.getLogger(RagService.class);
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[\\p{L}\\p{N}]{2,}");
    private static final Set<String> TEXT_EXTENSIONS = Set.of("txt", "md", "csv", "json", "log", "yaml", "yml");
    private static final int CHUNK_SIZE = 520;
    private static final int CHUNK_OVERLAP = 90;

    private final Path ragRoot;
    private final Path sourceRoot;
    private final Path documentsRoot;
    private final Map<String, IndexedDocument> documents = new ConcurrentHashMap<>();
    private final RagEmbeddingService ragEmbeddingService;
    private final VectorStoreService vectorStoreService;
    private final WeatherRagService weatherRagService;
    private final DomainRagCollectorService domainRagCollectorService;
    private final CodexRagService codexRagService;

    public RagService(
            AppProperties appProperties,
            RagEmbeddingService ragEmbeddingService,
            VectorStoreService vectorStoreService,
            WeatherRagService weatherRagService,
            DomainRagCollectorService domainRagCollectorService,
            CodexRagService codexRagService) {
        this.ragRoot = Path.of(appProperties.ragRoot());
        this.sourceRoot = Path.of(appProperties.ragSourceRoot());
        this.documentsRoot = ragRoot.resolve("documents");
        this.ragEmbeddingService = ragEmbeddingService;
        this.vectorStoreService = vectorStoreService;
        this.weatherRagService = weatherRagService;
        this.domainRagCollectorService = domainRagCollectorService;
        this.codexRagService = codexRagService;
    }

    @PostConstruct
    void initialize() {
        try {
            Files.createDirectories(sourceRoot);
            Files.createDirectories(documentsRoot);
            seedIfEmpty();
            ensureLocalTripSeed();
            refreshWeatherSource();
            refreshDomainSources();
            reloadIndex();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to initialize RAG storage", exception);
        }
    }

    public List<RagDocumentSummary> listDocuments() {
        return documents.values().stream()
                .sorted(Comparator.comparing(IndexedDocument::uploadedAt).reversed())
                .map(IndexedDocument::summary)
                .toList();
    }

    public WeatherRagStatusResponse weatherStatus() {
        return weatherRagService.status();
    }


    public DomainRagStatusResponse domainStatus() {
        return domainRagCollectorService.status(sourceRoot);
    }

    public DomainRagStatusResponse refreshDomainData() {
        DomainRagStatusResponse status = domainRagCollectorService.collect(sourceRoot);
        try {
            reloadIndex();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to reload RAG index after domain refresh", exception);
        }
        return status;
    }

    public WeatherRagStatusResponse refreshWeatherData() {
        WeatherRagStatusResponse status = weatherRagService.refresh(sourceRoot);
        try {
            reloadIndex();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to reload RAG index after weather refresh", exception);
        }
        return status;
    }

    public RagDocumentSummary upload(MultipartFile file) {
        String originalName = validateUpload(file.isEmpty(), file.getOriginalFilename());
        try (InputStream stream = file.getInputStream()) {
            return storeDocument(originalName, stream);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to store uploaded document", exception);
        }
    }

    public RagDocumentSummary importWorkspaceFile(String originalName, Path sourceFile) {
        String filename = validateUpload(false, originalName);
        try {
            return storeDocument(filename, Files.newInputStream(sourceFile));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to store uploaded document", exception);
        }
    }

    public RagAnswerResponse answer(RagQueryRequest request) {
        return answer(request, null);
    }

    public RagAnswerResponse answer(RagQueryRequest request, String username) {
        List<String> queryTokens = tokenize(request.question());
        if (queryTokens.isEmpty()) {
            return new RagAnswerResponse(
                    request.question(),
                    "질문에서 검색 가능한 키워드를 찾지 못했습니다. 조금 더 구체적인 단어를 포함해 다시 질문해 주세요.",
                    List.of(),
                    Instant.now());
        }

        RagRetrievalResult retrieval = retrieve(request);
        if (username != null && !username.isBlank()) {
            try {
                String answer = codexRagService.generate(buildPrompt(request.question(), retrieval.candidates()), username);
                if (!answer.isBlank()) {
                    return new RagAnswerResponse(request.question(), answer, retrieval.citations(), Instant.now());
                }
            } catch (Exception exception) {
                log.warn("Codex RAG answer failed for {}: {}", username, exception.getMessage());
            }
        }
        if (retrieval.candidates().isEmpty()) {
            return new RagAnswerResponse(
                    request.question(),
                    "현재 저장된 문서와 실시간 날씨 인덱스에서 질문과 가까운 내용을 찾지 못했습니다. 도시명이나 온도, 강수, 바람 같은 키워드를 넣어 다시 질문해 주세요.",
                    List.of(),
                    Instant.now());
        }

        String answer = synthesizeAnswer(request.question(), retrieval.candidates());
        return new RagAnswerResponse(request.question(), answer, retrieval.citations(), Instant.now());
    }

    public RagRetrievalResult retrieve(RagQueryRequest request) {
        int topK = request.topK() == null ? 4 : request.topK();
        List<String> queryTokens = tokenize(request.question());

        LinkedHashMap<String, RagContextChunk> merged = new LinkedHashMap<>();
        for (RagContextChunk chunk : vectorMatches(request.question(), topK * 2, queryTokens)) {
            merged.put(chunk.documentId() + "#" + chunk.chunkIndex(), chunk);
        }
        for (RagContextChunk chunk : lexicalMatches(request.question(), topK * 2, queryTokens)) {
            merged.merge(chunk.documentId() + "#" + chunk.chunkIndex(), chunk, this::preferHigherScore);
        }

        List<RagContextChunk> candidates = merged.values().stream()
                .sorted(Comparator.comparingDouble(RagContextChunk::score).reversed())
                .limit(topK)
                .toList();
        return new RagRetrievalResult(request.question(), candidates);
    }

    private RagContextChunk preferHigherScore(RagContextChunk left, RagContextChunk right) {
        return left.score() >= right.score() ? left : right;
    }

    private List<RagContextChunk> vectorMatches(String question, int limit, List<String> queryTokens) {
        float[] vector = ragEmbeddingService.embed(question);
        return vectorStoreService.search(vector, limit).stream()
                .map(result -> new RagContextChunk(
                        result.documentId(),
                        result.documentTitle(),
                        result.chunkIndex(),
                        round(boostVectorScore(result.score(), result.text(), queryTokens, question)),
                        result.text()))
                .filter(chunk -> chunk.score() > 0)
                .toList();
    }

    private double boostVectorScore(double score, String text, List<String> queryTokens, String question) {
        double boosted = score * 10;
        String loweredChunk = text.toLowerCase(Locale.ROOT);
        String loweredQuestion = question.toLowerCase(Locale.ROOT);
        if (loweredChunk.contains(loweredQuestion)) {
            boosted += 3;
        }
        for (String token : queryTokens) {
            if (loweredChunk.contains(token)) {
                boosted += token.length() >= 4 ? 0.5 : 0.2;
            }
        }
        return boosted;
    }

    private List<RagContextChunk> lexicalMatches(String question, int limit, List<String> queryTokens) {
        return documents.values().stream()
                .flatMap(document -> document.chunks().stream().map(chunk -> scoreChunk(document, chunk, queryTokens, question)))
                .filter(scored -> scored.score() > 0)
                .sorted(Comparator.comparingDouble(ScoredChunk::score).reversed())
                .limit(limit)
                .map(scored -> new RagContextChunk(
                        scored.document().id(),
                        scored.document().title(),
                        scored.chunk().index(),
                        round(scored.score()),
                        scored.chunk().text()))
                .toList();
    }

    private void reloadIndex() throws IOException {
        documents.clear();
        vectorStoreService.resetCollection();
        indexRoot(sourceRoot, "source");
        indexRoot(documentsRoot, "upload");
    }

    private void indexRoot(Path root, String category) throws IOException {
        if (!Files.exists(root)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(root)) {
            stream.filter(Files::isRegularFile)
                    .filter(file -> TEXT_EXTENSIONS.contains(extensionOf(file.getFileName().toString())))
                    .map(file -> indexFile(root, file, category))
                    .forEach(document -> documents.put(document.id(), document));
        }
    }

    private IndexedDocument indexFile(Path root, Path file, String category) {
        try {
            String filename = file.getFileName().toString();
            String text = Files.readString(file, StandardCharsets.UTF_8);
            String cleaned = normalizeWhitespace(text);
            List<Chunk> chunks = chunk(cleaned).stream()
                    .map(textChunk -> new Chunk(
                            textChunk.index(),
                            textChunk.text(),
                            frequencies(tokenize(textChunk.text()))))
                    .toList();

            Map<String, Integer> documentFrequency = new HashMap<>();
            for (Chunk chunk : chunks) {
                for (String token : chunk.termFrequency().keySet()) {
                    documentFrequency.merge(token, 1, Integer::sum);
                }
            }

            String relativePath = root.relativize(file).toString().replace('\\', '/');
            String id = category + "/" + relativePath;
            String title = prettifyTitle(filename);
            String contentType = mediaTypeOf(filename);
            long size = Files.size(file);
            Instant uploadedAt = Files.getLastModifiedTime(file).toInstant();
            String preview = chunks.isEmpty() ? "" : abbreviate(chunks.get(0).text(), 180);
            IndexedDocument document = new IndexedDocument(id, title, filename, contentType, size, uploadedAt, chunks, documentFrequency, preview, category);
            upsertDocumentChunks(document);
            return document;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to index " + file, exception);
        }
    }

    private void upsertDocumentChunks(IndexedDocument document) {
        List<VectorStoreService.VectorPoint> points = new ArrayList<>();
        for (Chunk chunk : document.chunks()) {
            points.add(new VectorStoreService.VectorPoint(
                    vectorStoreService.pointId(document.id(), chunk.index()),
                    document.id(),
                    document.title(),
                    chunk.index(),
                    chunk.text(),
                    document.category(),
                    ragEmbeddingService.embed(chunk.text())));
        }
        vectorStoreService.upsertChunks(points);
    }

    private void refreshWeatherSource() {
        if (!weatherRagService.enabled()) {
            return;
        }
        try {
            weatherRagService.refresh(sourceRoot);
        } catch (Exception exception) {
            log.warn("Skipping live weather bootstrap: {}", exception.getMessage());
        }
    }

    private void refreshDomainSources() {
        try {
            domainRagCollectorService.collect(sourceRoot);
        } catch (Exception exception) {
            log.warn("Skipping multi-domain bootstrap: {}", exception.getMessage());
        }
    }

    private void seedIfEmpty() throws IOException {
        try (Stream<Path> stream = Files.list(sourceRoot)) {
            if (stream.findAny().isPresent()) {
                return;
            }
        }

        Map<String, String> seeds = new LinkedHashMap<>();
        seeds.put("incident-runbook.md", """
                장애 대응 런북

                API 응답 지연이 발생하면 먼저 ingress, application pod, database 연결 순서로 본다.
                95퍼센타일 응답시간이 1초를 넘으면 최근 배포, HPA 스케일, DB connection pool 사용량을 같이 확인한다.
                오류가 5분 이상 지속되면 롤백 여부를 판단하고, 영향 범위와 임시 우회 방법을 공지한다.

                주요 확인 절차
                1. ingress-nginx 5xx 비율 확인
                2. backend pod 재시작 횟수와 readiness 확인
                3. database CPU, active connection, slow query 확인
                4. 최근 배포 이미지 태그와 설정 변경점 비교
                """);
        seeds.put("service-architecture.md", """
                서비스 아키텍처 개요

                웹 프론트엔드는 React로 구성되고 FastAPI 또는 Spring Boot API를 호출한다.
                원본 문서는 MinIO 또는 로컬 파일 저장소에 저장하고, 메타데이터는 PostgreSQL에 기록한다.
                검색 성능을 위해 문서를 500자 안팎으로 chunk 분할하고, 각 chunk에서 핵심 토큰을 추출한다.
                질문이 들어오면 상위 chunk를 검색해 답변 초안과 출처를 함께 제공한다.

                배포 기준
                애플리케이션은 Docker 이미지로 빌드하고 Kubernetes Deployment와 Service, Ingress로 배포한다.
                관리자 화면에서는 문서 업로드, 색인 상태, 최근 질문 기록을 확인한다.
                """);
        seeds.put("ops-notes.txt", """
                운영 메모

                로그 기반 질의응답 서비스는 검색 결과가 빈약하면 답변을 강하게 단정하지 않아야 한다.
                상위 3개 chunk를 그대로 보여 주고, 출처 문서명과 문단 일부를 함께 노출하는 것이 안전하다.
                질문 의도가 장애 분석이면 원인, 조치, 재발 방지 항목을 분리해 답변한다.
                사용자 가이드는 업로드 가능한 파일 형식과 문서 권장 길이를 먼저 설명한다.
                """);

        for (Map.Entry<String, String> entry : seeds.entrySet()) {
            Files.writeString(sourceRoot.resolve(entry.getKey()), entry.getValue(), StandardCharsets.UTF_8);
        }
    }

    private void ensureLocalTripSeed() throws IOException {
        Path localTripDirectory = sourceRoot.resolve("localtrip");
        Path seedPath = localTripDirectory.resolve("localtrip_rag_seed.jsonl");
        Path guidePath = localTripDirectory.resolve("localtrip_rag_guide.md");
        Files.createDirectories(localTripDirectory);
        if (!Files.exists(seedPath)) {
            Files.writeString(seedPath, """
                {"country":"KR","region":"서울","travelerType":"커플","budgetLevel":"보통","pace":"보통","interests":["역사","카페","사진"],"text":"서울 커플 일정은 오전 경복궁과 북촌한옥마을을 걷고, 점심 이후 익선동 한옥거리나 성수 카페거리에서 휴식하면 이동 피로가 낮다. 해질녘에는 남산서울타워나 여의도 한강공원을 넣으면 야경 만족도가 높다."}
                {"country":"KR","region":"서울","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["가족","자연","시장"],"text":"서울 가족 일정은 서울숲, 여의도 한강공원, 광장시장처럼 유모차와 대중교통 접근이 쉬운 장소를 섞는 편이 안정적이다. 고궁 일정은 오전에 넣고 오후에는 실내 카페나 시장 식사로 전환한다."}
                {"country":"KR","region":"경주","travelerType":"커플","budgetLevel":"보통","pace":"보통","interests":["역사","사진","카페"],"text":"경주 커플 일정은 대릉원, 첨성대, 황리단길을 도보 중심으로 묶고 밤에는 동궁과 월지 또는 월정교 야경을 배치하면 사진 만족도가 높다. 불국사와 석굴암은 차량 반나절 코스로 분리하는 편이 좋다."}
                {"country":"KR","region":"경주","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["역사","가족","실내"],"text":"경주 가족 일정은 불국사, 국립경주박물관, 대릉원을 중심으로 잡으면 교육성과 이동 안정성이 좋다. 비가 오면 국립경주박물관과 황리단길 식사, 카페를 우선 배치한다."}
                {"country":"KR","region":"부산","travelerType":"커플","budgetLevel":"보통","pace":"보통","interests":["바다","야경","맛집"],"text":"부산 커플 일정은 낮에 감천문화마을이나 흰여울문화마을을 걷고, 저녁에는 광안리해변과 광안대교 야경을 넣으면 흐름이 좋다. 해운대 숙박권이면 동백섬과 해운대해수욕장을 같은 날에 묶는다."}
                {"country":"KR","region":"부산","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["자연","시장","가족"],"text":"부산 가족 일정은 해운대해수욕장, 동백섬, 자갈치시장처럼 이동과 식사가 쉬운 장소를 우선한다. 태종대나 오륙도는 바람과 걷는 양을 고려해 낮 시간에 배치한다."}
                {"country":"KR","region":"제주","travelerType":"커플","budgetLevel":"보통","pace":"여유","interests":["자연","카페","사진"],"text":"제주 커플 일정은 동부 성산일출봉과 우도, 서부 애월카페거리와 협재해변처럼 권역을 나누는 편이 좋다. 하루에 동서 이동을 모두 넣으면 피로가 커지므로 권역별로 묶는다."}
                {"country":"KR","region":"제주","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["가족","숲","해변"],"text":"제주 가족 일정은 협재해변, 절물자연휴양림, 오설록 티뮤지엄처럼 주차와 휴식이 쉬운 장소를 섞으면 안정적이다. 우도는 배편과 날씨 확인이 필요해 반나절 이상 확보한다."}
                {"country":"JP","region":"도쿄","travelerType":"커플","budgetLevel":"보통","pace":"보통","interests":["도시","전망","맛집"],"text":"도쿄 커플 일정은 오전 센소지와 아사쿠사, 점심 츠키지 장외시장, 오후 시부야·하라주쿠, 해질녘 시부야 스카이처럼 권역 이동을 줄이면 좋다. 신주쿠교엔은 복잡한 도심 일정 사이 휴식지로 적합하다."}
                {"country":"JP","region":"도쿄","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["가족","공원","쇼핑"],"text":"도쿄 가족 일정은 우에노공원, 아사쿠사, 오다이바처럼 넓고 이동이 단순한 권역을 우선한다. 붐비는 시부야와 신주쿠는 짧게 넣고 식사 예약 또는 대체 후보를 준비한다."}
                {"country":"JP","region":"교토","travelerType":"커플","budgetLevel":"보통","pace":"보통","interests":["역사","사진","카페"],"text":"교토 커플 일정은 이른 오전 후시미이나리 타이샤, 낮 기요미즈데라와 니넨자카·산넨자카, 저녁 기온 산책으로 구성하면 사진과 분위기가 좋다. 니시키시장은 점심 전후 간식 동선으로 적합하다."}
                {"country":"JP","region":"교토","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["역사","가족","자연"],"text":"교토 가족 일정은 기요미즈데라, 아라시야마 대나무숲, 니시키시장을 하루에 모두 넣기보다 동쪽과 서쪽 권역을 나누는 편이 안정적이다. 사찰은 계단이 많아 오전에 배치한다."}
                {"country":"JP","region":"오사카","travelerType":"커플","budgetLevel":"보통","pace":"보통","interests":["맛집","야경","쇼핑"],"text":"오사카 커플 일정은 오전 오사카성 공원, 오후 신사이바시 쇼핑, 저녁 도톤보리와 난바 맛집으로 이어지면 이동이 단순하다. 우메다 스카이빌딩은 야경 대안으로 좋다."}
                {"country":"JP","region":"오사카","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["가족","역사","쇼핑"],"text":"오사카 가족 일정은 오사카성 공원, 덴포잔 대관람차, 난바 식사처럼 넓은 공간과 쉬운 이동을 우선한다. 도톤보리는 저녁 혼잡이 강하므로 짧게 보고 식사는 후보를 여러 개 둔다."}
                {"country":"JP","region":"후쿠오카","travelerType":"커플","budgetLevel":"보통","pace":"여유","interests":["맛집","공원","야경"],"text":"후쿠오카 커플 일정은 오호리공원과 텐진 쇼핑, 저녁 나카스 포장마차 거리로 구성하면 짧은 여행에 효율적이다. 다자이후 텐만구는 반나절 근교 코스로 분리한다."}
                {"country":"JP","region":"후쿠오카","travelerType":"가족","budgetLevel":"보통","pace":"여유","interests":["가족","자연","로컬"],"text":"후쿠오카 가족 일정은 오호리공원, 마린월드 우미노나카미치, 하카타역 식사처럼 접근이 쉬운 장소를 우선한다. 포장마차 거리는 아이 동반이면 짧게 분위기만 보는 편이 안정적이다."}
                """, StandardCharsets.UTF_8);
        }
        if (!Files.exists(guidePath)) {
            Files.writeString(guidePath, """
                # LocalTrip RAG Guide

                ## 서울

                서울 커플 일정은 오전 경복궁과 북촌한옥마을을 걷고, 점심 이후 익선동 한옥거리나 성수 카페거리에서 휴식하면 이동 피로가 낮다. 해질녘에는 남산서울타워나 여의도 한강공원을 넣으면 야경 만족도가 높다.

                서울 가족 일정은 서울숲, 여의도 한강공원, 광장시장처럼 유모차와 대중교통 접근이 쉬운 장소를 섞는 편이 안정적이다. 고궁 일정은 오전에 넣고 오후에는 실내 카페나 시장 식사로 전환한다.

                ## 경주

                경주 커플 일정은 대릉원, 첨성대, 황리단길을 도보 중심으로 묶고 밤에는 동궁과 월지 또는 월정교 야경을 배치하면 사진 만족도가 높다. 불국사와 석굴암은 차량 반나절 코스로 분리하는 편이 좋다.

                경주 가족 일정은 불국사, 국립경주박물관, 대릉원을 중심으로 잡으면 교육성과 이동 안정성이 좋다. 비가 오면 국립경주박물관과 황리단길 식사, 카페를 우선 배치한다.

                ## 부산

                부산 커플 일정은 낮에 감천문화마을이나 흰여울문화마을을 걷고, 저녁에는 광안리해변과 광안대교 야경을 넣으면 흐름이 좋다. 해운대 숙박권이면 동백섬과 해운대해수욕장을 같은 날에 묶는다.

                부산 가족 일정은 해운대해수욕장, 동백섬, 자갈치시장처럼 이동과 식사가 쉬운 장소를 우선한다. 태종대나 오륙도는 바람과 걷는 양을 고려해 낮 시간에 배치한다.

                ## 제주

                제주 커플 일정은 동부 성산일출봉과 우도, 서부 애월카페거리와 협재해변처럼 권역을 나누는 편이 좋다. 하루에 동서 이동을 모두 넣으면 피로가 커지므로 권역별로 묶는다.

                제주 가족 일정은 협재해변, 절물자연휴양림, 오설록 티뮤지엄처럼 주차와 휴식이 쉬운 장소를 섞으면 안정적이다. 우도는 배편과 날씨 확인이 필요해 반나절 이상 확보한다.

                ## 도쿄

                도쿄 커플 일정은 오전 센소지와 아사쿠사, 점심 츠키지 장외시장, 오후 시부야와 하라주쿠, 해질녘 시부야 스카이처럼 권역 이동을 줄이면 좋다. 신주쿠교엔은 복잡한 도심 일정 사이 휴식지로 적합하다.

                도쿄 가족 일정은 우에노공원, 아사쿠사, 오다이바처럼 넓고 이동이 단순한 권역을 우선한다. 붐비는 시부야와 신주쿠는 짧게 넣고 식사 예약 또는 대체 후보를 준비한다.

                ## 교토

                교토 커플 일정은 이른 오전 후시미이나리 타이샤, 낮 기요미즈데라와 니넨자카·산넨자카, 저녁 기온 산책으로 구성하면 사진과 분위기가 좋다. 니시키시장은 점심 전후 간식 동선으로 적합하다.

                교토 가족 일정은 기요미즈데라, 아라시야마 대나무숲, 니시키시장을 하루에 모두 넣기보다 동쪽과 서쪽 권역을 나누는 편이 안정적이다. 사찰은 계단이 많아 오전에 배치한다.

                ## 오사카

                오사카 커플 일정은 오전 오사카성 공원, 오후 신사이바시 쇼핑, 저녁 도톤보리와 난바 맛집으로 이어지면 이동이 단순하다. 우메다 스카이빌딩은 야경 대안으로 좋다.

                오사카 가족 일정은 오사카성 공원, 덴포잔 대관람차, 난바 식사처럼 넓은 공간과 쉬운 이동을 우선한다. 도톤보리는 저녁 혼잡이 강하므로 짧게 보고 식사는 후보를 여러 개 둔다.

                ## 후쿠오카

                후쿠오카 커플 일정은 오호리공원과 텐진 쇼핑, 저녁 나카스 포장마차 거리로 구성하면 짧은 여행에 효율적이다. 다자이후 텐만구는 반나절 근교 코스로 분리한다.

                후쿠오카 가족 일정은 오호리공원, 마린월드 우미노나카미치, 하카타역 식사처럼 접근이 쉬운 장소를 우선한다. 포장마차 거리는 아이 동반이면 짧게 분위기만 보는 편이 안정적이다.
                """, StandardCharsets.UTF_8);
        }
    }

    private ScoredChunk scoreChunk(IndexedDocument document, Chunk chunk, List<String> queryTokens, String rawQuestion) {
        double score = 0;
        int chunkCount = Math.max(document.chunks().size(), 1);
        for (String token : queryTokens) {
            Integer termCount = chunk.termFrequency().get(token);
            if (termCount == null) {
                continue;
            }
            int df = document.documentFrequency().getOrDefault(token, 1);
            double idf = Math.log(1 + ((double) chunkCount / df));
            score += termCount * (1 + idf);
        }

        String loweredChunk = chunk.text().toLowerCase(Locale.ROOT);
        String loweredQuestion = rawQuestion.toLowerCase(Locale.ROOT);
        if (loweredChunk.contains(loweredQuestion)) {
            score += 5;
        }
        for (String token : queryTokens) {
            if (token.length() >= 4 && loweredChunk.contains(token)) {
                score += 0.4;
            }
        }
        return new ScoredChunk(document, chunk, score);
    }

    private String synthesizeAnswer(String question, List<RagContextChunk> chunks) {
        List<String> lines = new ArrayList<>();
        boolean weatherFocused = chunks.stream().anyMatch(chunk -> chunk.documentId().contains("weather-live"));
        if (weatherFocused) {
            lines.add("실시간 날씨 RAG와 업로드 문서를 함께 기준으로 정리했습니다.");
        } else {
            lines.add("질문과 가장 가까운 문서 내용을 기준으로 정리했습니다.");
        }
        for (int index = 0; index < chunks.size(); index++) {
            RagContextChunk chunk = chunks.get(index);
            lines.add((index + 1) + ". " + chunk.documentTitle() + ": " + abbreviate(chunk.text(), 220));
        }
        lines.add("출처는 아래 문서 조각 목록에서 바로 확인할 수 있습니다.");
        return String.join("\n", lines);
    }

    private String buildPrompt(String question, List<RagContextChunk> chunks) {
        StringBuilder builder = new StringBuilder();
        builder.append("You are Codex acting as a concise Korean RAG assistant.\n");
        builder.append("Answer only from the provided retrieved context when possible.\n");
        builder.append("If the retrieved context is insufficient, clearly say what is missing and keep the answer cautious.\n");
        builder.append("When weather context is present, prefer the latest weather facts from context.\n");
        builder.append("Return a concise answer in Korean.\n\n");
        builder.append("Question:\n").append(question.trim()).append("\n\n");
        builder.append("Retrieved context:\n");
        if (chunks.isEmpty()) {
            builder.append("(no relevant indexed documents were found)\n");
        } else {
            for (int index = 0; index < chunks.size(); index++) {
                RagContextChunk chunk = chunks.get(index);
                builder.append("[R").append(index + 1).append("] ")
                        .append(chunk.documentTitle())
                        .append(" (chunk ").append(chunk.chunkIndex()).append(", score ")
                        .append(chunk.score()).append(")\n")
                        .append(chunk.text().trim())
                        .append("\n\n");
            }
        }
        return builder.toString().trim();
    }

    private List<TextChunk> chunk(String text) {
        if (text.isBlank()) {
            return List.of();
        }

        List<TextChunk> chunks = new ArrayList<>();
        int index = 0;
        int cursor = 0;
        while (cursor < text.length()) {
            int end = Math.min(cursor + CHUNK_SIZE, text.length());
            if (end < text.length()) {
                int boundary = Math.max(
                        Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('.', end)),
                        text.lastIndexOf(' ', end));
                if (boundary > cursor + (CHUNK_SIZE / 2)) {
                    end = boundary + 1;
                }
            }
            String value = normalizeWhitespace(text.substring(cursor, end));
            if (!value.isBlank()) {
                chunks.add(new TextChunk(index++, value));
            }
            if (end >= text.length()) {
                break;
            }
            cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
        }
        return chunks;
    }

    private Map<String, Integer> frequencies(Collection<String> tokens) {
        Map<String, Integer> frequencies = new HashMap<>();
        for (String token : tokens) {
            frequencies.merge(token, 1, Integer::sum);
        }
        return frequencies;
    }

    private List<String> tokenize(String text) {
        return TOKEN_PATTERN.matcher(text.toLowerCase(Locale.ROOT))
                .results()
                .map(result -> result.group().trim())
                .filter(token -> token.length() >= 2)
                .toList();
    }

    private RagDocumentSummary storeDocument(String originalName, InputStream stream) throws IOException {
        String extension = extensionOf(originalName);
        String storedName = Instant.now().toEpochMilli() + "-" + UUID.randomUUID().toString().substring(0, 8) + "." + extension;
        Path destination = documentsRoot.resolve(storedName);
        Files.createDirectories(documentsRoot);
        try (InputStream input = stream) {
            Files.copy(input, destination, StandardCopyOption.REPLACE_EXISTING);
        }
        IndexedDocument indexed = indexFile(documentsRoot, destination, "upload");
        documents.put(indexed.id(), indexed);
        return indexed.summary();
    }

    private String validateUpload(boolean empty, String rawFilename) {
        if (empty) {
            throw new IllegalArgumentException("빈 파일은 업로드할 수 없습니다.");
        }
        String filename = rawFilename == null ? null : Path.of(rawFilename).getFileName().toString();
        if (!StringUtils.hasText(filename)) {
            throw new IllegalArgumentException("파일 이름이 필요합니다.");
        }
        String extension = extensionOf(filename);
        if (!TEXT_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("지원 파일 형식은 txt, md, csv, json, log, yaml, yml 입니다.");
        }
        return filename;
    }

    private String extensionOf(String filename) {
        int index = filename.lastIndexOf('.');
        return index >= 0 ? filename.substring(index + 1).toLowerCase(Locale.ROOT) : "txt";
    }

    private String mediaTypeOf(String filename) {
        String extension = extensionOf(filename);
        return switch (extension) {
            case "json" -> MediaType.APPLICATION_JSON_VALUE;
            case "csv" -> "text/csv";
            default -> MediaType.TEXT_PLAIN_VALUE;
        };
    }

    private String prettifyTitle(String filename) {
        String base = filename.replaceFirst("\\.[^.]+$", "");
        return Stream.of(base.split("[-_]"))
                .filter(token -> !token.matches("\\d+"))
                .map(token -> token.isBlank() ? token : Character.toUpperCase(token.charAt(0)) + token.substring(1))
                .collect(Collectors.joining(" "));
    }

    private String normalizeWhitespace(String value) {
        return value.replace("\r", "\n")
                .replaceAll("\n{3,}", "\n\n")
                .replaceAll("[\\t\\x0B\\f]+", " ")
                .replaceAll(" {2,}", " ")
                .trim();
    }

    private String abbreviate(String value, int maxLength) {
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength - 1).trim() + "…";
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record IndexedDocument(
            String id,
            String title,
            String filename,
            String contentType,
            long size,
            Instant uploadedAt,
            List<Chunk> chunks,
            Map<String, Integer> documentFrequency,
            String preview,
            String category) {
        RagDocumentSummary summary() {
            return new RagDocumentSummary(id, title, filename, contentType, size, uploadedAt, chunks.size(), preview);
        }
    }

    private record Chunk(int index, String text, Map<String, Integer> termFrequency) {
    }

    private record TextChunk(int index, String text) {
    }

    private record ScoredChunk(IndexedDocument document, Chunk chunk, double score) {
    }

    public record RagRetrievalResult(String question, List<RagContextChunk> candidates) {
        public List<RagCitation> citations() {
            return candidates.stream()
                    .map(candidate -> new RagCitation(
                            candidate.documentId(),
                            candidate.documentTitle(),
                            candidate.chunkIndex(),
                            candidate.score(),
                            candidate.text()))
                    .toList();
        }
    }

    public record RagContextChunk(
            String documentId,
            String documentTitle,
            int chunkIndex,
            double score,
            String text) {
    }
}
