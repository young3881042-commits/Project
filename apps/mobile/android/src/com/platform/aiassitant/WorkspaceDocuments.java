package com.platform.aiassitant;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.*;

/** Resolves every path by walking children of the granted tree; no filesystem path or arbitrary URI. */
final class WorkspaceDocuments {
    static final int MAX_WRITE = 1048576;
    final ContentResolver resolver; final Uri tree;
    WorkspaceDocuments(ContentResolver resolver, Uri tree) { this.resolver = resolver; this.tree = tree; }
    static String[] parts(String path) {
        if (path == null || path.length() > 1024 || path.startsWith("/") || path.contains("\\") || path.matches(".*[\\p{Cntrl}].*")) throw new IllegalArgumentException("폴더 안의 상대 경로를 사용해주세요.");
        if (path.isEmpty()) return new String[0];
        String[] parts = path.split("/", -1);
        if (parts.length > 40) throw new IllegalArgumentException("폴더 경로가 너무 깊어요.");
        for (String part : parts) if (part.isEmpty() || part.equals(".") || part.equals("..") || part.length() > 255) throw new IllegalArgumentException("상위 폴더 경로는 사용할 수 없어요.");
        return parts;
    }
    static boolean criticalPath(String path) {
        for (String part : parts(path)) {
            String name = part.toLowerCase(java.util.Locale.ROOT);
            if (name.equals(".git") || name.equals(".codex") || name.equals("auth.json") || name.equals("credentials.json") || name.startsWith(".env") || name.endsWith(".keystore") || name.endsWith(".jks")) return true;
        }
        return false;
    }
    Uri root() { return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree)); }
    JSONArray children(Uri parent, int offset) throws Exception {
        Uri uri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(parent));
        JSONArray rows = new JSONArray();
        try (Cursor c = resolver.query(uri, new String[]{"document_id", "_display_name", "mime_type", "_size"}, null, null, null)) {
            if (c == null) throw new IOException("폴더 목록을 읽지 못했어요.");
            int index = 0;
            while (c.moveToNext()) { if (index++ < offset) continue; if (rows.length() >= 201) break;
                rows.put(new JSONObject().put("id", c.getString(0)).put("name", c.getString(1)).put("directory", DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2))).put("size", c.isNull(3) ? -1 : c.getLong(3)));
            }
        }
        return rows;
    }
    Uri child(Uri parent, String name) throws Exception {
        for (int offset = 0; ; offset += 200) {
            JSONArray rows = children(parent, offset);
            for (int i=0; i<Math.min(200, rows.length()); i++) if (name.equals(rows.getJSONObject(i).getString("name"))) return DocumentsContract.buildDocumentUriUsingTree(tree, rows.getJSONObject(i).getString("id"));
            if (rows.length() <= 200) return null;
        }
    }
    Uri resolve(String path) throws Exception {
        Uri uri = root(); for (String part : parts(path)) { uri = child(uri, part); if (uri == null) throw new IOException("파일이나 폴더를 찾지 못했어요."); } return uri;
    }
    byte[] readAll(Uri uri) throws Exception {
        try (InputStream in = resolver.openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException(); byte[] buffer = new byte[8192]; int n;
            while ((n=in.read(buffer))!=-1) { if (out.size()+n>MAX_WRITE) throw new IOException("수정은 파일당 1MB까지 지원해요."); out.write(buffer,0,n); } return out.toByteArray();
        }
    }
    static String hash(byte[] data) throws Exception { StringBuilder b=new StringBuilder(); for(byte x:MessageDigest.getInstance("SHA-256").digest(data)) b.append(String.format(java.util.Locale.ROOT,"%02x",x&255)); return b.toString(); }
    void write(Uri uri, byte[] bytes) throws Exception { try (OutputStream out=resolver.openOutputStream(uri,"wt")) { if(out==null)throw new IOException(); out.write(bytes); out.flush(); } }
    JSONObject call(String tool, JSONObject args) throws Exception {
        String path=args.optString("path", ""); parts(path);
        if (tool.equals("list_files")) {
            int offset=args.optInt("offset",0); if(offset<0)throw new IOException("목록 위치를 확인해주세요.");
            JSONArray source=children(resolve(path),offset), rows=new JSONArray();
            for(int i=0;i<Math.min(200,source.length());i++){JSONObject row=source.getJSONObject(i);row.remove("id");rows.put(row);}
            return new JSONObject().put("entries",rows).put("nextOffset",source.length()>200?offset+200:JSONObject.NULL);
        }
        if (tool.equals("read_file")) {
            Uri uri=resolve(path); long offset=args.optLong("offset",0); int length=args.optInt("length",16000);
            if(offset<0||length<1||length>65536)throw new IOException("읽기는 한 번에 64KB까지 가능해요.");
            byte[] data; boolean more;
            try(InputStream in=resolver.openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){
                if(in==null)throw new IOException();long left=offset;while(left>0){long n=in.skip(left);if(n==0){if(in.read()==-1)break;n=1;}left-=n;}
                byte[] buf=new byte[8192];int n;while(out.size()<length&&(n=in.read(buf,0,Math.min(buf.length,length-out.size())))!=-1)out.write(buf,0,n);
                more=in.read()!=-1;data=out.toByteArray();
            }
            JSONObject result=new JSONObject().put("offset",offset).put("nextOffset",more?offset+data.length:JSONObject.NULL).put("bytes",data.length);
            String encoding=args.optString("encoding","utf8");if(!encoding.equals("utf8")&&!encoding.equals("base64"))throw new IOException("인코딩을 확인해주세요.");
            result.put("content",encoding.equals("base64")?Base64.encodeToString(data,Base64.NO_WRAP):new String(data,StandardCharsets.UTF_8));
            try{result.put("sha256",hash(readAll(uri)));}catch(IOException large){result.put("sha256",JSONObject.NULL);}
            return result;
        }
        if (path.isEmpty()) throw new IOException("선택한 최상위 폴더는 변경할 수 없어요.");
        int slash=path.lastIndexOf('/'); Uri parent=resolve(slash<0?"":path.substring(0,slash)); String name=path.substring(slash+1); Uri target=child(parent,name);
        if(tool.equals("create_directory")) { if(target!=null)throw new IOException("같은 이름이 이미 있어요."); if(DocumentsContract.createDocument(resolver,parent,DocumentsContract.Document.MIME_TYPE_DIR,name)==null)throw new IOException();return new JSONObject().put("created",true); }
        if(tool.equals("delete_entry")) { if(target==null)throw new IOException("항목을 찾지 못했어요.");
            try(Cursor c=resolver.query(target,new String[]{"mime_type"},null,null,null)){if(c!=null&&c.moveToFirst()&&DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(0))&&children(target,0).length()>0)throw new IOException("비어 있지 않은 폴더는 한 번에 삭제하지 않아요.");}
            if(!DocumentsContract.deleteDocument(resolver,target))throw new IOException();return new JSONObject().put("deleted",true); }
        if(!tool.equals("write_file"))throw new IOException("지원하지 않는 파일 작업이에요.");
        String content=args.getString("content"), encoding=args.optString("encoding","utf8");if(content.length()>1500000)throw new IOException("파일이 너무 커요.");
        if(!encoding.equals("utf8")&&!encoding.equals("base64"))throw new IOException("인코딩을 확인해주세요.");
        byte[] bytes=encoding.equals("base64")?Base64.decode(content,Base64.NO_WRAP):content.getBytes(StandardCharsets.UTF_8);if(bytes.length>MAX_WRITE)throw new IOException("수정은 파일당 1MB까지 지원해요.");
        byte[] before=target==null?null:readAll(target);
        if(before!=null&&!hash(before).equals(args.optString("expectedSha256","")))throw new IOException("파일이 변경됐어요. 먼저 다시 읽어주세요.");
        if(target==null){target=DocumentsContract.createDocument(resolver,parent,"application/octet-stream",name);if(target==null)throw new IOException();}
        try{write(target,bytes);if(!hash(readAll(target)).equals(hash(bytes)))throw new IOException("저장한 파일 검증에 실패했어요.");}catch(Exception failed){try{if(before!=null)write(target,before);else DocumentsContract.deleteDocument(resolver,target);}catch(Exception rollback){throw new IOException("저장과 복구에 실패했어요. 파일 상태를 직접 확인해주세요.");}throw new IOException("저장에 실패해 이전 상태로 복구했어요.");}
        return new JSONObject().put("written",true).put("bytes",bytes.length).put("sha256",hash(bytes));
    }
}
