package com.platform.aiassitant;

import android.webkit.JavascriptInterface;

import java.lang.reflect.Method;
import java.util.Arrays;

public final class FinanceSharePolicyStaticTest {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef";

    private FinanceSharePolicyStaticTest() {}

    public static void main(String[] args) throws Exception {
        require(FinanceSharePolicy.MAX_DOCUMENT_BYTES == 8 * 1024 * 1024);
        require(FinanceSharePolicy.CACHE_RETENTION_MILLIS == 24L * 60L * 60L * 1000L);
        require(FinanceSharePolicy.JSON_MIME_TYPE.equals(
                FinanceSharePolicy.normalizeMimeType(" APPLICATION/JSON ")
        ));
        require(FinanceSharePolicy.CSV_MIME_TYPE.equals(
                FinanceSharePolicy.normalizeMimeType("text/csv")
        ));
        require(FinanceSharePolicy.normalizeMimeType("text/plain") == null);
        require(FinanceSharePolicy.normalizeMimeType(null) == null);

        require("Orbit-finance.json".equals(FinanceSharePolicy.normalizeFileName(
                "Orbit-finance",
                FinanceSharePolicy.JSON_MIME_TYPE
        )));
        require("Orbit 가계부.CSV".equals(FinanceSharePolicy.normalizeFileName(
                " Orbit 가계부.CSV ",
                FinanceSharePolicy.CSV_MIME_TYPE
        )));
        require(FinanceSharePolicy.normalizeFileName(
                "../finance.json",
                FinanceSharePolicy.JSON_MIME_TYPE
        ) == null);
        require(FinanceSharePolicy.normalizeFileName(
                "folder\\finance.json",
                FinanceSharePolicy.JSON_MIME_TYPE
        ) == null);
        require(FinanceSharePolicy.normalizeFileName(
                "bad\nname.json",
                FinanceSharePolicy.JSON_MIME_TYPE
        ) == null);
        require(FinanceSharePolicy.normalizeFileName(
                "finance\u202egpj.json",
                FinanceSharePolicy.JSON_MIME_TYPE
        ) == null);
        require(FinanceSharePolicy.normalizeFileName(
                ".json",
                FinanceSharePolicy.JSON_MIME_TYPE
        ) == null);

        require(FinanceSharePolicy.isValidToken(TOKEN));
        require(!FinanceSharePolicy.isValidToken(TOKEN.toUpperCase()));
        require(!FinanceSharePolicy.isValidToken("../" + TOKEN));
        require((FinanceSharePolicy.CACHE_FILE_PREFIX + TOKEN + ".json").equals(
                FinanceSharePolicy.managedCacheFileName(
                        TOKEN,
                        FinanceSharePolicy.JSON_MIME_TYPE
                )
        ));
        require(FinanceSharePolicy.isManagedCacheFileName(
                FinanceSharePolicy.CACHE_FILE_PREFIX + TOKEN + ".csv"
        ));
        require(!FinanceSharePolicy.isManagedCacheFileName(
                FinanceSharePolicy.CACHE_FILE_PREFIX + "../" + TOKEN + ".json"
        ));

        require(FinanceSharePolicy.isAllowedContent(
                "{\"product\":\"OrbitFinance\",\"entries\":[]}",
                FinanceSharePolicy.JSON_MIME_TYPE
        ));
        require(!FinanceSharePolicy.isAllowedContent(
                "{\"product\":\"OrbitFinance\",}",
                FinanceSharePolicy.JSON_MIME_TYPE
        ));
        require(!FinanceSharePolicy.isAllowedContent(
                "[1,2,3]",
                FinanceSharePolicy.JSON_MIME_TYPE
        ));
        require(FinanceSharePolicy.isAllowedContent(
                "날짜,유형,금액\r\n2026-08-23,지출,12000\r\n",
                FinanceSharePolicy.CSV_MIME_TYPE
        ));
        require(!FinanceSharePolicy.isAllowedContent(
                "날짜,금액\u0000",
                FinanceSharePolicy.CSV_MIME_TYPE
        ));
        require(!FinanceSharePolicy.isAllowedContent(
                "bad\ud800",
                FinanceSharePolicy.CSV_MIME_TYPE
        ));

        FinanceSharePolicy.ParsedPath path = FinanceSharePolicy.parsePathSegments(
                Arrays.asList(TOKEN, "Orbit 가계부.JSON")
        );
        require(path != null);
        require(TOKEN.equals(path.token));
        require("Orbit 가계부.JSON".equals(path.fileName));
        require(FinanceSharePolicy.JSON_MIME_TYPE.equals(path.mimeType));
        require((FinanceSharePolicy.CACHE_FILE_PREFIX + TOKEN + ".json").equals(
                path.cacheFileName
        ));
        require(FinanceSharePolicy.parsePathSegments(
                Arrays.asList(TOKEN, "Orbit.json", "extra")
        ) == null);
        require(FinanceSharePolicy.parsePathSegments(
                Arrays.asList(TOKEN, "../Orbit.json")
        ) == null);

        Class<?> nativeBridge = null;
        for (Class<?> candidate : MainActivity.class.getDeclaredClasses()) {
            if ("NativeBridge".equals(candidate.getSimpleName())) {
                nativeBridge = candidate;
                break;
            }
        }
        require(nativeBridge != null);
        Method share = nativeBridge.getDeclaredMethod(
                "shareFinanceFile",
                String.class,
                String.class,
                String.class
        );
        require(share.getReturnType() == boolean.class);
        require(share.getAnnotation(JavascriptInterface.class) != null);

        FinanceShareCoordinator.class.getDeclaredMethod(
                "share",
                String.class,
                String.class,
                String.class,
                String.class
        );
        FinanceShareFileProvider.class.getDeclaredMethod(
                "openFile",
                android.net.Uri.class,
                String.class
        );
    }

    private static void require(boolean condition) {
        if (!condition) {
            throw new AssertionError("Finance share policy invariant failed");
        }
    }
}
