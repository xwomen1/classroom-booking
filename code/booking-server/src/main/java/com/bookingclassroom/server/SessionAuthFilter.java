package com.bookingclassroom.server;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SessionAuthFilter extends OncePerRequestFilter {
  private final BookingService bookingService;

  public SessionAuthFilter(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String path = request.getRequestURI();
    if (!path.startsWith("/api/")
        || path.equals("/api/auth/login")
        || path.equals("/api/auth/register")
        || path.equals("/api/auth/reset-password")) {
      filterChain.doFilter(request, response);
      return;
    }
    String header = request.getHeader("Authorization");
    String token = header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : "";
    try {
      request.setAttribute("account", bookingService.requireAccount(token));
      filterChain.doFilter(request, response);
    } catch (BookingService.UnauthorizedException error) {
      response.setStatus(401);
      response.setContentType("application/json");
      response.setCharacterEncoding("UTF-8");
      response.getWriter().write("{\"message\":\"" + error.getMessage() + "\"}");
    }
  }
}
