package com.platform.aiassitant;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class FinanceTransactionQueue {
    private static final String PREFERENCES_NAME = "orbit-finance-notification-v2";
    private static final String KEY_ACTIVE_OWNER_HASH = "active-owner-hash";
    private static final String KEY_COLLECTION_ENABLED = "collection-enabled";
    private static final String KEY_SELECTED_SOURCES = "selected-sources";
    private static final String QUEUE_KEY_PREFIX = "pending:";
    private static final String SEEN_KEY_PREFIX = "seen:";

    private FinanceTransactionQueue() {}

    static synchronized boolean configure(
            Context context,
            String owner,
            String sourcesJson
    ) {
        String ownerHash = FinanceNotificationPolicy.ownerHash(owner);
        LinkedHashSet<String> selectedSources = FinanceNotificationPolicy.selectedSources(
                sourcesJson
        );
        if (context == null || ownerHash == null || selectedSources == null) {
            return false;
        }
        SharedPreferences preferences = preferences(context);
        List<FinanceNotificationParser.Candidate> kept = candidatesForSources(
                readPending(preferences, ownerHash),
                selectedSources,
                FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS
        );
        return preferences.edit()
                .putString(KEY_ACTIVE_OWNER_HASH, ownerHash)
                .putString(KEY_SELECTED_SOURCES, encodeStrings(selectedSources))
                .putString(queueKey(ownerHash), encodePending(kept))
                .remove(KEY_COLLECTION_ENABLED)
                .commit();
    }

    static synchronized boolean isCollectionEnabled(Context context) {
        if (context == null) {
            return false;
        }
        SharedPreferences preferences = preferences(context);
        String ownerHash = activeOwnerHash(preferences);
        return isOwnerHash(ownerHash)
                && !configuredSources(preferences).isEmpty();
    }

    static synchronized boolean isSourceSelected(Context context, String source) {
        if (context == null || !FinanceNotificationParser.isSupportedSource(source)) {
            return false;
        }
        SharedPreferences preferences = preferences(context);
        String ownerHash = activeOwnerHash(preferences);
        return isOwnerHash(ownerHash) && configuredSources(preferences).contains(source);
    }

    static synchronized Set<String> selectedSources(Context context) {
        LinkedHashSet<String> selected = new LinkedHashSet<>();
        if (context == null) {
            return selected;
        }
        SharedPreferences preferences = preferences(context);
        String ownerHash = activeOwnerHash(preferences);
        if (isOwnerHash(ownerHash)) {
            selected.addAll(configuredSources(preferences));
        }
        return selected;
    }

    static synchronized boolean enqueue(
            Context context,
            FinanceNotificationParser.Candidate candidate
    ) {
        if (context == null || !FinanceNotificationPolicy.isValidCandidate(candidate)) {
            return false;
        }
        SharedPreferences preferences = preferences(context);
        String ownerHash = activeOwnerHash(preferences);
        if (!isOwnerHash(ownerHash)
                || !configuredSources(preferences).contains(candidate.source)) {
            return false;
        }

        List<FinanceNotificationParser.Candidate> pending = readPending(
                preferences,
                ownerHash
        );
        LinkedHashSet<String> seen = readSeen(preferences, ownerHash);
        if (seen.contains(candidate.eventId)
                || !FinanceNotificationPolicy.appendBounded(pending, candidate)) {
            return false;
        }
        seen.add(candidate.eventId);
        trimSeen(seen);
        return preferences.edit()
                .putString(queueKey(ownerHash), encodePending(pending))
                .putString(seenKey(ownerHash), encodeStrings(seen))
                .commit();
    }

    static synchronized List<FinanceNotificationParser.Candidate> peek(
            Context context,
            String owner,
            String sourcesJson
    ) {
        String ownerHash = FinanceNotificationPolicy.ownerHash(owner);
        LinkedHashSet<String> requestedSources = FinanceNotificationPolicy.selectedSources(
                sourcesJson
        );
        if (context == null || ownerHash == null || requestedSources == null) {
            return null;
        }
        SharedPreferences preferences = preferences(context);
        if (!ownerHash.equals(activeOwnerHash(preferences))) {
            return null;
        }
        requestedSources.retainAll(configuredSources(preferences));
        if (requestedSources.isEmpty()) {
            return new ArrayList<>();
        }
        return candidatesForSources(
                readPending(preferences, ownerHash),
                requestedSources,
                FinanceNotificationPolicy.MAX_IMPORT_BATCH
        );
    }

    static synchronized List<String> resolve(
            Context context,
            String owner,
            Set<String> eventIds
    ) {
        String ownerHash = FinanceNotificationPolicy.ownerHash(owner);
        if (context == null
                || ownerHash == null
                || eventIds == null
                || eventIds.size() > FinanceNotificationPolicy.MAX_IMPORT_BATCH) {
            return null;
        }
        for (String eventId : eventIds) {
            if (!FinanceNotificationPolicy.isValidEventId(eventId)) {
                return null;
            }
        }
        SharedPreferences preferences = preferences(context);
        if (!ownerHash.equals(activeOwnerHash(preferences))) {
            return null;
        }
        LinkedHashSet<String> configured = configuredSources(preferences);
        if (configured.isEmpty() && !eventIds.isEmpty()) {
            return null;
        }

        List<FinanceNotificationParser.Candidate> pending = readPending(
                preferences,
                ownerHash
        );
        LinkedHashSet<String> resolvable = new LinkedHashSet<>();
        for (FinanceNotificationParser.Candidate candidate : pending) {
            if (configured.contains(candidate.source) && eventIds.contains(candidate.eventId)) {
                resolvable.add(candidate.eventId);
            }
        }
        if (!resolvable.equals(eventIds)) {
            return null;
        }
        List<FinanceNotificationParser.Candidate> kept = new ArrayList<>();
        List<String> resolved = new ArrayList<>();
        for (FinanceNotificationParser.Candidate candidate : pending) {
            if (resolvable.contains(candidate.eventId)) {
                resolved.add(candidate.eventId);
            } else {
                kept.add(candidate);
            }
        }
        if (resolved.isEmpty()) {
            return resolved;
        }
        if (!preferences.edit()
                .putString(queueKey(ownerHash), encodePending(kept))
                .commit()) {
            return null;
        }
        return resolved;
    }

    static synchronized int pendingCount(Context context) {
        if (context == null) {
            return 0;
        }
        SharedPreferences preferences = preferences(context);
        String ownerHash = activeOwnerHash(preferences);
        if (!isOwnerHash(ownerHash)) {
            return 0;
        }
        return candidatesForSources(
                readPending(preferences, ownerHash),
                configuredSources(preferences),
                FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS
        ).size();
    }

    static synchronized boolean isSelectedForOwner(Context context, String owner) {
        String ownerHash = FinanceNotificationPolicy.ownerHash(owner);
        if (context == null || ownerHash == null) {
            return false;
        }
        SharedPreferences preferences = preferences(context);
        return ownerHash.equals(activeOwnerHash(preferences))
                && !configuredSources(preferences).isEmpty();
    }

    static JSONArray publicItems(List<FinanceNotificationParser.Candidate> candidates) {
        JSONArray items = new JSONArray();
        if (candidates == null) {
            return items;
        }
        for (FinanceNotificationParser.Candidate candidate : candidates) {
            if (!FinanceNotificationPolicy.isValidCandidate(candidate)) {
                continue;
            }
            JSONObject item = new JSONObject();
            try {
                item.put("eventId", candidate.eventId);
                item.put("source", candidate.source);
                item.put("amount", candidate.amount);
                item.put("merchant", candidate.merchant);
                item.put("occurredAt", candidate.occurredAt);
                items.put(item);
            } catch (JSONException impossible) {
                return new JSONArray();
            }
        }
        return items;
    }

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(
                PREFERENCES_NAME,
                Context.MODE_PRIVATE
        );
    }

    private static List<FinanceNotificationParser.Candidate> readPending(
            SharedPreferences preferences,
            String ownerHash
    ) {
        List<FinanceNotificationParser.Candidate> result = new ArrayList<>();
        String encoded;
        try {
            encoded = preferences.getString(queueKey(ownerHash), "[]");
        } catch (ClassCastException invalidQueueType) {
            return result;
        }
        try {
            JSONArray array = new JSONArray(encoded == null ? "[]" : encoded);
            int length = Math.min(array.length(), FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS);
            for (int index = 0; index < length; index += 1) {
                FinanceNotificationParser.Candidate candidate = decodeCandidate(
                        array.optJSONObject(index)
                );
                if (FinanceNotificationPolicy.isValidCandidate(candidate)
                        && !FinanceNotificationPolicy.containsEventId(
                                result,
                                candidate.eventId
                        )) {
                    result.add(candidate);
                }
            }
        } catch (JSONException invalidQueue) {
            return new ArrayList<>();
        }
        return result;
    }

    private static FinanceNotificationParser.Candidate decodeCandidate(JSONObject item) {
        if (item == null) {
            return null;
        }
        String eventId = item.optString("eventId", "");
        String source = item.optString("source", "");
        String merchant = item.optString("merchant", "");
        long amount = item.optLong("amount", 0L);
        long occurredAt = item.optLong("occurredAt", 0L);
        return new FinanceNotificationParser.Candidate(
                eventId,
                source,
                amount,
                merchant,
                occurredAt,
                isFallbackMerchant(source, merchant)
        );
    }

    private static List<FinanceNotificationParser.Candidate> candidatesForSources(
            List<FinanceNotificationParser.Candidate> candidates,
            Set<String> sources,
            int limit
    ) {
        List<FinanceNotificationParser.Candidate> result = new ArrayList<>();
        if (candidates == null || sources == null || sources.isEmpty() || limit <= 0) {
            return result;
        }
        for (FinanceNotificationParser.Candidate candidate : candidates) {
            if (candidate != null && sources.contains(candidate.source)) {
                result.add(candidate);
                if (result.size() >= limit) {
                    break;
                }
            }
        }
        return result;
    }

    private static LinkedHashSet<String> configuredSources(
            SharedPreferences preferences
    ) {
        if (preferences.contains(KEY_SELECTED_SOURCES)) {
            String encoded;
            try {
                encoded = preferences.getString(KEY_SELECTED_SOURCES, "[]");
            } catch (ClassCastException invalidSelectionType) {
                return new LinkedHashSet<>();
            }
            LinkedHashSet<String> parsed = FinanceNotificationPolicy.selectedSources(encoded);
            return parsed == null ? new LinkedHashSet<String>() : parsed;
        }

        LinkedHashSet<String> migrated = new LinkedHashSet<>();
        boolean legacyEnabled = false;
        try {
            legacyEnabled = preferences.getBoolean(KEY_COLLECTION_ENABLED, false);
        } catch (ClassCastException invalidLegacyValue) {
            legacyEnabled = false;
        }
        if (legacyEnabled) {
            migrated.add(FinanceNotificationParser.SAMSUNG_WALLET_SOURCE);
        }
        SharedPreferences.Editor editor = preferences.edit()
                .putString(KEY_SELECTED_SOURCES, encodeStrings(migrated))
                .remove(KEY_COLLECTION_ENABLED);
        String ownerHash = activeOwnerHash(preferences);
        if (isOwnerHash(ownerHash)) {
            editor.putString(
                    queueKey(ownerHash),
                    encodePending(candidatesForSources(
                            readPending(preferences, ownerHash),
                            migrated,
                            FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS
                    ))
            );
        }
        editor.commit();
        return migrated;
    }

    private static boolean isFallbackMerchant(String source, String merchant) {
        if (FinanceNotificationParser.SAMSUNG_WALLET_SOURCE.equals(source)) {
            return FinanceNotificationParser.SAMSUNG_WALLET_FALLBACK_MERCHANT.equals(merchant);
        }
        if (FinanceNotificationParser.KAKAO_PAY_SOURCE.equals(source)) {
            return FinanceNotificationParser.KAKAO_PAY_FALLBACK_MERCHANT.equals(merchant);
        }
        return false;
    }

    private static String encodePending(
            List<FinanceNotificationParser.Candidate> candidates
    ) {
        return publicItems(candidates).toString();
    }

    private static LinkedHashSet<String> readSeen(
            SharedPreferences preferences,
            String ownerHash
    ) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        String encoded;
        try {
            encoded = preferences.getString(seenKey(ownerHash), "[]");
        } catch (ClassCastException invalidSeenType) {
            return result;
        }
        try {
            JSONArray array = new JSONArray(encoded == null ? "[]" : encoded);
            for (int index = 0; index < array.length(); index += 1) {
                String eventId = array.optString(index, "");
                if (FinanceNotificationPolicy.isValidEventId(eventId)) {
                    result.add(eventId);
                }
            }
        } catch (JSONException invalidSeenList) {
            return new LinkedHashSet<>();
        }
        trimSeen(result);
        return result;
    }

    private static void trimSeen(LinkedHashSet<String> eventIds) {
        while (eventIds.size() > FinanceNotificationPolicy.MAX_SEEN_EVENT_IDS) {
            String first = eventIds.iterator().next();
            eventIds.remove(first);
        }
    }

    private static String encodeStrings(Set<String> values) {
        JSONArray array = new JSONArray();
        for (String value : values) {
            array.put(value);
        }
        return array.toString();
    }

    private static String queueKey(String ownerHash) {
        return QUEUE_KEY_PREFIX + ownerHash;
    }

    private static String seenKey(String ownerHash) {
        return SEEN_KEY_PREFIX + ownerHash;
    }

    private static String activeOwnerHash(SharedPreferences preferences) {
        try {
            return preferences.getString(KEY_ACTIVE_OWNER_HASH, "");
        } catch (ClassCastException invalidOwnerType) {
            return "";
        }
    }

    private static boolean isOwnerHash(String value) {
        return value != null && value.matches("[0-9a-f]{64}");
    }
}
