package com.bookingclassroom.server.api.rooms;

import com.bookingclassroom.server.BookingService;
import com.bookingclassroom.server.Domain;
import com.bookingclassroom.server.security.RequestActor;
import jakarta.servlet.http.HttpServletRequest;
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
public class RoomsController {
  private final BookingService bookingService;

  public RoomsController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @GetMapping("/rooms")
  public Object rooms() {
    return bookingService.rooms();
  }

  @PostMapping("/rooms")
  public Domain.Room createRoom(
      @RequestBody BookingService.RoomInput input,
      HttpServletRequest request) {
    return bookingService.createRoom(RequestActor.account(request), input);
  }

  @PutMapping("/rooms/{id}")
  public Domain.Room updateRoom(
      @PathVariable String id,
      @RequestBody BookingService.RoomInput input,
      HttpServletRequest request) {
    return bookingService.updateRoom(RequestActor.account(request), id, input);
  }

  @DeleteMapping("/rooms/{id}")
  public ResponseEntity<Void> deleteRoom(@PathVariable String id, HttpServletRequest request) {
    bookingService.deleteRoom(RequestActor.account(request), id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/configuration")
  public Domain.Configuration configuration() {
    return bookingService.configuration();
  }

  @PutMapping("/configuration")
  public Domain.Configuration saveConfiguration(
      @RequestBody Domain.Configuration input,
      HttpServletRequest request) {
    return bookingService.saveConfiguration(RequestActor.account(request), input);
  }
}
