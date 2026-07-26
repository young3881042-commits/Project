package com.platform.aiassitant;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/** Owns the single Android document-picker operation used for LifeHub JSON backup files. */
final class LifeHubBackupDocumentCoordinator {
    static final String RESULT_EVENT = "lifehub:native-backup-result";

    private static final int EXPORT_REQUEST_CODE = 4109;
    private static final int IMPORT_REQUEST_CODE = 4110;
    private static final String STATE_REQUEST = "lifehub.backupDocumentRequest";
    private static final String STATE_RESULT = "lifehub.backupDocumentResult";

    interface Host {
        /** Returns the committed trusted local-app origin, or null for an untrusted caller. */
        String trustedOriginForBackupCall();

        /** Called only while the shared picker lock is held. */
        boolean isWebFilePickerPending();

        /** Dispatches on the trusted page and returns false when that page is not ready yet. */
        boolean dispatchBackupResult(String expectedOrigin, JSONObject detail);
    }

    private volatile Activity activity;
    private volatile Host host;
    private final Object pickerLock;
    private final String expectedLocalOrigin;
    private final File cacheDirectory;
    private Request pendingRequest;
    private Result pendingResult;
    private boolean detached;
    private boolean stateSaved;

    LifeHubBackupDocumentCoordinator(
            Activity activity,
            Host host,
            Object pickerLock,
            String expectedLocalOrigin,
            Bundle savedInstanceState
    ) {
        this.activity = activity;
        this.host = host;
        this.pickerLock = pickerLock;
        this.expectedLocalOrigin = expectedLocalOrigin;
        this.cacheDirectory = resolveCacheDirectory(activity);
        restoreState(savedInstanceState);
        cleanupStaleFiles();
    }

    private static File resolveCacheDirectory(Activity activity) {
        if (activity == null) {
            return null;
        }
        try {
            return activity.getCacheDir().getCanonicalFile();
        } catch (IOException | RuntimeException unavailableCache) {
            return null;
        }
    }

