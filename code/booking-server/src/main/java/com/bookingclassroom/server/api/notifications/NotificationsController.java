package com.bookingclassroom.server.api.notifications;

import com.bookingclassroom.server.BookingService;
import com.bookingclassroom.server.Domain;
import com.bookingclassroom.server.security.RequestActor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationsController {
  private final BookingService bookingService;

  public NotificationsController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @GetMapping
  public Object notifications(HttpServletRequest request) {
    return bookingService.notifications(RequestActor.account(request));
  }

  @PostMapping("/read")
  public Map<String, Boolean> markRead(HttpServletRequest request) {
    bookingService.markNotificationsRead(RequestActor.account(request));
    return Map.of("ok", true);
  }

  @PostMapping
  public ResponseEntity<Domain.Notification> addNotification(
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    Domain.Notification created = bookingService.addNotification(
        RequestActor.account(request), body.get("username"),
        body.get("title"), body.get("message"));
    return created == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(created);
  }
}
