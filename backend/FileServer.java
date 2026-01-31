import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class FileServer {
    private static final String ROOT_DIR_PATH = System.getProperty("user.home") + File.separator + "Documents";
    private static final int PORT = 8080;

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api/list", new ListHandler());
        server.createContext("/api/download", new DownloadHandler());
        server.setExecutor(Executors.newFixedThreadPool(10));
        System.out.println("DIEX Server Running on: http://localhost:" + PORT);
        server.start();
    }

    private static void applyCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
    }

    static class ListHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            applyCorsHeaders(exchange);
            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) { exchange.sendResponseHeaders(204, -1); return; }
            String query = exchange.getRequestURI().getQuery();
            String subPath = (query != null && query.startsWith("path=")) ? URLDecoder.decode(query.substring(5), StandardCharsets.UTF_8) : "";
            File dir = new File(ROOT_DIR_PATH, subPath);
            if (!dir.exists() || !dir.isDirectory()) { exchange.sendResponseHeaders(404, -1); return; }
            File[] files = dir.listFiles();
            StringBuilder json = new StringBuilder("[");
            if (files != null) {
                for (int i = 0; i < files.length; i++) {
                    json.append(String.format("{\"name\":\"%s\", \"isDirectory\":%b, \"size\":%d}", files[i].getName(), files[i].isDirectory(), files[i].length()));
                    if (i < files.length - 1) json.append(",");
                }
            }
            json.append("]");
            byte[] response = json.toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        }
    }

    static class DownloadHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            applyCorsHeaders(exchange);
            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) { exchange.sendResponseHeaders(204, -1); return; }
            String query = exchange.getRequestURI().getQuery();
            String subPath = (query != null && query.startsWith("path=")) ? URLDecoder.decode(query.substring(5), StandardCharsets.UTF_8) : "";
            File file = new File(ROOT_DIR_PATH, subPath);
            if (!file.exists() || file.isDirectory()) { exchange.sendResponseHeaders(404, -1); return; }
            exchange.sendResponseHeaders(200, file.length());
            try (InputStream is = new FileInputStream(file); OutputStream os = exchange.getResponseBody()) {
                byte[] buffer = new byte[8192]; int n;
                while ((n = is.read(buffer)) != -1) os.write(buffer, 0, n);
            }
            exchange.close();
        }
    }
}