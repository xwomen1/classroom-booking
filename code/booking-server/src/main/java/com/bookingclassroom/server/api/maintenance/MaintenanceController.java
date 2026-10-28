package com.bookingclassroom.server.api.maintenance;

import com.bookingclassroom.server.BookingService;
import com.bookingclassroom.server.Domain;
import com.bookingclassroom.server.security.RequestActor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {
  private final BookingService bookingService;

  public MaintenanceController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @GetMapping
  public Object maintenance() {
    return bookingService.maintenance();
  }

  @PostMapping
  public Domain.Maintenance createMaintenance(
      @RequestBody BookingService.MaintenanceInput input,
      HttpServletRequest request) {
    return bookingService.createMaintenance(RequestActor.account(request), input);
  }

  @PostMapping("/{id}/cancel")
  public Map<String, Boolean> cancelMaintenance(
      @PathVariable String id,
      HttpServletRequest request) {
    bookingService.cancelMaintenance(RequestActor.account(request), id);
    return Map.of("ok", true);
  }

  @GetMapping("/requests")
  public Object maintenanceRequests(HttpServletRequest request) {
    return bookingService.maintenanceRequests(RequestActor.account(request));
  }

  @PostMapping("/requests")
  public Domain.MaintenanceRequest requestMaintenance(
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.requestMaintenance(
        RequestActor.account(request), body.get("bookingId"), body.get("reason"));
  }

  @PostMapping("/requests/{id}/schedule")
  public Domain.Maintenance scheduleMaintenance(
      @PathVariable String id,
      @RequestBody BookingService.MaintenanceInput input,
      HttpServletRequest request) {
    return bookingService.scheduleMaintenanceRequest(RequestActor.account(request), id, input);
  }

  @PostMapping("/requests/{id}/reject")
  public Domain.MaintenanceRequest rejectMaintenance(
      @PathVariable String id,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.rejectMaintenanceRequest(
        RequestActor.account(request), id, body.get("note"));
  }
}
