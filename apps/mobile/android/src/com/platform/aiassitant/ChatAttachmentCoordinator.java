package com.platform.aiassitant;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONObject;

/** Reads only a user-selected document grant, without enabling WebView content access. */
final class ChatAttachmentCoordinator {
    static final int REQUEST_CODE=7365;
    interface Host { boolean trusted(); void deliver(JSONObject result); }
    private final Activity activity; private final Host host; private final File directory;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile boolean destroyed; private String pending; private volatile String artifact="";
    ChatAttachmentCoordinator(Activity activity,Host host){this.activity=activity;this.host=host;directory=new File(activity.getCacheDir(),"orbit-chat-attachment");directory.mkdirs();clear();}
    private void clear(){artifact="";File[] files=directory.listFiles();if(files!=null)for(File file:files)if(file.isFile())file.delete();}
    void request(final String id){if(destroyed||!TravelApiPolicy.validRequestId(id))return;activity.runOnUiThread(new Runnable(){public void run(){
        if(destroyed||!host.trusted())return;
        if(pending!=null){deliver(id,null,"파일 선택을 먼저 마쳐주세요.");return;}
        pending=id;
        try{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,false);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivityForResult(intent,REQUEST_CODE);}
        catch(Exception error){pending=null;deliver(id,null,"파일 선택 창을 열지 못했어요.");}
    }});}
    void onResult(int resultCode,Intent data){final String id=pending;pending=null;if(id==null)return;
        if(resultCode!=Activity.RESULT_OK){deliver(id,null,null);return;}
        final Uri uri=data==null?null:data.getData()!=null?data.getData():data.getClipData()!=null&&data.getClipData().getItemCount()==1?data.getClipData().getItemAt(0).getUri():null;
        if(!host.trusted()||uri==null||!"content".equals(uri.getScheme())){deliver(id,null,"선택한 문서를 읽을 권한을 확인하지 못했어요.");return;}
        worker.execute(new Runnable(){public void run(){
            File file=null;
            try{
                String name;
                try(Cursor cursor=activity.getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
                    if(cursor==null||!cursor.moveToFirst())throw new IOException("파일 이름을 읽지 못했어요.");name=cursor.getString(0);
                }
                if(!AiChatAttachmentPolicy.allowedName(name))throw new IOException("JPG·PNG·WebP 사진 또는 PDF·텍스트 문서를 선택해주세요.");
                int limit=name.toLowerCase(Locale.ROOT).matches(".*\\.(jpg|jpeg|png|webp)")?10485760:name.toLowerCase(Locale.ROOT).endsWith(".pdf")?5242880:204800;
                clear();String token=UUID.randomUUID().toString();file=new File(directory,token);
                long size=0;
                try(InputStream input=activity.getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(file)){
                    if(input==null)throw new IOException("선택한 파일을 읽지 못했어요.");byte[] buffer=new byte[8192];int count;
                    while((count=input.read(buffer))!=-1){if(destroyed)throw new IOException();size+=count;if(size>limit)throw new IOException(limit==10485760?"사진은 10MB까지 첨부할 수 있어요.":limit==5242880?"PDF는 5MB까지 첨부할 수 있어요.":"텍스트 문서는 200KB까지 첨부할 수 있어요.");out.write(buffer,0,count);}
                }
                if(size==0)throw new IOException("파일에 읽을 내용이 없어요.");
                artifact=token;
                deliver(id,new JSONObject().put("name",name).put("size",size).put("url","https://appassets.androidplatform.net/orbit-chat-attachment/"+token),null);
            }catch(Exception error){if(file!=null)file.delete();String message=error.getMessage();deliver(id,null,message!=null&&message.matches("^[가-힣].*")?message:"파일을 읽지 못했어요. 기기에 다운로드한 뒤 다시 선택해주세요.");}
        }});
    }
    WebResourceResponse respond(Uri uri){
        if(uri==null||!"https".equals(uri.getScheme())||!"appassets.androidplatform.net".equals(uri.getHost())||!uri.getPath().startsWith("/orbit-chat-attachment/"))return null;
        try{String token=uri.getLastPathSegment();if(destroyed||uri.getPort()!=-1||!token.equals(artifact)||!uri.getPath().equals("/orbit-chat-attachment/"+token))throw new IOException();
            Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");return new WebResourceResponse("application/octet-stream",null,200,"OK",headers,new FileInputStream(new File(directory,token)));
        }catch(Exception error){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.<String,String>emptyMap(),new ByteArrayInputStream(new byte[0]));}
    }
    private void deliver(final String id,final JSONObject file,final String error){activity.runOnUiThread(new Runnable(){public void run(){if(destroyed||!host.trusted())return;try{JSONObject result=new JSONObject().put("requestId",id).put("cancelled",file==null&&error==null);if(file!=null)result.put("file",file);if(error!=null)result.put("error",error);host.deliver(result);}catch(Exception ignored){}}});}
    void destroy(){destroyed=true;pending=null;worker.shutdownNow();clear();}
}
