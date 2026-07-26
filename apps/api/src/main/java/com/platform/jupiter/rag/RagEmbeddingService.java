package com.platform.jupiter.rag;

import com.platform.jupiter.config.AppProperties;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class RagEmbeddingService {
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[\\p{L}\\p{N}]{2,}");

    private final int dimensions;

    public RagEmbeddingService(AppProperties appProperties) {
        this.dimensions = appProperties.ragEmbeddingDimensions() == null ? 128 : appProperties.ragEmbeddingDimensions();
    }

    public int dimensions() {
        return dimensions;
    }

    public float[] embed(String text) {
        float[] vector = new float[dimensions];
        if (text == null || text.isBlank()) {
            return vector;
        }

        TOKEN_PATTERN.matcher(text.toLowerCase(Locale.ROOT))
                .results()
                .map(match -> match.group().trim())
                .filter(token -> token.length() >= 2)
                .forEach(token -> {
                    int index = Math.floorMod(token.hashCode(), dimensions);
                    vector[index] += weight(token);
                });

        normalize(vector);
        return vector;
    }

    private float weight(String token) {
        int length = Math.min(token.length(), 12);
        return 1.0f + (length / 10.0f);
    }

    private void normalize(float[] vector) {
        double sum = 0;
        for (float value : vector) {
            sum += value * value;
        }
        if (sum == 0) {
            return;
        }

        float norm = (float) Math.sqrt(sum);
        for (int index = 0; index < vector.length; index++) {
            vector[index] = vector[index] / norm;
        }
    }
}
