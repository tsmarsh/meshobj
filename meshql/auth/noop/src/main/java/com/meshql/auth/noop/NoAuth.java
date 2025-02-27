package com.meshql.auth.noop;

import com.meshql.core.Auth;
import com.meshql.core.Envelope;
import com.tailoredshapes.stash.Stash;

import java.util.List;

import static com.tailoredshapes.underbar.ocho.UnderBar.list;

public class NoAuth implements Auth {
    @Override
    public List<String> getAuthToken(Stash context) {
        return list("Token");
    }

    @Override
    public boolean isAuthorized(List<String> credentials, Envelope data) {
        return true;
    }
}
