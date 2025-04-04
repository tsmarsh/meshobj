package com.meshql.auth.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.meshql.core.Auth;
import com.meshql.core.Envelope;

import com.tailoredshapes.stash.Stash;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.List;
import spark.Request;

public class JWTSubAuthorizer implements Auth {
    private static final Logger logger = LoggerFactory.getLogger(JWTSubAuthorizer.class);

    @Override
    public List<String> getAuthToken(Request context) {


        String authHeader = context.headers("Authorization");

        if (authHeader == null) {
            return Collections.emptyList();
        }

        if (authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                DecodedJWT decodedToken = JWT.decode(token);
                String subject = decodedToken.getSubject();
                return Collections.singletonList(subject);
            } catch (Exception e) {
                logger.error("Error decoding JWT token", e);
                return Collections.emptyList();
            }
        } else {
            logger.error("Missing Bearer Token");
            return Collections.emptyList();
        }
    }

    @Override
    public boolean isAuthorized(List<String> credentials, Envelope data) {
        List<String> authorizedTokens = data.authorizedTokens();

        // Allow access if authorized_tokens is empty or null
        if (authorizedTokens == null || authorizedTokens.isEmpty()) {
            return true;
        }

        // Check if any of the credentials match authorized tokens
        return authorizedTokens.stream().anyMatch(credentials::contains);
    }
}
