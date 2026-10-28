package com.bookingclassroom.server.security;

import com.bookingclassroom.server.Domain;
import jakarta.servlet.http.HttpServletRequest;

/** Reads the authenticated account attached to a request by the session filter. */
public final class RequestActor {
  private RequestActor() {}

  public static Domain.Account account(HttpServletRequest request) {
    return (Domain.Account) request.getAttribute("account");
  }
}
