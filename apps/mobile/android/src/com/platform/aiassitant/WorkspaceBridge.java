package com.platform.aiassitant;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.DocumentsContract;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Selected SAF tree only. A native-owned token gates loopback tools; no token or URI enters JavaScript. */
final class WorkspaceBridge {
    static final int REQUEST_CODE=7441;
    interface Host { boolean trusted(); void deliver(JSONObject value); }
    private final Activity activity; private final SharedPreferences prefs; private final Host host; private final File descriptor;
    private volatile ServerSocket server; private volatile boolean destroyed; private volatile String token=""; private volatile Uri tree;
    private volatile AlertDialog pendingDialog;
    private String pending; private static final String KEY="orbit_workspace_tree_v1";
    WorkspaceBridge(Activity activity,SharedPreferences prefs,Host host){this.activity=activity;this.prefs=prefs;this.host=host;descriptor=new File(activity.getFilesDir(),"orbit-ai/workspace-bridge.json");String saved=prefs.getString(KEY,"");if(!saved.isEmpty())tree=Uri.parse(saved);new Thread(new Runnable(){ @Override public void run(){try{publish();}catch(Exception ignored){}}},"orbit-folder-start").start();}
    synchronized void publish() throws Exception {
        if(destroyed)return;
        new OrbitWorkspaceFiles(new File(activity.getFilesDir(),"orbit-ai/workspace"));
        boolean granted=false;for(android.content.UriPermission permission:activity.getContentResolver().getPersistedUriPermissions())if(permission.getUri().equals(tree)&&permission.isReadPermission()&&permission.isWritePermission())granted=true;
        if(tree!=null&&!granted){tree=null;prefs.edit().remove(KEY).commit();}
        if(server==null){server=new ServerSocket(0,4,InetAddress.getByName("127.0.0.1"));Thread thread=new Thread(new Runnable(){ @Override public void run(){serve();}},"orbit-folder-tools");thread.setDaemon(true);thread.start();}
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder value=new StringBuilder();for(byte b:bytes)value.append(String.format(Locale.ROOT,"%02x",b&255));token=value.toString();
        JSONObject data=new JSONObject().put("port",server.getLocalPort()).put("token",token);
        descriptor.getParentFile().mkdirs();File temp=new File(descriptor.getPath()+".tmp");try(OutputStream out=new FileOutputStream(temp)){out.write(data.toString().getBytes(StandardCharsets.UTF_8));}
        temp.setReadable(false,false);temp.setReadable(true,true);temp.setWritable(false,false);temp.setWritable(true,true);if(!temp.renameTo(descriptor))throw new IOException();
    }
    void request(String id,String action){if(!TravelApiPolicy.validRequestId(id)||destroyed)return;activity.runOnUiThread(new Runnable(){ @Override public void run(){
        if(!host.trusted())return;
        try{
            if(action.equals("pick")){if(pending!=null)throw new IOException("폴더 선택을 먼저 마쳐주세요.");pending=id;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);activity.startActivityForResult(intent,REQUEST_CODE);return;}
            if(action.equals("clear")){Uri previous=tree;tree=null;token="";if(pendingDialog!=null)pendingDialog.cancel();prefs.edit().remove(KEY).commit();descriptor.delete();if(previous!=null)try{activity.getContentResolver().releasePersistableUriPermission(previous,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);}catch(Exception ignored){}}
            else if(!action.equals("status"))throw new IOException("지원하지 않는 폴더 요청이에요.");
            if(token.isEmpty())publish();
            result(id,null,false);
        }catch(Exception error){pending=null;result(id,"폴더 연결을 확인해주세요.",false);}
    }});}
    void onResult(int code,Intent data){String id=pending;pending=null;if(id==null)return;if(code!=Activity.RESULT_OK){result(id,null,true);return;}
        try{Uri next=data==null?null:data.getData();int flags=data==null?0:data.getFlags();int rw=Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            if(!host.trusted()||next==null||!"content".equals(next.getScheme())||!DocumentsContract.isTreeUri(next)||(flags&rw)!=rw)throw new IOException();
            activity.getContentResolver().takePersistableUriPermission(next,rw);Uri previous=tree;tree=next;token="";descriptor.delete();if(!prefs.edit().putString(KEY,next.toString()).commit())throw new IOException();
            if(previous!=null&&!previous.equals(next))try{activity.getContentResolver().releasePersistableUriPermission(previous,rw);}catch(Exception ignored){}
            new Thread(new Runnable(){ @Override public void run(){try{publish();result(id,null,false);}catch(Exception error){result(id,"폴더 연결을 시작하지 못했어요.",false);}}},"orbit-folder-connect").start();
        }catch(Exception failure){result(id,"폴더의 읽기·쓰기 권한을 허용해주세요.",false);}
    }
    private void result(String id,String error,boolean cancelled){activity.runOnUiThread(new Runnable(){ @Override public void run(){if(destroyed||!host.trusted())return;try{JSONObject data=new JSONObject().put("requestId",id).put("connected",!token.isEmpty()).put("name","Orbit 작업공간").put("externalConnected",tree!=null).put("cancelled",cancelled);if(tree!=null)data.put("externalName",DocumentsContract.getTreeDocumentId(tree).replaceFirst("^[^:]*:",""));if(error!=null)data.put("error",error);host.deliver(data);}catch(Exception ignored){}}});}
    private String line(InputStream in) throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();for(int n;(n=in.read())!=-1;){if(n==10)return out.toString("US-ASCII").replace("\r","");if(out.size()>=8192)throw new IOException();out.write(n);}throw new EOFException();}
    private void serve(){while(!destroyed){try(Socket socket=server.accept()){socket.setSoTimeout(10000);handle(socket);}catch(Exception ignored){if(destroyed)return;}}}
    private void handle(Socket socket)throws Exception{
        InputStream in=socket.getInputStream();if(!"POST /tool HTTP/1.1".equals(line(in)))return;
        Map<String,String> headers=new HashMap<>();int total=0;for(String value;!(value=line(in)).isEmpty();){total+=value.length();if(total>8192)return;int colon=value.indexOf(':');if(colon<1)return;String key=value.substring(0,colon).toLowerCase(Locale.ROOT);if(headers.put(key,value.substring(colon+1).trim())!=null)return;}
        String requestToken=headers.getOrDefault("authorization","");Uri selected=tree;String session=token;
        if(session.isEmpty()||headers.containsKey("origin")||headers.containsKey("transfer-encoding")||!headers.getOrDefault("content-type","").startsWith("application/json")||!headers.getOrDefault("host","").equals("127.0.0.1:"+server.getLocalPort())||!MessageDigest.isEqual(requestToken.getBytes(StandardCharsets.UTF_8),("Bearer "+session).getBytes(StandardCharsets.UTF_8)))return;
        int length=Integer.parseInt(headers.getOrDefault("content-length","0"));if(length<1||length>1500000)return;byte[] bytes=new byte[length];int read=0;while(read<length){int n=in.read(bytes,read,length-read);if(n<0)return;read+=n;}
        JSONObject result;try{JSONObject body=new JSONObject(new String(bytes,StandardCharsets.UTF_8));String tool=body.getString("name");JSONObject args=body.optJSONObject("arguments");if(args==null)args=new JSONObject();
            if(!Arrays.asList("list_files","read_file","write_file","create_directory","delete_entry").contains(tool))throw new IOException("지원하지 않는 작업이에요.");
            if((tool.equals("delete_entry") || (tool.equals("write_file") && WorkspaceDocuments.criticalPath(args.optString("path","")))) && !approveChange(args.optString("path",""), tool.equals("delete_entry")))throw new IOException("파일 변경을 취소했어요.");
            if(!session.equals(token)||!Objects.equals(selected,tree))throw new IOException("폴더 연결이 바뀌었어요. 다시 요청해주세요.");
            String path=args.optString("path", "");
            if(path.equals("external")||path.startsWith("external/")){
                if(selected==null)throw new IOException("외부 폴더를 먼저 연결해주세요.");
                args.put("path",path.equals("external")?"":path.substring(9));
                result=new JSONObject().put("result",new WorkspaceDocuments(activity.getContentResolver(),selected).call(tool,args));
            }else{
                JSONObject value=new LocalWorkspaceDocuments(new File(activity.getFilesDir(),"orbit-ai/workspace")).call(tool,args);
                if(tool.equals("list_files")&&path.isEmpty()&&args.optInt("offset",0)==0&&selected!=null)value.getJSONArray("entries").put(new JSONObject().put("name","external").put("directory",true));
                result=new JSONObject().put("result",value);
            }
        }catch(Exception error){String message=error.getMessage();result=new JSONObject().put("error",message!=null&&message.matches("^[가-힣].*")?message:"파일 작업을 완료하지 못했어요. 권한과 파일 상태를 확인해주세요.");}
        byte[] output=result.toString().getBytes(StandardCharsets.UTF_8);OutputStream out=socket.getOutputStream();out.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: "+output.length+"\r\n\r\n").getBytes(StandardCharsets.US_ASCII));out.write(output);out.flush();
    }
    private boolean approveChange(String path, final boolean delete)throws Exception{
        WorkspaceDocuments.parts(path);if(path.isEmpty())return false;CountDownLatch latch=new CountDownLatch(1);boolean[] allowed={false};AlertDialog[] dialog={null};
        activity.runOnUiThread(new Runnable(){ @Override public void run(){if(destroyed||!host.trusted()){latch.countDown();return;}dialog[0]=new AlertDialog.Builder(activity).setTitle(delete ? "Codex 파일 삭제 확인" : "Codex 중요 파일 수정 확인").setMessage((delete ? "다음 항목을 삭제할까요?\n\n" : "다음 중요 파일을 수정할까요?\n\n")+path).setPositiveButton(delete ? "삭제" : "수정",new DialogInterface.OnClickListener(){ public void onClick(DialogInterface d,int w){allowed[0]=true;latch.countDown();}}).setNegativeButton("취소",new DialogInterface.OnClickListener(){ public void onClick(DialogInterface d,int w){latch.countDown();}}).setOnCancelListener(new DialogInterface.OnCancelListener(){ public void onCancel(DialogInterface d){latch.countDown();}}).show();pendingDialog=dialog[0];}});
        boolean answered=latch.await(90,TimeUnit.SECONDS);activity.runOnUiThread(new Runnable(){ @Override public void run(){if(dialog[0]!=null)dialog[0].dismiss();if(pendingDialog==dialog[0])pendingDialog=null;}});return answered&&allowed[0]&&!destroyed;
    }
    void cancelTools(){
        token="";descriptor.delete();
        activity.runOnUiThread(new Runnable(){ public void run(){if(pendingDialog!=null)pendingDialog.cancel();}});
        new Thread(new Runnable(){public void run(){try{publish();}catch(Exception ignored){}}},"orbit-folder-revoke").start();
    }
    void destroy(){destroyed=true;token="";descriptor.delete();try{if(server!=null)server.close();}catch(Exception ignored){}}
}
