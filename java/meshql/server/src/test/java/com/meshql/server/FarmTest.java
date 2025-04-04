package com.meshql.server;

import com.meshql.api.graphql.SubgraphClient;
import com.meshql.auth.noop.NoAuth;
import com.meshql.core.Auth;

import com.meshql.repos.sqlite.SQLitePlugin;

import com.tailoredshapes.stash.Stash;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import spark.Service;

import javax.crypto.SecretKey;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

import static com.tailoredshapes.stash.Stash.stash;
import static com.tailoredshapes.underbar.ocho.Die.rethrow;
import static com.tailoredshapes.underbar.ocho.UnderBar.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class FarmTest {
    private String token;
    private Server server;
    private String farmId;
    private String coop1Id;
    private String coop2Id;
    private Map<String, String> henIds = new HashMap<>();
    private long firstTimestamp;
    private HttpClient httpClient;

    @BeforeAll
    void setUp() throws Exception {
        var port = 6060;


        SecretKey key = Keys.secretKeyFor(SignatureAlgorithm.HS256); // Generates appropriate length key

        token = Jwts.builder()
                .setSubject("test-user")
                .signWith(key) // Modern method that isn't deprecated
                .setIssuedAt(new Date())
                .setExpiration(Date.from(Instant.now().plusSeconds(3600))) // More readable way to add 1 hour
                .compact();

        Auth auth = new NoAuth();

        httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.ALWAYS).build();

        server = new Server(auth, hash("sqlite", new SQLitePlugin(auth)));
        Service service = server.init(SQLRoot.config(port));

        // Build test data
        buildTestData(token, port);
    }

    private Stash createObject(Stash data, int port, String url, String token) {
        var fUrl = String.format("http://localhost:%d%s", port, url);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", token)
                .POST(HttpRequest.BodyPublishers.ofString(data.toJSONString()))
                .build();

        HttpResponse<String> createResponse = rethrow(()-> httpClient.send(request, HttpResponse.BodyHandlers.ofString()));

        return Stash.parseJSON(createResponse.body());
    }

    private void buildTestData(String token, int port) {
        var farm = stash("name", "Emerdale");
        Stash savedFarm = createObject(farm, port, "/farm", token);
        var coops = list(stash( "name", "red", "farm_id", savedFarm.asString("id" )), stash( "name", "yellow", "farm_id", savedFarm.asString("id" )));
        var savedCoops = map(coops, (c) -> createObject(c, port, "/coop", token));
        var hens = list(
                stash("name", "chuck", "eggs", 2, "coop_id", savedCoops.get(0).asString("id")),
                stash("name", "duck", "eggs", 0, "coop_id", savedCoops.get(0).asString("id")),
                stash("name", "euck", "eggs", 1, "coop_id", savedCoops.get(1).asString("id")),
                stash("name", "fuck", "eggs", 2, "coop_id", savedCoops.get(1).asString("id")));

        var savedHens = map(hens, (c) -> createObject(c, port, "/hen", token));
        savedHens.forEach((h) -> {
            henIds.put(h.asString("name"), h.asString("id"));
        });
    }

    @Test
    void shouldBuildServerWithMultipleNodes() throws Exception {
        String query = """
            {
                getById(id: "%s") {
                    name
                    coops {
                        name
                        hens {
                            eggs
                            name
                        }
                    }
                }
            }
            """.formatted(farmId);

        Stash response = (Stash) SubgraphClient.fetch(new URI("/farm/graph"), query, "getById", token);

        assertEquals("Emerdale", response.asString("name"));
        List<Stash> coops = response.asStashes("coops");
        assertEquals(3, coops.size());
    }

    @Test
    void shouldAnswerSimpleQueries() throws Exception {
        String query = """
            {
                getByName(name: "duck") {
                    id
                    name
                }
            }
            """;

        List<Stash> response = (List<Stash>) SubgraphClient.fetch(new URI("/hen/graph"), query, "getByName", token);

        assertEquals(henIds.get("duck"), response.getFirst().asString("id"));
        assertEquals("duck", response.getFirst().asString("name"));
    }
}