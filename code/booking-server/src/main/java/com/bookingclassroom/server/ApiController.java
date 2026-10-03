package com.bookingclassroom.server;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

  @PostMapping("/auth/register")
  public Map<String, String> register(@RequestBody BookingService.AccountInput input) {
    Domain.Account account = bookingService.registerAccount(input.username(), input.password(), input.recoveryCode());
    return Map.of("username", account.username, "role", account.role);
  }

  @PostMapping("/auth/change-password")
  public Map<String, Boolean> changePassword(@RequestBody BookingService.PasswordChangeInput input, HttpServletRequest request) {
    bookingService.changePassword(account(request), input.currentPassword(), input.newPassword());
    return Map.of("ok", true);
  }

  @PostMapping("/auth/reset-password")
  public Map<String, Boolean> resetPassword(@RequestBody BookingService.PasswordResetInput input) {
    bookingService.resetPassword(input.username(), input.recoveryCode(), input.newPassword());
    return Map.of("ok", true);
  }

  @GetMapping("/accounts")
  public Object accounts(HttpServletRequest request) {
    return bookingService.accounts(account(request));
  }

  @PostMapping("/accounts")
  public Domain.Account createAccount(@RequestBody BookingService.AccountInput input, HttpServletRequest request) {
    return bookingService.createManagedAccount(
        account(request), input.username(), input.password(), input.recoveryCode(), input.role());
  }

  @PutMapping("/accounts/{username}")
  public Domain.Account updateAccount(
      @PathVariable String username,
      @RequestBody BookingService.AccountInput input,
      HttpServletRequest request) {
    return bookingService.updateManagedAccount(
        account(request), username, input.password(), input.recoveryCode(), input.role(), input.active());
  }

  @DeleteMapping("/accounts/{username}")
  public ResponseEntity<Void> deleteAccount(@PathVariable String username, HttpServletRequest request) {
    bookingService.deleteManagedAccount(account(request), username);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/rooms")
  public Object rooms() {
    return bookingService.rooms();
  }

  @PostMapping("/rooms")
  public Domain.Room createRoom(@RequestBody BookingService.RoomInput input, HttpServletRequest request) {
    return bookingService.createRoom(account(request), input);
  }

  @PutMapping("/rooms/{id}")
  public Domain.Room updateRoom(
      @PathVariable String id,
      @RequestBody BookingService.RoomInput input,
      HttpServletRequest request) {
    return bookingService.updateRoom(account(request), id, input);
  }

  @DeleteMapping("/rooms/{id}")
  public ResponseEntity<Void> deleteRoom(@PathVariable String id, HttpServletRequest request) {
    bookingService.deleteRoom(account(request), id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/configuration")
  public Domain.Configuration configuration() {
    return bookingService.configuration();
  }

  @PutMapping("/configuration")
  public Domain.Configuration saveConfiguration(@RequestBody Domain.Configuration input, HttpServletRequest request) {
    return bookingService.saveConfiguration(account(request), input);
  }

  @GetMapping("/maintenance")
  public Object maintenance() {
    return bookingService.maintenance();
  }

  @PostMapping("/maintenance")
  public Domain.Maintenance createMaintenance(@RequestBody BookingService.MaintenanceInput input, HttpServletRequest request) {
    return bookingService.createMaintenance(account(request), input);
  }

  @PostMapping("/maintenance/{id}/cancel")
  public Map<String, Boolean> cancelMaintenance(@PathVariable String id, HttpServletRequest request) {
    bookingService.cancelMaintenance(account(request), id);
    return Map.of("ok", true);
  }

  @GetMapping("/maintenance/requests")
  public Object maintenanceRequests(HttpServletRequest request) {
    return bookingService.maintenanceRequests(account(request));
  }

  @PostMapping("/maintenance/requests")
  public Domain.MaintenanceRequest requestMaintenance(@RequestBody Map<String, String> body, HttpServletRequest request) {
    return bookingService.requestMaintenance(account(request), body.get("bookingId"), body.get("reason"));
  }

  @PostMapping("/maintenance/requests/{id}/schedule")
  public Domain.Maintenance scheduleMaintenance(
      @PathVariable String id,
      @RequestBody BookingService.MaintenanceInput input,
      HttpServletRequest request) {
    return bookingService.scheduleMaintenanceRequest(account(request), id, input);
  }

  @PostMapping("/maintenance/requests/{id}/reject")
  public Domain.MaintenanceRequest rejectMaintenance(
      @PathVariable String id,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.rejectMaintenanceRequest(account(request), id, body.get("note"));
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

  @PostMapping("/bookings/{id}/cancel")
  public BookingService.BookingResult cancel(@PathVariable String id, HttpServletRequest request) {
    return bookingService.cancelBooking(account(request), id);
  }

  @PostMapping("/bookings/{id}/change-room")
  public BookingService.BookingResult changeRoom(
      @PathVariable String id,
      @RequestBody BookingService.ChangeRoomInput input,
      HttpServletRequest request) {
    return bookingService.changeBookingRoom(account(request), id, input.roomId(), input.reason());
  }

  @GetMapping("/pin-permissions")
  public Object pinPermissions(HttpServletRequest request) {
    return bookingService.pinPermissions(account(request));
  }

  @PostMapping("/pin-permissions")
  public Domain.PinPermission grantPin(@RequestBody BookingService.PinInput input, HttpServletRequest request) {
    return bookingService.grantRoomPin(account(request), input.username(), input.roomId());
  }

  @PostMapping("/pin-permissions/revoke")
  public Domain.PinPermission revokePin(@RequestBody BookingService.PinInput input, HttpServletRequest request) {
    return bookingService.revokeRoomPin(account(request), input.username(), input.roomId());
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
