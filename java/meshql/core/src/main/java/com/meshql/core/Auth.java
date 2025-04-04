package com.meshql.core;

import spark.Request;
import java.util.List;

public interface Auth {
    List<String> getAuthToken(Request context);
    boolean isAuthorized(List<String> credentials, Envelope data);
} 
