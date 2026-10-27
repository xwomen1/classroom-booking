package com.bookingclassroom.server.api.bookings;

import com.bookingclassroom.server.BookingService;
import com.bookingclassroom.server.security.RequestActor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class BookingsController {
  private final BookingService bookingService;

  public BookingsController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @GetMapping("/bookings")
  public Object bookings(HttpServletRequest request) {
    return bookingService.bookings(RequestActor.account(request));
  }

  @GetMapping("/room-occupancy")
  public List<BookingService.RoomOccupancy> roomOccupancy() {
    return bookingService.roomOccupancy();
  }

  @PostMapping("/bookings")
  public BookingService.BookingResult create(
      @RequestBody BookingService.BookingInput input,
      HttpServletRequest request) {
    return bookingService.createBooking(RequestActor.account(request), input);
  }

  @PostMapping("/bookings/{id}/review")
  public BookingService.BookingResult review(
      @PathVariable String id,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.reviewBooking(RequestActor.account(request), id, body.get("decision"));
  }

  @PostMapping("/booking-series/{seriesId}/review")
  public Map<String, Integer> reviewSeries(
      @PathVariable String seriesId,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return Map.of("count", bookingService.reviewRecurringSeries(
        RequestActor.account(request), seriesId, body.get("decision")));
  }

  @PutMapping("/booking-series/{seriesId}/pending")
  public Map<String, Integer> updateSeries(
      @PathVariable String seriesId,
      @RequestBody BookingService.SeriesUpdateInput input,
      HttpServletRequest request) {
    return Map.of("count", bookingService.updatePendingRecurringBookings(
        RequestActor.account(request), seriesId, input));
  }

  @PostMapping("/booking-series/{seriesId}/cancel")
  public Map<String, Integer> cancelSeries(
      @PathVariable String seriesId,
      HttpServletRequest request) {
    return Map.of("count", bookingService.cancelFutureRecurringBookings(
        RequestActor.account(request), seriesId));
  }

  @PostMapping("/bookings/{id}/temporary-pin")
  public BookingService.BookingResult temporaryPin(
      @PathVariable String id,
      @RequestBody BookingService.TemporaryPinInput input,
      HttpServletRequest request) {
    return bookingService.saveTemporaryPin(RequestActor.account(request), id, input);
  }

  @PostMapping("/bookings/{id}/cancel")
  public BookingService.BookingResult cancel(
      @PathVariable String id,
      HttpServletRequest request) {
    return bookingService.cancelBooking(RequestActor.account(request), id);
  }

  @PostMapping("/bookings/{id}/change-room")
  public BookingService.BookingResult changeRoom(
      @PathVariable String id,
      @RequestBody BookingService.ChangeRoomInput input,
      HttpServletRequest request) {
    return bookingService.changeBookingRoom(
        RequestActor.account(request), id, input.roomId(), input.reason());
  }

  @PutMapping("/bookings/{id}/delegate")
  public BookingService.BookingResult delegate(
      @PathVariable String id,
      @RequestBody BookingService.DelegateInput input,
      HttpServletRequest request) {
    return bookingService.setPickupDelegate(RequestActor.account(request), id, input);
  }

  @PostMapping("/bookings/{id}/pickup/propose")
  public BookingService.BookingResult proposePickup(
      @PathVariable String id,
      @RequestBody BookingService.PickupProposalInput input,
      HttpServletRequest request) {
    return bookingService.proposeKeyPickup(RequestActor.account(request), id, input);
  }

  @PostMapping("/bookings/{id}/pickup/schedule")
  public BookingService.BookingResult schedulePickup(
      @PathVariable String id,
      @RequestBody BookingService.PickupProposalInput input,
      HttpServletRequest request) {
    return bookingService.scheduleKeyPickup(RequestActor.account(request), id, input);
  }

  @PostMapping("/bookings/{id}/pickup/accept")
  public BookingService.BookingResult acceptPickup(
      @PathVariable String id,
      @RequestBody Map<String, String> body,
      HttpServletRequest request) {
    return bookingService.acceptKeyPickup(
        RequestActor.account(request), id, body.get("location"));
  }

  @PostMapping("/bookings/access-event")
  public ResponseEntity<BookingService.BookingResult> accessEvent(
      @RequestBody BookingService.AccessEventInput input,
      HttpServletRequest request) {
    BookingService.BookingResult result = bookingService.recordSmartLockAccessEvent(
        RequestActor.account(request), input);
    return result == null
        ? ResponseEntity.noContent().build()
        : ResponseEntity.ok(result);
  }

  @PostMapping("/bookings/{id}/check-in")
  public BookingService.BookingResult checkIn(
      @PathVariable String id,
      HttpServletRequest request) {
    return bookingService.confirmBookingCheckIn(RequestActor.account(request), id);
  }

  @PostMapping("/bookings/{id}/no-show")
  public BookingService.BookingResult noShow(
      @PathVariable String id,
      HttpServletRequest request) {
    return bookingService.confirmBookingNoShow(RequestActor.account(request), id);
  }
}
