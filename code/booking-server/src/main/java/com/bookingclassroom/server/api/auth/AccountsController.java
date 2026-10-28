package com.bookingclassroom.server.api.auth;

import com.bookingclassroom.server.BookingService;
import com.bookingclassroom.server.Domain;
import com.bookingclassroom.server.security.RequestActor;
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
public class AccountsController {
  private final BookingService bookingService;

  public AccountsController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @PostMapping("/auth/login")
  public BookingService.LoginResult login(@RequestBody Map<String, String> body) {
    return bookingService.login(body.get("username"), body.get("password"));
  }

  @PostMapping("/auth/register")
  public BookingService.LoginResult register(@RequestBody BookingService.AccountInput input) {
    bookingService.registerAccount(input.username(), input.password(), input.recoveryCode());
    return bookingService.login(input.username(), input.password());
  }

  @PostMapping("/auth/change-password")
  public Map<String, Boolean> changePassword(
      @RequestBody BookingService.PasswordChangeInput input,
      HttpServletRequest request) {
    bookingService.changePassword(
        RequestActor.account(request), input.currentPassword(), input.newPassword());
    return Map.of("ok", true);
  }

  @PostMapping("/auth/reset-password")
  public Map<String, Boolean> resetPassword(@RequestBody BookingService.PasswordResetInput input) {
    bookingService.resetPassword(input.username(), input.recoveryCode(), input.newPassword());
    return Map.of("ok", true);
  }

  @GetMapping("/accounts")
  public Object accounts(HttpServletRequest request) {
    return bookingService.accounts(RequestActor.account(request));
  }

  @PostMapping("/accounts")
  public Domain.Account createAccount(
      @RequestBody BookingService.AccountInput input,
      HttpServletRequest request) {
    return bookingService.createManagedAccount(
        RequestActor.account(request), input.username(), input.password(),
        input.recoveryCode(), input.role());
  }

  @PutMapping("/accounts/{username}")
  public Domain.Account updateAccount(
      @PathVariable String username,
      @RequestBody BookingService.AccountInput input,
      HttpServletRequest request) {
    return bookingService.updateManagedAccount(
        RequestActor.account(request), username, input.password(),
        input.recoveryCode(), input.role(), input.active());
  }

  @DeleteMapping("/accounts/{username}")
  public ResponseEntity<Void> deleteAccount(
      @PathVariable String username,
      HttpServletRequest request) {
    bookingService.deleteManagedAccount(RequestActor.account(request), username);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/profiles/{username}")
  public Domain.Profile profile(@PathVariable String username, HttpServletRequest request) {
    return bookingService.profile(RequestActor.account(request), username);
  }

  @PutMapping("/profiles/{username}")
  public Domain.Profile saveProfile(
      @PathVariable String username,
      @RequestBody Domain.Profile input,
      HttpServletRequest request) {
    return bookingService.saveProfile(RequestActor.account(request), username, input);
  }
}
