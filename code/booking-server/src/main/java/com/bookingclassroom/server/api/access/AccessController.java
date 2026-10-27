package com.bookingclassroom.server.api.access;

import com.bookingclassroom.server.BookingService;
import com.bookingclassroom.server.Domain;
import com.bookingclassroom.server.security.RequestActor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AccessController {
  private final BookingService bookingService;

  public AccessController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @GetMapping("/pin-permissions")
  public Object pinPermissions(HttpServletRequest request) {
    return bookingService.pinPermissions(RequestActor.account(request));
  }

  @PostMapping("/pin-permissions")
  public Domain.PinPermission grantPin(
      @RequestBody BookingService.PinInput input,
      HttpServletRequest request) {
    return bookingService.grantRoomPin(
        RequestActor.account(request), input.username(), input.roomId());
  }

  @PostMapping("/pin-permissions/revoke")
  public Domain.PinPermission revokePin(
      @RequestBody BookingService.PinInput input,
      HttpServletRequest request) {
    return bookingService.revokeRoomPin(
        RequestActor.account(request), input.username(), input.roomId());
  }

  @GetMapping("/smart-lock")
  public Domain.ManagedSmartLock smartLock() {
    return bookingService.smartLock();
  }

  @PostMapping("/smart-lock/assign")
  public Domain.ManagedSmartLock assignSmartLock(
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.assignSmartLock(RequestActor.account(request), body.get("roomId"));
  }

  @PostMapping("/smart-lock/unassign")
  public Domain.ManagedSmartLock unassignSmartLock(HttpServletRequest request) {
    return bookingService.unassignSmartLock(RequestActor.account(request));
  }

  @PostMapping("/smart-lock/reserve-password-id")
  public BookingService.SmartLockReservation reservePasswordId(
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.reserveSmartLockPasswordId(
        RequestActor.account(request), body.get("roomId"));
  }
}
