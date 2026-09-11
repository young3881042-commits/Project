package com.platform.aiassitant;
import java.io.*;
import java.nio.file.*;
import java.util.Arrays;

public final class OrbitWorkspaceFilesStaticTest {
    interface Attempt { void run() throws Exception; }
    static void rejected(Attempt attempt) throws Exception { try { attempt.run(); } catch(IOException expected) { return; } throw new AssertionError("unsafe path accepted"); }
    public static void main(String[] args) throws Exception {
        File temp=Files.createTempDirectory("orbit-workspace-test-").toFile();
        try {
            final OrbitWorkspaceFiles files=new OrbitWorkspaceFiles(new File(temp,"workspace"));
            if(!files.resolve("travel").mkdir())throw new AssertionError();
            byte[] png={ (byte)137,80,78,71,13,10,26,10 };
            files.write("travel/test.png",png);
            if(!Arrays.equals(png,files.read("travel/test.png",100)))throw new AssertionError("round trip");
            files.write("travel/test.png",new byte[]{1,2});
            if(files.read("travel/test.png",100).length!=2)throw new AssertionError("replace");
            rejected(new Attempt(){public void run()throws Exception{files.resolve("../auth.json");}});
            rejected(new Attempt(){public void run()throws Exception{files.resolve("/data/auth.json");}});
            rejected(new Attempt(){public void run()throws Exception{files.resolve("travel//x");}});
            Files.createSymbolicLink(new File(files.root,"escape").toPath(),temp.toPath());
            rejected(new Attempt(){public void run()throws Exception{files.resolve("escape/auth.json");}});
            rejected(new Attempt(){public void run()throws Exception{files.read("travel/test.png",1);}});
            System.out.println("Orbit workspace file isolation and persistence tests passed");
        } finally {
            Files.deleteIfExists(new File(temp,"workspace/escape").toPath());
            new File(temp,"workspace/travel/test.png").delete();new File(temp,"workspace/travel").delete();new File(temp,"workspace").delete();temp.delete();
        }
    }
}
