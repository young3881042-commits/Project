package com.platform.jupiter.files;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

@Service
public class VirusScanService {
    private static final String EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "dll", "msi", "bat", "cmd", "scr", "com", "ps1", "vbs", "js", "jar");

    public void scan(MultipartFile file) {
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        int extensionIndex = filename.lastIndexOf('.');
        if (extensionIndex >= 0) {
            String extension = filename.substring(extensionIndex + 1);
            if (BLOCKED_EXTENSIONS.contains(extension)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Blocked executable file type");
            }
        }
        try {
            String text = new String(file.getBytes(), StandardCharsets.ISO_8859_1);
            if (text.contains(EICAR)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Virus signature detected");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to scan uploaded file", e);
        }
    }
}
