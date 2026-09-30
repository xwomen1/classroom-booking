package com.bookingclassroom.server;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ApiController {
  private final BookingService bookingService;

  public ApiController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @PostMapping("/auth/login")
  public BookingService.LoginResult login(@RequestBody Map<String, String> body) {
    return bookingService.login(body.get("username"), body.get("password"));
  }

  @GetMapping("/rooms")
  public Object rooms() {
    return bookingService.rooms();
  }

  @GetMapping("/configuration")
  public Domain.Configuration configuration() {
    return bookingService.configuration();
  }

  @GetMapping("/maintenance")
  public Object maintenance() {
    return bookingService.maintenance();
  }

  @GetMapping("/bookings")
  public Object bookings() {
    return bookingService.bookings();
  }

  @PostMapping("/bookings")
  public BookingService.BookingResult create(@RequestBody BookingService.BookingInput input, HttpServletRequest request) {
    return bookingService.createBooking(account(request), input);
  }

  @PostMapping("/bookings/{id}/review")
  public BookingService.BookingResult review(
      @PathVariable String id,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.reviewBooking(account(request), id, body.get("decision"));
  }

  @PostMapping("/bookings/{id}/temporary-pin")
  public BookingService.BookingResult temporaryPin(
      @PathVariable String id,
      @RequestBody BookingService.TemporaryPinInput input,
      HttpServletRequest request) {
    return bookingService.saveTemporaryPin(account(request), id, input);
  }

  @GetMapping("/pin-permissions")
  public Object pinPermissions(HttpServletRequest request) {
    return bookingService.pinPermissions(account(request));
  }

  @GetMapping("/notifications")
  public Object notifications(HttpServletRequest request) {
    return bookingService.notifications(account(request));
  }

  @PostMapping("/notifications/read")
  public Map<String, Boolean> markRead(HttpServletRequest request) {
    bookingService.markNotificationsRead(account(request));
    return Map.of("ok", true);
  }

  @PostMapping("/notifications")
  public ResponseEntity<Domain.Notification> addNotification(@RequestBody Map<String, String> body, HttpServletRequest request) {
    Domain.Notification created = bookingService.addNotification(
        account(request), body.get("username"), body.get("title"), body.get("message"));
    if (created == null) {
      return ResponseEntity.noContent().build();
    }
    return ResponseEntity.ok(created);
  }

  private static Domain.Account account(HttpServletRequest request) {
    return (Domain.Account) request.getAttribute("account");
  }
}
