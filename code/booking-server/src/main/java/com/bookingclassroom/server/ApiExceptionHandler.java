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

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> unexpected(Exception error) {
    Throwable cause = error;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    String message = cause.getMessage();
    if (message == null || message.isBlank()) {
      message = "Máy chủ gặp lỗi khi xử lý yêu cầu.";
    }
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", message));
  }
}
