package com.platform.aiassitant;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public final class LifeHubBackupDocumentPolicyStaticTest {
    private LifeHubBackupDocumentPolicyStaticTest() {}

    public static void main(String[] args) throws Exception {
        require(LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES == 8 * 1024 * 1024);
        require(LifeHubBackupDocumentPolicy.hasAllowedMimeType("application/json"));
        require(LifeHubBackupDocumentPolicy.hasAllowedMimeType(" APPLICATION/JSON "));
        require(!LifeHubBackupDocumentPolicy.hasAllowedMimeType("text/json"));
        require(!LifeHubBackupDocumentPolicy.hasAllowedMimeType(null));
        require(LifeHubBackupDocumentPolicy.acceptsRequestedTypes(
                new String[]{"application/json", ".json"}
        ));
        require(LifeHubBackupDocumentPolicy.acceptsRequestedTypes(
                new String[]{" APPLICATION/JSON,.JSON "}
        ));
        require(!LifeHubBackupDocumentPolicy.acceptsRequestedTypes(null));
        require(!LifeHubBackupDocumentPolicy.acceptsRequestedTypes(new String[]{""}));
        require(!LifeHubBackupDocumentPolicy.acceptsRequestedTypes(
                new String[]{"application/json", "text/plain"}
        ));
        require(!LifeHubBackupDocumentPolicy.acceptsRequestedTypes(
                new String[]{"image/*"}
        ));

        require(LifeHubBackupDocumentPolicy.isAllowedReportedLength(-1L));
        require(LifeHubBackupDocumentPolicy.isAllowedReportedLength(
                LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES
        ));
        require(!LifeHubBackupDocumentPolicy.isAllowedReportedLength(
                LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES + 1L
        ));
        char[] atLimit = new char[LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES];
        Arrays.fill(atLimit, 'a');
        require(LifeHubBackupDocumentPolicy.isWithinByteLimit(new String(atLimit)));
        require(!LifeHubBackupDocumentPolicy.isWithinByteLimit(new String(atLimit) + "a"));
        assertStreamLimit();

        require("lifehub-backup.json".equals(
                LifeHubBackupDocumentPolicy.normalizeFileName("lifehub-backup")
        ));
        require("Orbit 백업.JSON".equals(
                LifeHubBackupDocumentPolicy.normalizeFileName(" Orbit 백업.JSON ")
        ));
        require(LifeHubBackupDocumentPolicy.normalizeFileName("../backup.json") == null);
        require(LifeHubBackupDocumentPolicy.normalizeFileName("folder\\backup.json") == null);
        require(LifeHubBackupDocumentPolicy.normalizeFileName("bad\nname.json") == null);
        require(LifeHubBackupDocumentPolicy.normalizeFileName("backup\u202egpj.json") == null);
        require(LifeHubBackupDocumentPolicy.normalizeFileName(".json") == null);
        char[] longName = new char[LifeHubBackupDocumentPolicy.MAX_FILE_NAME_LENGTH];
        Arrays.fill(longName, 'a');
        require(LifeHubBackupDocumentPolicy.normalizeFileName(new String(longName)) == null);

        require(LifeHubBackupDocumentPolicy.hasJsonObjectEnvelope(" {\"product\":\"Orbit\"} "));
        require(!LifeHubBackupDocumentPolicy.hasJsonObjectEnvelope("[]"));
        require(!LifeHubBackupDocumentPolicy.hasJsonObjectEnvelope("not-json"));
        require(LifeHubBackupDocumentPolicy.isStrictJsonObject(
                " {\"text\":\"line\\n\\uD55C\",\"values\":[-1.25e+2,true,false,null,{}]} "
        ));
        require(LifeHubBackupDocumentPolicy.isStrictJsonObject("{\"emoji\":\"\ud83d\ude80\"}"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("{\"bad\":\"\ud800\"}"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("[]"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("{'legacy':true}"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("{unquoted:true}"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("{\"value\":01}"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("{\"value\":NaN}"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("{\"value\":1,}"));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject("{/*comment*/\"value\":1}"));
        require(LifeHubBackupDocumentPolicy.isStrictJsonObject(nestedJson(127)));
        require(!LifeHubBackupDocumentPolicy.isStrictJsonObject(nestedJson(128)));

        String korean = "{\"memo\":\"생활 기록\"}";
        require(korean.equals(LifeHubBackupDocumentPolicy.decodeUtf8(
                korean.getBytes(StandardCharsets.UTF_8)
        )));
        require("{}".equals(LifeHubBackupDocumentPolicy.decodeUtf8(
                new byte[]{(byte) 0xef, (byte) 0xbb, (byte) 0xbf, '{', '}'}
        )));
        expectInvalidUtf8(new byte[]{(byte) 0xc3, 0x28});

        require(LifeHubBackupDocumentPolicy.isManagedCacheFileName(
                "lifehub-backup-document-1234.json"
        ));
        require(!LifeHubBackupDocumentPolicy.isManagedCacheFileName(
                "../lifehub-backup-document-1234.json"
        ));
        require(!LifeHubBackupDocumentPolicy.isManagedCacheFileName(
                "lifehub-backup-document-1234.tmp"
        ));

        Class<?> nativeBridge = null;
        for (Class<?> candidate : MainActivity.class.getDeclaredClasses()) {
            if ("NativeBridge".equals(candidate.getSimpleName())) {
                nativeBridge = candidate;
                break;
            }
        }
        require(nativeBridge != null);
        assertJavascriptBooleanMethod(
                nativeBridge,
                "exportLifeHubBackup",
                String.class,
                String.class,
                String.class
        );
        assertJavascriptBooleanMethod(nativeBridge, "importLifeHubBackup", String.class);
        MainActivity.class.getDeclaredMethod("onSaveInstanceState", Bundle.class);
        MainActivity.class.getDeclaredMethod(
                "onActivityResult",
                int.class,
                int.class,
                Intent.class
        );
        Field jsonChooserRequestCode = MainActivity.class.getDeclaredField(
                "JSON_FILE_CHOOSER_REQUEST_CODE"
        );
        jsonChooserRequestCode.setAccessible(true);
        require(jsonChooserRequestCode.getInt(null) == 4111);
        MainActivity.class.getDeclaredMethod("onDestroy");
        LifeHubBackupDocumentCoordinator.class.getDeclaredMethod(
                "saveInstanceState",
                Bundle.class
        );
        LifeHubBackupDocumentCoordinator.class.getDeclaredMethod(
                "handleActivityResult",
                int.class,
                int.class,
                Intent.class
        );
        LifeHubBackupDocumentCoordinator.class.getDeclaredMethod(
                "isAllowedImportDocument",
                android.net.Uri.class
        );
        LifeHubBackupDocumentCoordinator.class.getDeclaredMethod("destroy", boolean.class);
    }

    private static void assertJavascriptBooleanMethod(
            Class<?> owner,
            String name,
            Class<?>... parameterTypes
    ) throws Exception {
        Method method = owner.getDeclaredMethod(name, parameterTypes);
        require(method.getReturnType() == boolean.class);
        require(method.getAnnotation(JavascriptInterface.class) != null);
    }

    private static void expectInvalidUtf8(byte[] value) throws Exception {
        try {
            LifeHubBackupDocumentPolicy.decodeUtf8(value);
            throw new AssertionError("invalid UTF-8 was accepted");
        } catch (CharacterCodingException expected) {
            // Expected.
        }
    }

    private static void assertStreamLimit() throws Exception {
        Method readBounded = LifeHubBackupDocumentCoordinator.class.getDeclaredMethod(
                "readBounded",
                java.io.InputStream.class
        );
        readBounded.setAccessible(true);
        byte[] boundary = new byte[LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES];
        byte[] accepted = (byte[]) readBounded.invoke(
                null,
                new ByteArrayInputStream(boundary)
        );
        require(accepted.length == LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES);
        try {
            readBounded.invoke(
                    null,
                    new ByteArrayInputStream(new byte[
                            LifeHubBackupDocumentPolicy.MAX_DOCUMENT_BYTES + 1
                    ])
            );
            throw new AssertionError("oversized streamed document was accepted");
        } catch (InvocationTargetException expected) {
            require("Failure".equals(expected.getCause().getClass().getSimpleName()));
        }
    }

    private static String nestedJson(int arrayCount) {
        StringBuilder value = new StringBuilder("{\"value\":");
        for (int index = 0; index < arrayCount; index += 1) {
            value.append('[');
        }
        value.append('0');
        for (int index = 0; index < arrayCount; index += 1) {
            value.append(']');
        }
        return value.append('}').toString();
    }

    private static void require(boolean condition) {
        if (!condition) {
            throw new AssertionError("LifeHub backup document invariant failed");
        }
    }
}
