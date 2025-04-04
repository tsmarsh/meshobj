package com.meshql.auth.casbin;

import com.meshql.core.Auth;

import com.meshql.core.Envelope;
import com.tailoredshapes.stash.Stash;
import org.casbin.jcasbin.main.Enforcer;
import spark.Request;

import java.util.List;

public class CasbinAuth implements Auth {
    private final Enforcer enforcer;
    private final Auth jwtAuth;

    private CasbinAuth(Enforcer enforcer, Auth jwtAuth) {
        this.enforcer = enforcer;
        this.jwtAuth = jwtAuth;
    }

    @Override
    public List<String> getAuthToken(Request context) {
        List<String> sub = jwtAuth.getAuthToken(context);
        if (sub == null || sub.isEmpty()) {
            return List.of();
        }
        return enforcer.getRolesForUser(sub.get(0));
    }

    @Override
    public boolean isAuthorized(List<String> credentials, Envelope data) {
        List<String> authorizedTokens = data.authorizedTokens();

        if (authorizedTokens == null || authorizedTokens.isEmpty()) {
            return true;
        }

        return authorizedTokens.stream().anyMatch(credentials::contains);
    }
}