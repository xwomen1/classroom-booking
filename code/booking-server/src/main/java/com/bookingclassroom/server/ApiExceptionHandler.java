package com.bookingclassroom.server;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException error) {
    return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
  }

  @ExceptionHandler(BookingService.ForbiddenException.class)
  public ResponseEntity<Map<String, String>> forbidden(BookingService.ForbiddenException error) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", error.getMessage()));
  }

  @ExceptionHandler(BookingService.UnauthorizedException.class)
  public ResponseEntity<Map<String, String>> unauthorized(BookingService.UnauthorizedException error) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", error.getMessage()));
  }
}