    boolean exportLifeHubBackup(String requestId, String fileName, String json) {
        Host currentHost = host;
        String expectedOrigin = currentHost == null
                ? null
                : currentHost.trustedOriginForBackupCall();
        String normalizedFileName = LifeHubBackupDocumentPolicy.normalizeFileName(fileName);
        if (expectedOrigin == null
                || !expectedOrigin.equals(expectedLocalOrigin)
                || !AppNotificationCoordinator.isValidRequestId(requestId)
                || normalizedFileName == null
                || !isValidJsonObject(json)) {
            return false;
        }

        final String payloadFileName;
        try {
            payloadFileName = createManagedFile(json.getBytes(StandardCharsets.UTF_8));
        } catch (Failure preparationFailure) {
            return false;
        }
        final Request request = Request.exportRequest(
                requestId,
                expectedOrigin,
                normalizedFileName,
                payloadFileName
        );
        if (!claim(request)) {
            deleteManagedFile(payloadFileName);
            return false;
        }
        Activity currentActivity = activity;
        if (currentActivity == null) {
            abandonClaim(request);
            return false;
        }
        currentActivity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                launch(request);
            }
        });
        return true;
    }

    boolean importLifeHubBackup(String requestId) {
        Host currentHost = host;
        String expectedOrigin = currentHost == null
                ? null
                : currentHost.trustedOriginForBackupCall();
        if (expectedOrigin == null
                || !expectedOrigin.equals(expectedLocalOrigin)
                || !AppNotificationCoordinator.isValidRequestId(requestId)) {
            return false;
        }
        final Request request = Request.importRequest(requestId, expectedOrigin);
        if (!claim(request)) {
            return false;
        }
        Activity currentActivity = activity;
        if (currentActivity == null) {
            abandonClaim(request);
            return false;
        }
        currentActivity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                launch(request);
            }
        });
        return true;
    }

    boolean hasPendingOperation() {
        synchronized (pickerLock) {
            return pendingRequest != null || pendingResult != null;
        }
    }

    boolean handlesActivityResult(int requestCode) {
        return requestCode == EXPORT_REQUEST_CODE || requestCode == IMPORT_REQUEST_CODE;
    }

    boolean isAllowedImportDocument(Uri uri) {
        synchronized (pickerLock) {
            if (detached) {
                return false;
            }
        }
        if (uri == null
                || !ContentResolver.SCHEME_CONTENT.equalsIgnoreCase(uri.getScheme())) {
            return false;
        }
        Activity currentActivity = activity;
        if (currentActivity == null) {
            return false;
        }
        final String mimeType;
        final long reportedLength;
        try {
            mimeType = currentActivity.getContentResolver().getType(uri);
            reportedLength = selectedLength(uri);
        } catch (RuntimeException unavailableMetadata) {
            return false;
        }
        if (!LifeHubBackupDocumentPolicy.hasAllowedMimeType(mimeType)
                || !LifeHubBackupDocumentPolicy.isAllowedReportedLength(reportedLength)) {
            return false;
        }
        try {
            validatedJson(readDocument(uri, reportedLength));
            return true;
        } catch (Failure invalidDocument) {
            return false;
        }
    }

    void handleActivityResult(int requestCode, int resultCode, Intent data) {
        Request request;
        synchronized (pickerLock) {
            if (detached) {
                return;
            }
            request = pendingRequest;
        }
        if (request == null || request.requestCode() != requestCode) {
            return;
        }
        if (resultCode == Activity.RESULT_CANCELED) {
            finish(request, Result.cancelled(request));
            return;
        }
        if (resultCode != Activity.RESULT_OK) {
            finish(request, Result.failure(
                    request,
                    "picker_failed",
                    "JSON 문서 선택을 완료하지 못했어요."
            ));
            return;
        }

        Uri uri = singleSelectedUri(data);
        if (uri == null
                || !ContentResolver.SCHEME_CONTENT.equalsIgnoreCase(uri.getScheme())) {
            finish(request, Result.failure(
                    request,
                    "invalid_document",
                    "선택한 JSON 문서를 사용할 수 없어요."
            ));
            return;
        }

        Activity currentActivity = activity;
        if (currentActivity == null) {
            finish(request, Result.failure(
                    request,
                    "state_lost",
                    "백업 작업 상태를 복구하지 못했어요. 다시 시도해주세요."
            ));
            return;
        }
        final String mimeType;
        final long reportedLength;
        try {
            mimeType = currentActivity.getContentResolver().getType(uri);
            reportedLength = selectedLength(uri);
        } catch (RuntimeException unavailableMetadata) {
            finish(request, Result.failure(
                    request,
                    "invalid_document",
                    "선택한 JSON 문서를 확인할 수 없어요."
            ));
            return;
        }
        if (!LifeHubBackupDocumentPolicy.hasAllowedMimeType(mimeType)) {
            finish(request, Result.failure(
                    request,
                    "invalid_mime_type",
                    "application/json 형식의 문서만 사용할 수 있어요."
            ));
            return;
        }
        if (!LifeHubBackupDocumentPolicy.isAllowedReportedLength(reportedLength)) {
            finish(request, Result.failure(
                    request,
                    "file_too_large",
                    "백업 파일은 8 MiB 이하여야 해요."
            ));
            return;
        }

        try {
            if (request.isExport()) {
                int byteCount = writeDocument(uri, request.payloadFileName);
                finish(request, Result.successfulExport(request, byteCount));
                return;
            }
            byte[] bytes = readDocument(uri, reportedLength);
            String json = validatedJson(bytes);
            byte[] normalizedBytes = json.getBytes(StandardCharsets.UTF_8);
            String payloadFileName = createManagedFile(normalizedBytes);
            finish(request, Result.successfulImport(
                    request,
                    payloadFileName,
                    normalizedBytes.length
            ));
        } catch (Failure failure) {
            finish(request, Result.failure(request, failure.code, failure.userMessage));
        }
    }

    void saveInstanceState(Bundle outState) {
        if (outState == null) {
            return;
        }
        synchronized (pickerLock) {
            stateSaved = true;
            if (pendingRequest != null) {
                outState.putBundle(STATE_REQUEST, pendingRequest.toBundle());
            }
            if (pendingResult != null) {
                outState.putBundle(STATE_RESULT, pendingResult.toBundle());
            }
        }
    }

    void onTrustedPageReady() {
        dispatchPendingResult();
    }

    void onHostResumed() {
        synchronized (pickerLock) {
            if (!detached) {
                stateSaved = false;
            }
        }
    }

    void destroy(boolean finalClose) {
        synchronized (pickerLock) {
            detached = true;
        }
        if (finalClose) {
            discardState();
        }
        host = null;
        activity = null;
    }

    private void restoreState(Bundle savedInstanceState) {
        if (savedInstanceState == null) {
            return;
        }
        Request request = Request.fromBundle(
                savedInstanceState.getBundle(STATE_REQUEST),
                expectedLocalOrigin
        );
        Result result = Result.fromBundle(
                savedInstanceState.getBundle(STATE_RESULT),
                expectedLocalOrigin
        );
        synchronized (pickerLock) {
            pendingRequest = result == null ? request : null;
            pendingResult = result;
        }
        if (result != null && request != null) {
            deleteManagedFile(request.payloadFileName);
        }
    }

    private boolean claim(Request request) {
        synchronized (pickerLock) {
            Host currentHost = host;
            if (detached
                    || stateSaved
                    || pendingRequest != null
                    || pendingResult != null
                    || currentHost == null
                    || currentHost.isWebFilePickerPending()) {
                return false;
            }
            pendingRequest = request;
            return true;
        }
    }

    private void abandonClaim(Request request) {
        boolean abandoned = false;
        synchronized (pickerLock) {
            if (!detached && pendingRequest == request) {
                pendingRequest = null;
                abandoned = true;
            }
        }
        if (abandoned) {
            deleteManagedFile(request.payloadFileName);
        }
    }

    private void launch(Request request) {
        synchronized (pickerLock) {
            if (detached || pendingRequest != request) {
                return;
            }
        }
        Host currentHost = host;
        Activity currentActivity = activity;
        if (currentHost == null || currentActivity == null) {
            return;
        }
        if (!request.expectedOrigin.equals(currentHost.trustedOriginForBackupCall())) {
            finish(request, Result.failure(
                    request,
                    "page_changed",
                    "백업 화면이 바뀌어 요청을 취소했어요."
            ));
            return;
        }

        Intent picker = new Intent(
                request.isExport() ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT
        );
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType(LifeHubBackupDocumentPolicy.MIME_TYPE);
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
        if (request.isExport()) {
            picker.putExtra(Intent.EXTRA_TITLE, request.fileName);
            picker.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } else {
            picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        try {
            currentActivity.startActivityForResult(picker, request.requestCode());
        } catch (RuntimeException unavailablePicker) {
            finish(request, Result.failure(
                    request,
                    "picker_unavailable",
                    "이 휴대폰에서 JSON 문서 선택기를 열 수 없어요."
            ));
        }
    }

    private static Uri singleSelectedUri(Intent data) {
        if (data == null) {
            return null;
        }
        ClipData clipData = data.getClipData();
        if (clipData != null) {
            return clipData.getItemCount() == 1 ? clipData.getItemAt(0).getUri() : null;
        }
        return data.getData();
    }

    private long selectedLength(Uri uri) {
        Activity currentActivity = activity;
        if (currentActivity == null) {
            return -1L;
        }
        ContentResolver resolver = currentActivity.getContentResolver();
        try (Cursor cursor = resolver.query(
                uri,
                new String[]{OpenableColumns.SIZE},
                null,
                null,
                null
        )) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                long size = cursor.getLong(0);
                if (size >= 0L) {
                    return size;
                }
            }
        } catch (RuntimeException unavailableMetadata) {
            // Some document providers omit OpenableColumns metadata.
        }
        try (AssetFileDescriptor descriptor = resolver.openAssetFileDescriptor(uri, "r")) {
            return descriptor == null ? -1L : descriptor.getLength();
        } catch (IOException | RuntimeException unavailableDescriptor) {
            return -1L;
        }
    }

    private byte[] readDocument(Uri uri, long reportedLength) throws Failure {
        if (!LifeHubBackupDocumentPolicy.isAllowedReportedLength(reportedLength)) {
            throw Failure.tooLarge();
        }
        Activity currentActivity = activity;
        if (currentActivity == null) {
            throw Failure.stateLost();
        }
        try (InputStream input = currentActivity.getContentResolver().openInputStream(uri)) {
            if (input == null) {
                throw new IOException("missing input");
            }
            return readBounded(input);
        } catch (Failure failure) {
            throw failure;
        } catch (IOException | RuntimeException readFailure) {
            throw new Failure("read_failed", "백업 파일을 읽지 못했어요.");
        }
    }

    private int writeDocument(Uri uri, String payloadFileName) throws Failure {
        byte[] bytes = readManagedFile(payloadFileName);
        Activity currentActivity = activity;
        if (currentActivity == null) {
            throw Failure.stateLost();
        }
        try (OutputStream output = currentActivity.getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) {
                throw new IOException("missing output");
            }
            output.write(bytes);
            output.flush();
            return bytes.length;
        } catch (IOException | RuntimeException writeFailure) {
            throw new Failure("write_failed", "백업 파일을 저장하지 못했어요.");
        }
    }

    private static byte[] readBounded(InputStream input) throws IOException, Failure {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[16 * 1024];
        int total = 0;
        while (true) {
            int read = input.read(buffer);
            if (read < 0) {
                break;
            }
            if (read == 0) {
                continue;
            }
            total += read;
            if (total > LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES) {
                throw Failure.tooLarge();
            }
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static String validatedJson(byte[] bytes) throws Failure {
        final String json;
        try {
            json = LifeHubBackupDocumentPolicy.decodeUtf8(bytes);
        } catch (CharacterCodingException invalidUtf8) {
            throw new Failure("invalid_json", "백업 파일이 올바른 UTF-8 JSON이 아니에요.");
        }
        if (!isValidJsonObject(json)) {
            throw new Failure("invalid_json", "백업 파일이 올바른 JSON 객체가 아니에요.");
        }
        return json;
    }

    private static boolean isValidJsonObject(String json) {
        if (!LifeHubBackupDocumentPolicy.isWithinByteLimit(json)
                || !LifeHubBackupDocumentPolicy.hasJsonObjectEnvelope(json)) {
            return false;
        }
        return LifeHubBackupDocumentPolicy.isStrictJsonObject(json);
    }

    private String createManagedFile(byte[] bytes) throws Failure {
        if (bytes == null || bytes.length > LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES) {
            throw Failure.tooLarge();
        }
        if (cacheDirectory == null) {
            throw Failure.stateLost();
        }
        File target = null;
        try {
            target = File.createTempFile(
                    LifeHubBackupDocumentPolicy.CACHE_FILE_PREFIX,
                    ".json",
                    cacheDirectory
            );
            try (OutputStream output = new FileOutputStream(target, false)) {
                output.write(bytes);
                output.flush();
            }
            return target.getName();
        } catch (IOException | RuntimeException writeFailure) {
            if (target != null) {
                target.delete();
            }
            throw new Failure(
                    "temporary_storage_failed",
                    "백업 작업을 안전하게 준비하지 못했어요."
            );
        }
    }

    private byte[] readManagedFile(String fileName) throws Failure {
        File source = managedFile(fileName);
        if (source == null
                || !source.isFile()
                || !LifeHubBackupDocumentPolicy.isAllowedReportedLength(source.length())) {
            throw Failure.stateLost();
        }
        try (InputStream input = new FileInputStream(source)) {
            return readBounded(input);
        } catch (Failure failure) {
            throw failure;
        } catch (IOException | RuntimeException readFailure) {
            throw Failure.stateLost();
        }
    }

    private File managedFile(String fileName) {
        if (cacheDirectory == null
                || !LifeHubBackupDocumentPolicy.isManagedCacheFileName(fileName)) {
            return null;
        }
        try {
            File target = new File(cacheDirectory, fileName).getCanonicalFile();
            return cacheDirectory.equals(target.getParentFile()) ? target : null;
        } catch (IOException | RuntimeException invalidPath) {
            return null;
        }
    }

    private void deleteManagedFile(String fileName) {
        File target = managedFile(fileName);
        if (target != null && target.isFile()) {
            target.delete();
        }
    }

    private void cleanupStaleFiles() {
        if (cacheDirectory == null) {
            return;
        }
        Set<String> active = new HashSet<>();
        synchronized (pickerLock) {
            if (pendingRequest != null && pendingRequest.payloadFileName != null) {
                active.add(pendingRequest.payloadFileName);
            }
            if (pendingResult != null && pendingResult.payloadFileName != null) {
                active.add(pendingResult.payloadFileName);
            }
        }
        File[] files;
        try {
            files = cacheDirectory.listFiles();
        } catch (RuntimeException unavailableCache) {
            return;
        }
        if (files == null) {
            return;
        }
        for (File file : files) {
            String name = file == null ? null : file.getName();
            if (file != null
                    && file.isFile()
                    && LifeHubBackupDocumentPolicy.isManagedCacheFileName(name)
                    && !active.contains(name)) {
                file.delete();
            }
        }
    }

    private void finish(Request request, Result result) {
        boolean claimed = false;
        synchronized (pickerLock) {
            if (!detached && pendingRequest == request) {
                pendingRequest = null;
                pendingResult = result;
                claimed = true;
            }
        }
        deleteManagedFile(request.payloadFileName);
        if (!claimed) {
            deleteManagedFile(result.payloadFileName);
            return;
        }
        dispatchPendingResult();
    }

    private void dispatchPendingResult() {
        final Result result;
        synchronized (pickerLock) {
            if (detached) {
                return;
            }
            result = pendingResult;
        }
        Host currentHost = host;
        if (result == null || currentHost == null) {
            return;
        }

        Result delivered = result;
        String importedJson = null;
        if (result.ok && result.isImport()) {
            try {
                importedJson = validatedJson(readManagedFile(result.payloadFileName));
            } catch (Failure missingState) {
                delivered = Result.failure(
                        result.requestId,
                        result.operation,
                        result.expectedOrigin,
                        "state_lost",
                        "백업 작업 상태를 복구하지 못했어요. 다시 시도해주세요."
                );
            }
        }
        if (!currentHost.dispatchBackupResult(
                delivered.expectedOrigin,
                delivered.toDetail(importedJson)
        )) {
            return;
        }
        synchronized (pickerLock) {
            if (pendingResult != result) {
                return;
            }
            pendingResult = null;
        }
        deleteManagedFile(result.payloadFileName);
    }

    private void discardState() {
        Request request;
        Result result;
        synchronized (pickerLock) {
            request = pendingRequest;
            result = pendingResult;
            pendingRequest = null;
            pendingResult = null;
        }
        if (request != null) {
            deleteManagedFile(request.payloadFileName);
        }
        if (result != null) {
            deleteManagedFile(result.payloadFileName);
        }
    }

    private static final class Failure extends Exception {
        private final String code;
        private final String userMessage;

        private Failure(String code, String userMessage) {
            super(code);
            this.code = code;
            this.userMessage = userMessage;
        }

        private static Failure tooLarge() {
            return new Failure("file_too_large", "백업 파일은 8 MiB 이하여야 해요.");
        }

        private static Failure stateLost() {
            return new Failure(
                    "state_lost",
                    "백업 작업 상태를 복구하지 못했어요. 다시 시도해주세요."
            );
        }
    }

    private static final class Request {
        private static final String EXPORT = "export";
        private static final String IMPORT = "import";
        private static final String REQUEST_ID = "requestId";
        private static final String OPERATION = "operation";
        private static final String EXPECTED_ORIGIN = "expectedOrigin";
        private static final String FILE_NAME = "fileName";
        private static final String PAYLOAD_FILE_NAME = "payloadFileName";

        private final String requestId;
        private final String operation;
        private final String expectedOrigin;
        private final String fileName;
        private final String payloadFileName;

        private Request(
                String requestId,
                String operation,
                String expectedOrigin,
                String fileName,
                String payloadFileName
        ) {
            this.requestId = requestId;
            this.operation = operation;
            this.expectedOrigin = expectedOrigin;
            this.fileName = fileName;
            this.payloadFileName = payloadFileName;
        }

        private static Request exportRequest(
                String requestId,
                String expectedOrigin,
                String fileName,
                String payloadFileName
        ) {
            return new Request(requestId, EXPORT, expectedOrigin, fileName, payloadFileName);
        }

        private static Request importRequest(String requestId, String expectedOrigin) {
            return new Request(requestId, IMPORT, expectedOrigin, null, null);
        }

        private boolean isExport() {
            return EXPORT.equals(operation);
        }

        private int requestCode() {
            return isExport() ? EXPORT_REQUEST_CODE : IMPORT_REQUEST_CODE;
        }

        private Bundle toBundle() {
            Bundle value = new Bundle();
            value.putString(REQUEST_ID, requestId);
            value.putString(OPERATION, operation);
            value.putString(EXPECTED_ORIGIN, expectedOrigin);
            value.putString(FILE_NAME, fileName);
            value.putString(PAYLOAD_FILE_NAME, payloadFileName);
            return value;
        }

        private static Request fromBundle(Bundle value, String expectedLocalOrigin) {
            if (value == null) {
                return null;
            }
            String requestId = value.getString(REQUEST_ID);
            String operation = value.getString(OPERATION);
            String expectedOrigin = value.getString(EXPECTED_ORIGIN);
            String fileName = value.getString(FILE_NAME);
            String payloadFileName = value.getString(PAYLOAD_FILE_NAME);
            if (!AppNotificationCoordinator.isValidRequestId(requestId)
                    || expectedLocalOrigin == null
                    || !expectedLocalOrigin.equals(expectedOrigin)) {
                return null;
            }
            if (EXPORT.equals(operation)) {
                String normalized = LifeHubBackupDocumentPolicy.normalizeFileName(fileName);
                return normalized != null
                        && normalized.equals(fileName)
                        && LifeHubBackupDocumentPolicy.isManagedCacheFileName(payloadFileName)
                        ? exportRequest(requestId, expectedOrigin, fileName, payloadFileName)
                        : null;
            }
            return IMPORT.equals(operation) && fileName == null && payloadFileName == null
                    ? importRequest(requestId, expectedOrigin)
                    : null;
        }
    }

    private static final class Result {
        private static final String REQUEST_ID = "requestId";
        private static final String OPERATION = "operation";
        private static final String EXPECTED_ORIGIN = "expectedOrigin";
        private static final String OK = "ok";
        private static final String CANCELLED = "cancelled";
        private static final String FILE_NAME = "fileName";
        private static final String BYTE_COUNT = "byteCount";
        private static final String ERROR_CODE = "errorCode";
        private static final String ERROR_MESSAGE = "errorMessage";
        private static final String PAYLOAD_FILE_NAME = "payloadFileName";

        private final String requestId;
        private final String operation;
        private final String expectedOrigin;
        private final boolean ok;
        private final boolean cancelled;
        private final String fileName;
        private final int byteCount;
        private final String errorCode;
        private final String errorMessage;
        private final String payloadFileName;

        private Result(
                String requestId,
                String operation,
                String expectedOrigin,
                boolean ok,
                boolean cancelled,
                String fileName,
                int byteCount,
                String errorCode,
                String errorMessage,
                String payloadFileName
        ) {
            this.requestId = requestId;
            this.operation = operation;
            this.expectedOrigin = expectedOrigin;
            this.ok = ok;
            this.cancelled = cancelled;
            this.fileName = fileName;
            this.byteCount = byteCount;
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
            this.payloadFileName = payloadFileName;
        }

        private static Result successfulExport(Request request, int byteCount) {
            return new Result(
                    request.requestId,
                    request.operation,
                    request.expectedOrigin,
                    true,
                    false,
                    request.fileName,
                    byteCount,
                    null,
                    null,
                    null
            );
        }

        private static Result successfulImport(
                Request request,
                String payloadFileName,
                int byteCount
        ) {
            return new Result(
                    request.requestId,
                    request.operation,
                    request.expectedOrigin,
                    true,
                    false,
                    null,
                    byteCount,
                    null,
                    null,
                    payloadFileName
            );
        }

        private static Result cancelled(Request request) {
            return new Result(
                    request.requestId,
                    request.operation,
                    request.expectedOrigin,
                    false,
                    true,
                    request.fileName,
                    0,
                    "cancelled",
                    "JSON 문서 선택을 취소했어요.",
                    null
            );
        }

        private static Result failure(Request request, String code, String message) {
            return failure(
                    request.requestId,
                    request.operation,
                    request.expectedOrigin,
                    code,
                    message
            );
        }

        private static Result failure(
                String requestId,
                String operation,
                String expectedOrigin,
                String code,
                String message
        ) {
            return new Result(
                    requestId,
                    operation,
                    expectedOrigin,
                    false,
                    false,
                    null,
                    0,
                    code,
                    message,
                    null
            );
        }

        private boolean isImport() {
            return Request.IMPORT.equals(operation);
        }

        private Bundle toBundle() {
            Bundle value = new Bundle();
            value.putString(REQUEST_ID, requestId);
            value.putString(OPERATION, operation);
            value.putString(EXPECTED_ORIGIN, expectedOrigin);
            value.putBoolean(OK, ok);
            value.putBoolean(CANCELLED, cancelled);
            value.putString(FILE_NAME, fileName);
            value.putInt(BYTE_COUNT, byteCount);
            value.putString(ERROR_CODE, errorCode);
            value.putString(ERROR_MESSAGE, errorMessage);
            value.putString(PAYLOAD_FILE_NAME, payloadFileName);
            return value;
        }

        private static Result fromBundle(Bundle value, String expectedLocalOrigin) {
            if (value == null) {
                return null;
            }
            String requestId = value.getString(REQUEST_ID);
            String operation = value.getString(OPERATION);
            String expectedOrigin = value.getString(EXPECTED_ORIGIN);
            boolean ok = value.getBoolean(OK, false);
            boolean cancelled = value.getBoolean(CANCELLED, false);
            String fileName = value.getString(FILE_NAME);
            int byteCount = value.getInt(BYTE_COUNT, -1);
            String errorCode = value.getString(ERROR_CODE);
            String errorMessage = value.getString(ERROR_MESSAGE);
            String payloadFileName = value.getString(PAYLOAD_FILE_NAME);
            boolean export = Request.EXPORT.equals(operation);
            boolean importOperation = Request.IMPORT.equals(operation);
            if (!AppNotificationCoordinator.isValidRequestId(requestId)
                    || (!export && !importOperation)
                    || expectedLocalOrigin == null
                    || !expectedLocalOrigin.equals(expectedOrigin)
                    || byteCount < 0
                    || byteCount > LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES
                    || (ok && (cancelled || byteCount == 0))) {
                return null;
            }
            if (ok) {
                if (errorCode != null || errorMessage != null) {
                    return null;
                }
                if (export) {
                    String normalized = LifeHubBackupDocumentPolicy.normalizeFileName(fileName);
                    if (normalized == null
                            || !normalized.equals(fileName)
                            || payloadFileName != null) {
                        return null;
                    }
                } else if (fileName != null
                        || !LifeHubBackupDocumentPolicy.isManagedCacheFileName(payloadFileName)) {
                    return null;
                }
            } else if (!isSafeErrorCode(errorCode)
                    || errorMessage == null
                    || errorMessage.length() == 0
                    || errorMessage.length() > 240
                    || payloadFileName != null
                    || byteCount != 0
                    || cancelled != "cancelled".equals(errorCode)) {
                return null;
            } else if (cancelled && export) {
                String normalized = LifeHubBackupDocumentPolicy.normalizeFileName(fileName);
                if (normalized == null || !normalized.equals(fileName)) {
                    return null;
                }
            } else if (fileName != null) {
                return null;
            }
            return new Result(
                    requestId,
                    operation,
                    expectedOrigin,
                    ok,
                    cancelled,
                    fileName,
                    byteCount,
                    errorCode,
                    errorMessage,
                    payloadFileName
            );
        }

        private static boolean isSafeErrorCode(String value) {
            if (value == null || value.length() == 0 || value.length() > 64) {
                return false;
            }
            for (int index = 0; index < value.length(); index += 1) {
                char character = value.charAt(index);
                if (!(character >= 'a' && character <= 'z'
                        || character >= 'A' && character <= 'Z'
                        || character >= '0' && character <= '9'
                        || character == '.'
                        || character == '_'
                        || character == '-'
                        || character == ':')) {
                    return false;
                }
            }
            return true;
        }

        private JSONObject toDetail(String importedJson) {
            JSONObject detail = new JSONObject();
            try {
                detail.put("requestId", requestId);
                detail.put("operation", operation);
                detail.put("ok", ok);
                detail.put("cancelled", cancelled);
                detail.put("bytes", byteCount);
                if (fileName != null) {
                    detail.put("fileName", fileName);
                }
                if (ok && isImport() && importedJson != null) {
                    detail.put("json", importedJson);
                }
                if (errorCode == null) {
                    detail.put("error", JSONObject.NULL);
                } else {
                    JSONObject error = new JSONObject();
                    error.put("code", errorCode);
                    error.put("message", errorMessage);
                    detail.put("error", error);
                }
            } catch (JSONException impossible) {
                return new JSONObject();
            }
            return detail;
        }
    }
}
