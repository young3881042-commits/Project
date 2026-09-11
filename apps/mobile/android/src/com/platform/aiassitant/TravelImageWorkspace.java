package com.platform.aiassitant;
import android.app.Activity;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONObject;

/** PNG artifacts are real files shared with the default Codex workspace. */
final class TravelImageWorkspace {
    interface Host { boolean trusted(); void deliver(JSONObject value); }
    private final Activity activity; private final Host host; private final File root;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(); private volatile boolean destroyed;
    TravelImageWorkspace(Activity activity, Host host) { this.activity=activity; this.host=host; root=new File(activity.getFilesDir(),"orbit-ai/workspace"); }
    private String path(String key) throws IOException { if(key==null||!key.matches("[a-f0-9]{64}"))throw new IOException("이미지 경로를 확인해주세요."); return "travel/"+key+".png"; }
    void request(final String id, final String action, final String key, final String content, final String metadata) {
        if(destroyed||!TravelApiPolicy.validRequestId(id)||!host.trusted())return;
        if((content!=null&&content.length()>5600000)||(metadata!=null&&metadata.length()>65536)){deliver(id,null,"일정 이미지가 너무 커요.");return;}
        try { worker.execute(new Runnable(){public void run(){
            try { synchronized(OrbitWorkspaceFiles.LOCK){
                OrbitWorkspaceFiles files=new OrbitWorkspaceFiles(root); String relative=path(key);
                if(action.equals("save")){
                    if(content==null||!content.startsWith("data:image/png;base64,"))throw new IOException("PNG 이미지를 확인해주세요.");
                    byte[] bytes=Base64.decode(content.substring(22),Base64.NO_WRAP);validate(bytes);
                    File directory=files.resolve("travel"); if(!directory.isDirectory()&&!directory.mkdir())throw new IOException("여행 이미지 폴더를 만들지 못했어요.");
                    files.write(relative,bytes);
                    if(metadata!=null&&!metadata.equals("{}"))files.write("travel/"+key+".json",new JSONObject(metadata).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }else if(!action.equals("read"))throw new IOException("지원하지 않는 이미지 요청이에요.");
                File file=files.resolve(relative);JSONObject value=new JSONObject().put("exists",file.isFile());
                if(file.isFile()) { byte[] bytes=files.read(relative,4194304);validate(bytes);value.put("url","https://appassets.androidplatform.net/orbit-workspace/"+relative+"?v="+OrbitWorkspaceFiles.hash(bytes)).put("path",relative); }
                deliver(id,value,null);
            }}catch(Exception error){deliver(id,null,"일정 이미지 파일을 읽거나 저장하지 못했어요.");}
        }}); }catch(RejectedExecutionException error){deliver(id,null,"이미지 저장소가 종료됐어요.");}
    }
    private void validate(byte[] bytes)throws IOException{
        if(bytes.length==0||bytes.length>4194304)throw new IOException();
        BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
        if(!"image/png".equals(options.outMimeType)||options.outWidth<1||options.outWidth>4096||options.outHeight<1||options.outHeight>4096)throw new IOException();
    }
    WebResourceResponse respond(Uri uri){
        if(uri==null||!"https".equals(uri.getScheme())||!"appassets.androidplatform.net".equals(uri.getHost())||!uri.getPath().startsWith("/orbit-workspace/"))return null;
        try { if(destroyed||uri.getPort()!=-1||!uri.getPath().matches("/orbit-workspace/travel/[a-f0-9]{64}\\.png"))throw new IOException();
            synchronized(OrbitWorkspaceFiles.LOCK){OrbitWorkspaceFiles files=new OrbitWorkspaceFiles(root);byte[] bytes=files.read(uri.getPath().substring(17),4194304);validate(bytes);
                Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");
                return new WebResourceResponse("image/png",null,200,"OK",headers,new ByteArrayInputStream(bytes));}
        }catch(Exception error){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.<String,String>emptyMap(),new ByteArrayInputStream(new byte[0]));}
    }
    private void deliver(final String id,final JSONObject value,final String error){activity.runOnUiThread(new Runnable(){public void run(){if(destroyed||!host.trusted())return;try{JSONObject result=value==null?new JSONObject():value;result.put("requestId",id);if(error!=null)result.put("error",error);host.deliver(result);}catch(Exception ignored){}}});}
    void destroy(){destroyed=true;worker.shutdownNow();}
}
