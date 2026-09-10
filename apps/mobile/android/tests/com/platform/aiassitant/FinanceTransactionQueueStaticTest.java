package com.platform.aiassitant;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class FinanceTransactionQueueStaticTest {
    private static final String ACTIVE_OWNER_HASH_KEY = "active-owner-hash";
    private static final String LEGACY_COLLECTION_ENABLED_KEY = "collection-enabled";
    private static final String SELECTED_SOURCES_KEY = "selected-sources";
    private static final String PENDING_KEY_PREFIX = "pending:";

    private FinanceTransactionQueueStaticTest() {}

    public static void main(String[] args) {
        verifyLegacySelectionMigration();
        verifySelectionQueueAndResolutionBoundaries();
        verifyTossSelectionAndPurge();
    }

    private static void verifyLegacySelectionMigration() {
        TestContext context = new TestContext();
        String owner = "legacy-owner";
        String ownerHash = FinanceNotificationPolicy.ownerHash(owner);
        FinanceNotificationParser.Candidate samsung = candidate(
                1,
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE,
                "테스트상점"
        );
        FinanceNotificationParser.Candidate kakao = candidate(
                2,
                FinanceNotificationParser.KAKAO_PAY_SOURCE,
                "테스트매장"
        );

        require(context.preferences.edit()
                .putString(ACTIVE_OWNER_HASH_KEY, ownerHash)
                .putBoolean(LEGACY_COLLECTION_ENABLED_KEY, true)
                .putString(
                        PENDING_KEY_PREFIX + ownerHash,
                        FinanceTransactionQueue.publicItems(
                                Arrays.asList(samsung, kakao)
                        ).toString()
                )
                .commit());

        require(FinanceTransactionQueue.isCollectionEnabled(context));
        require(FinanceTransactionQueue.selectedSources(context).equals(
                Collections.singleton(FinanceNotificationParser.SAMSUNG_WALLET_SOURCE)
        ));
        require(!context.preferences.contains(LEGACY_COLLECTION_ENABLED_KEY));
        require("[\"samsung-wallet\"]".equals(
                context.preferences.getString(SELECTED_SOURCES_KEY, "")
        ));
        require(FinanceTransactionQueue.pendingCount(context) == 1);

        require(FinanceTransactionQueue.configure(
                context,
                owner,
                "[\"samsung-wallet\",\"kakao-pay\"]"
        ));
        List<FinanceNotificationParser.Candidate> migrated =
                FinanceTransactionQueue.peek(
                        context,
                        owner,
                        "[\"samsung-wallet\",\"kakao-pay\"]"
                );
        require(migrated != null && migrated.size() == 1);
        require(samsung.eventId.equals(migrated.get(0).eventId));
    }

    private static void verifySelectionQueueAndResolutionBoundaries() {
        TestContext context = new TestContext();
        String owner = "queue-owner";
        FinanceNotificationParser.Candidate samsung = candidate(
                10,
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE,
                "샘플상점"
        );
        FinanceNotificationParser.Candidate kakao = candidate(
                11,
                FinanceNotificationParser.KAKAO_PAY_SOURCE,
                "샘플매장"
        );
        FinanceNotificationParser.Candidate secondKakao = candidate(
                12,
                FinanceNotificationParser.KAKAO_PAY_SOURCE,
                "예시상점"
        );

        require(FinanceTransactionQueue.configure(
                context,
                owner,
                "[\"kakao-pay\",\"samsung-wallet\"]"
        ));
        require(FinanceTransactionQueue.selectedSources(context).equals(
                new LinkedHashSet<>(Arrays.asList(
                        FinanceNotificationParser.SAMSUNG_WALLET_SOURCE,
                        FinanceNotificationParser.KAKAO_PAY_SOURCE
                ))
        ));
        require(FinanceTransactionQueue.isSourceSelected(
                context,
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE
        ));
        require(FinanceTransactionQueue.isSourceSelected(
                context,
                FinanceNotificationParser.KAKAO_PAY_SOURCE
        ));
        require(FinanceTransactionQueue.enqueue(context, samsung));
        require(FinanceTransactionQueue.enqueue(context, kakao));
        require(FinanceTransactionQueue.pendingCount(context) == 2);

        require(FinanceTransactionQueue.configure(
                context,
                owner,
                "[\"samsung-wallet\"]"
        ));
        require(FinanceTransactionQueue.pendingCount(context) == 1);
        List<FinanceNotificationParser.Candidate> selectedIntersection =
                FinanceTransactionQueue.peek(
                        context,
                        owner,
                        "[\"samsung-wallet\",\"kakao-pay\"]"
                );
        require(selectedIntersection != null && selectedIntersection.size() == 1);
        require(samsung.eventId.equals(selectedIntersection.get(0).eventId));
        List<FinanceNotificationParser.Candidate> deselectedOnly =
                FinanceTransactionQueue.peek(
                        context,
                        owner,
                        "[\"kakao-pay\"]"
                );
        require(deselectedOnly != null && deselectedOnly.isEmpty());

        require(FinanceTransactionQueue.configure(
                context,
                owner,
                "[\"samsung-wallet\",\"kakao-pay\"]"
        ));
        require(!FinanceTransactionQueue.enqueue(context, kakao));
        require(FinanceTransactionQueue.pendingCount(context) == 1);
        require(FinanceTransactionQueue.enqueue(context, secondKakao));
        require(FinanceTransactionQueue.pendingCount(context) == 2);

        require(FinanceTransactionQueue.resolve(
                context,
                owner,
                Collections.singleton("invalid-event-id")
        ) == null);
        require(FinanceTransactionQueue.resolve(
                context,
                "different-owner",
                Collections.singleton(samsung.eventId)
        ) == null);
        LinkedHashSet<String> partiallyUnknown = new LinkedHashSet<>();
        partiallyUnknown.add(samsung.eventId);
        partiallyUnknown.add(eventId(99));
        require(FinanceTransactionQueue.resolve(
                context,
                owner,
                partiallyUnknown
        ) == null);
        require(FinanceTransactionQueue.pendingCount(context) == 2);

        List<String> resolvedSamsung = FinanceTransactionQueue.resolve(
                context,
                owner,
                Collections.singleton(samsung.eventId)
        );
        require(resolvedSamsung != null);
        require(resolvedSamsung.equals(Collections.singletonList(samsung.eventId)));
        require(FinanceTransactionQueue.pendingCount(context) == 1);
        require(FinanceTransactionQueue.resolve(
                context,
                owner,
                Collections.singleton(samsung.eventId)
        ) == null);

        List<String> resolvedKakao = FinanceTransactionQueue.resolve(
                context,
                owner,
                Collections.singleton(secondKakao.eventId)
        );
        require(resolvedKakao != null);
        require(resolvedKakao.equals(Collections.singletonList(secondKakao.eventId)));
        require(FinanceTransactionQueue.pendingCount(context) == 0);
    }

    private static void verifyTossSelectionAndPurge() {
        TestContext context = new TestContext();
        String owner = "toss-owner";
        FinanceNotificationParser.Candidate toss = candidate(
                20,
                FinanceNotificationParser.TOSS_SOURCE,
                "토스상점"
        );

        require(FinanceTransactionQueue.configure(
                context,
                owner,
                "[\"toss\"]"
        ));
        require(FinanceTransactionQueue.selectedSources(context).equals(
                Collections.singleton(FinanceNotificationParser.TOSS_SOURCE)
        ));
        require(FinanceTransactionQueue.isSourceSelected(
                context,
                FinanceNotificationParser.TOSS_SOURCE
        ));
        require(FinanceTransactionQueue.enqueue(context, toss));
        List<FinanceNotificationParser.Candidate> pending =
                FinanceTransactionQueue.peek(context, owner, "[\"toss\"]");
        require(pending != null && pending.size() == 1);
        require(toss.eventId.equals(pending.get(0).eventId));

        require(FinanceTransactionQueue.configure(context, owner, "[]"));
        require(FinanceTransactionQueue.pendingCount(context) == 0);
        require(!FinanceTransactionQueue.isSourceSelected(
                context,
                FinanceNotificationParser.TOSS_SOURCE
        ));
        require(!FinanceTransactionQueue.enqueue(context, toss));
    }

    private static FinanceNotificationParser.Candidate candidate(
            int index,
            String source,
            String merchant
    ) {
        return new FinanceNotificationParser.Candidate(
                eventId(index),
                source,
                1_000L + index,
                merchant,
                1_750_000_000_000L + index,
                false
        );
    }

    private static String eventId(int index) {
        return "fn-" + String.format("%064x", index + 1L);
    }

    private static void require(boolean condition) {
        if (!condition) {
            throw new AssertionError("Finance transaction queue invariant failed");
        }
    }

    private static final class TestContext extends ContextWrapper {
        final MemorySharedPreferences preferences = new MemorySharedPreferences();

        TestContext() {
            super(null);
        }

        @Override
        public Context getApplicationContext() {
            return this;
        }

        @Override
        public SharedPreferences getSharedPreferences(String name, int mode) {
            require("orbit-finance-notification-v2".equals(name));
            require(mode == Context.MODE_PRIVATE);
            return preferences;
        }
    }

    private static final class MemorySharedPreferences implements SharedPreferences {
        private final Map<String, Object> values = new LinkedHashMap<>();
        private final Set<OnSharedPreferenceChangeListener> listeners =
                new LinkedHashSet<>();

        @Override
        public synchronized Map<String, ?> getAll() {
            return new LinkedHashMap<>(values);
        }

        @Override
        public synchronized String getString(String key, String defaultValue) {
            Object value = values.get(key);
            if (value == null && !values.containsKey(key)) {
                return defaultValue;
            }
            if (value == null || value instanceof String) {
                return (String) value;
            }
            throw new ClassCastException(key);
        }

        @Override
        @SuppressWarnings("unchecked")
        public synchronized Set<String> getStringSet(
                String key,
                Set<String> defaultValues
        ) {
            Object value = values.get(key);
            if (value == null && !values.containsKey(key)) {
                return defaultValues;
            }
            if (!(value instanceof Set)) {
                throw new ClassCastException(key);
            }
            return new LinkedHashSet<>((Set<String>) value);
        }

        @Override
        public synchronized int getInt(String key, int defaultValue) {
            Object value = values.get(key);
            if (value == null && !values.containsKey(key)) {
                return defaultValue;
            }
            if (value instanceof Integer) {
                return (Integer) value;
            }
            throw new ClassCastException(key);
        }

        @Override
        public synchronized long getLong(String key, long defaultValue) {
            Object value = values.get(key);
            if (value == null && !values.containsKey(key)) {
                return defaultValue;
            }
            if (value instanceof Long) {
                return (Long) value;
            }
            throw new ClassCastException(key);
        }

        @Override
        public synchronized float getFloat(String key, float defaultValue) {
            Object value = values.get(key);
            if (value == null && !values.containsKey(key)) {
                return defaultValue;
            }
            if (value instanceof Float) {
                return (Float) value;
            }
            throw new ClassCastException(key);
        }

        @Override
        public synchronized boolean getBoolean(String key, boolean defaultValue) {
            Object value = values.get(key);
            if (value == null && !values.containsKey(key)) {
                return defaultValue;
            }
            if (value instanceof Boolean) {
                return (Boolean) value;
            }
            throw new ClassCastException(key);
        }

        @Override
        public synchronized boolean contains(String key) {
            return values.containsKey(key);
        }

        @Override
        public Editor edit() {
            return new MemoryEditor();
        }

        @Override
        public synchronized void registerOnSharedPreferenceChangeListener(
                OnSharedPreferenceChangeListener listener
        ) {
            if (listener != null) {
                listeners.add(listener);
            }
        }

        @Override
        public synchronized void unregisterOnSharedPreferenceChangeListener(
                OnSharedPreferenceChangeListener listener
        ) {
            listeners.remove(listener);
        }

        private final class MemoryEditor implements Editor {
            private final Map<String, Object> updates = new LinkedHashMap<>();
            private final Set<String> removals = new LinkedHashSet<>();
            private boolean clearRequested;

            @Override
            public Editor putString(String key, String value) {
                updates.put(key, value);
                removals.remove(key);
                return this;
            }

            @Override
            public Editor putStringSet(String key, Set<String> value) {
                updates.put(key, value == null ? null : new LinkedHashSet<>(value));
                removals.remove(key);
                return this;
            }

            @Override
            public Editor putInt(String key, int value) {
                return putValue(key, value);
            }

            @Override
            public Editor putLong(String key, long value) {
                return putValue(key, value);
            }

            @Override
            public Editor putFloat(String key, float value) {
                return putValue(key, value);
            }

            @Override
            public Editor putBoolean(String key, boolean value) {
                return putValue(key, value);
            }

            private Editor putValue(String key, Object value) {
                updates.put(key, value);
                removals.remove(key);
                return this;
            }

            @Override
            public Editor remove(String key) {
                updates.remove(key);
                removals.add(key);
                return this;
            }

            @Override
            public Editor clear() {
                clearRequested = true;
                updates.clear();
                removals.clear();
                return this;
            }

            @Override
            public boolean commit() {
                List<String> changed = new ArrayList<>();
                List<OnSharedPreferenceChangeListener> currentListeners;
                synchronized (MemorySharedPreferences.this) {
                    if (clearRequested) {
                        changed.addAll(values.keySet());
                        values.clear();
                    }
                    for (String key : removals) {
                        if (values.containsKey(key)) {
                            values.remove(key);
                            changed.add(key);
                        }
                    }
                    for (Map.Entry<String, Object> update : updates.entrySet()) {
                        values.put(update.getKey(), update.getValue());
                        changed.add(update.getKey());
                    }
                    currentListeners = new ArrayList<>(listeners);
                }
                for (OnSharedPreferenceChangeListener listener : currentListeners) {
                    for (String key : changed) {
                        listener.onSharedPreferenceChanged(
                                MemorySharedPreferences.this,
                                key
                        );
                    }
                }
                return true;
            }

            @Override
            public void apply() {
                commit();
            }
        }
    }
}
