package com.bookingclassroom.server;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {
  static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private final EntityManager em;

  public BookingService(EntityManager em) {
    this.em = em;
  }

  @Transactional(readOnly = true)
  public Domain.Account requireAccount(String token) {
    if (token == null || token.isBlank()) {
      throw new UnauthorizedException("Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.");
    }
    Domain.AuthSession session = em.find(Domain.AuthSession.class, token);
    if (session == null) {
      throw new UnauthorizedException("Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.");
    }
    Domain.Account account = em.find(Domain.Account.class, session.username);
    if (account == null || !account.active) {
      throw new UnauthorizedException("Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.");
    }
    return account;
  }

  @Transactional
  public LoginResult login(String username, String password) {
    String normalized = username == null ? "" : username.trim().toLowerCase();
    Domain.Account account = em.find(Domain.Account.class, normalized);
    if (account == null || !account.active || !account.password.equals(password)) {
      throw new UnauthorizedException("Sai tài khoản hoặc mật khẩu.");
    }
    Domain.AuthSession session = new Domain.AuthSession();
    session.token = UUID.randomUUID().toString();
    session.username = account.username;
    session.createdAt = Instant.now().toString();
    em.persist(session);
    return new LoginResult(session.token, account.username, account.role);
  }

  @Transactional(readOnly = true)
  public List<Domain.Room> rooms() {
    return em.createQuery("select r from Room r order by r.floor, r.name", Domain.Room.class)
        .getResultList();
  }

  @Transactional(readOnly = true)
  public Domain.Configuration configuration() {
    return em.find(Domain.Configuration.class, "app");
  }

  @Transactional(readOnly = true)
  public List<Domain.Maintenance> maintenance() {
    return em.createQuery("select m from Maintenance m order by m.date, m.startTime", Domain.Maintenance.class)
        .getResultList();
  }

  @Transactional(readOnly = true)
  public List<Domain.Booking> bookings() {
    return em.createQuery("select b from Booking b order by b.createdAt desc", Domain.Booking.class)
        .getResultList();
  }

  @Transactional(readOnly = true)
  public List<Domain.PinPermission> pinPermissions(Domain.Account account) {
    if ("admin".equals(account.role)) {
      return em.createQuery("select p from PinPermission p", Domain.PinPermission.class).getResultList();
    }
    return em.createQuery(
            "select p from PinPermission p where p.username = :username", Domain.PinPermission.class)
        .setParameter("username", account.username)
        .getResultList();
  }

  @Transactional(readOnly = true)
  public List<Domain.Notification> notifications(Domain.Account account) {
    return em.createQuery(
            "select n from Notification n where n.username = :username order by n.createdAt desc",
            Domain.Notification.class)
        .setParameter("username", account.username)
        .getResultList();
  }

  @Transactional
  public void markNotificationsRead(Domain.Account account) {
    em.createQuery("update Notification n set n.read = true where n.username = :username")
        .setParameter("username", account.username)
        .executeUpdate();
  }

  @Transactional
  public Domain.Notification addNotification(Domain.Account actor, String username, String title, String message) {
    if (!actor.username.equals(username)) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này.");
    }
    Domain.Configuration configuration = configuration();
    if (configuration != null && !configuration.notificationsEnabled) {
      return null;
    }
    return storeNotification(username, title, message);
  }

  @Transactional
  public BookingResult createBooking(Domain.Account actor, BookingInput input) {
    if (!"user".equals(actor.role)) {
      throw new ForbiddenException("Tài khoản không hoạt động hoặc không có quyền thực hiện thao tác này.");
    }
    if (input.requesterUsername() != null && !actor.username.equals(input.requesterUsername().trim().toLowerCase())) {
      throw new ForbiddenException("Bạn không có quyền đặt phòng cho tài khoản khác.");
    }
    em.createQuery("select b.id from Booking b").setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
    List<Domain.Booking> bookings = bookings();
    boolean repeatWeekly = Boolean.TRUE.equals(input.repeatWeekly());
    int repeatWeeks = input.repeatWeeks() == null ? 1 : input.repeatWeeks();
    if (repeatWeekly && (repeatWeeks < 1 || repeatWeeks > 8)) {
      throw new IllegalArgumentException("Số tuần lặp lại phải từ 1 đến 8.");
    }
    if (input.date() == null || !input.date().matches("\\d{4}-\\d{2}-\\d{2}")) {
      throw new IllegalArgumentException("Ngày phải có định dạng YYYY-MM-DD.");
    }
    Domain.Room room = em.find(Domain.Room.class, input.roomId());
    int occurrences = repeatWeekly ? repeatWeeks : 1;
    Domain.Booking firstBooking = null;
    for (int index = 0; index < occurrences; index++) {
      String occurrenceDate;
      try {
        occurrenceDate = LocalDate.parse(input.date()).plusWeeks(index).toString();
      } catch (DateTimeParseException error) {
        throw new IllegalArgumentException("Ngày hoặc khoảng thời gian đặt phòng không hợp lệ.");
      }
      BookingInput occurrence = new BookingInput(
          input.requesterUsername(), input.roomId(), occurrenceDate, input.startTime(), input.endTime(),
          input.purpose(), repeatWeekly, occurrences);
      validateBooking(actor.username, occurrence, bookings, index > 0, index > 0);
      Domain.Booking booking = new Domain.Booking();
      booking.id = "booking-" + UUID.randomUUID();
      booking.requesterUsername = actor.username;
      booking.roomId = input.roomId();
      booking.date = occurrenceDate;
      booking.startTime = input.startTime();
      booking.endTime = input.endTime();
      booking.repeatWeekly = repeatWeekly;
      booking.repeatWeeks = occurrences;
      booking.purpose = input.purpose().trim();
      booking.status = "PENDING";
      booking.createdAt = Instant.now().toString();
      em.persist(booking);
      bookings.add(booking);
      if (firstBooking == null) {
        firstBooking = booking;
      }
    }
    Domain.Notification notification = storeNotification(
        "admin",
        "Có yêu cầu đặt phòng mới",
        actor.username + " yêu cầu đặt phòng " + room.name
            + (repeatWeekly ? " và " + occurrences + " lịch lặp lại." : "."));
    return new BookingResult(firstBooking, notification);
  }

  @Transactional
  public BookingResult reviewBooking(Domain.Account actor, String id, String decision) {
    if (!"admin".equals(actor.role)) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này.");
    }
    if (!"APPROVED".equals(decision) && !"REJECTED".equals(decision)) {
      throw new IllegalArgumentException("Quyết định duyệt không hợp lệ.");
    }
    Domain.Booking target = em.find(Domain.Booking.class, id, LockModeType.PESSIMISTIC_WRITE);
    if (target == null) {
      throw new IllegalArgumentException("Không tìm thấy yêu cầu đặt phòng.");
    }
    if (!"PENDING".equals(target.status)) {
      throw new IllegalArgumentException("Yêu cầu này đã được xử lý.");
    }
    if ("APPROVED".equals(decision)) {
      if (!localDateTime(target.date, target.endTime).isAfter(LocalDateTime.now(ZONE))) {
        throw new IllegalArgumentException("Không thể duyệt yêu cầu đã kết thúc thời gian sử dụng.");
      }
      if (hasMaintenanceConflict(target.roomId, target.date, target.startTime, target.endTime)) {
        throw new IllegalArgumentException("Phòng đã có lịch bảo trì trong khung giờ này.");
      }
      boolean approvedOverlap = bookings().stream().anyMatch(item ->
          !item.id.equals(id)
              && "APPROVED".equals(item.status)
              && item.roomId.equals(target.roomId)
              && overlaps(item, target.date, target.startTime, target.endTime));
      if (approvedOverlap) {
        throw new IllegalArgumentException("Phòng đã có yêu cầu được duyệt trùng thời gian.");
      }
    }
    target.status = decision;
    target.reviewedAt = Instant.now().toString();
    target.reviewedBy = actor.username;
    Domain.Room room = em.find(Domain.Room.class, target.roomId);
    if ("APPROVED".equals(decision) && room != null && "PIN_CODE".equals(room.lockType)) {
      grantPin(target.requesterUsername, target.roomId, actor.username);
    }
    String title = "APPROVED".equals(decision) ? "Yêu cầu đã được duyệt" : "Yêu cầu bị từ chối";
    Domain.Notification notification = storeNotification(
        target.requesterUsername,
        title,
        "Phòng " + (room == null ? target.roomId : room.name) + ", ngày " + target.date + " lúc " + target.startTime + ".");
    return new BookingResult(target, notification);
  }

  @Transactional
  public BookingResult saveTemporaryPin(Domain.Account actor, String id, TemporaryPinInput input) {
    Domain.Booking target = em.find(Domain.Booking.class, id, LockModeType.PESSIMISTIC_WRITE);
    if (target == null) {
      throw new IllegalArgumentException("Không tìm thấy yêu cầu đặt phòng.");
    }
    if (!"APPROVED".equals(target.status)) {
      throw new IllegalArgumentException("Chỉ tạo mã cho yêu cầu đã được duyệt.");
    }
    Domain.Room room = em.find(Domain.Room.class, target.roomId);
    if (room == null || !"PIN_CODE".equals(room.lockType)) {
      throw new IllegalArgumentException("Phòng này không sử dụng khóa mã số.");
    }
    if (target.temporaryPin != null && target.temporaryPin.revokedAt == null) {
      throw new IllegalArgumentException("Yêu cầu đặt phòng đã có mã tạm thời.");
    }
    if (!"admin".equals(actor.role)) {
      if (!"user".equals(actor.role) || !actor.username.equals(target.requesterUsername)) {
        throw new ForbiddenException("Bạn không có quyền tạo mã cho yêu cầu của người khác.");
      }
      boolean permitted = em.createQuery(
              "select count(p) from PinPermission p where p.username = :username and p.roomId = :roomId and p.active = true",
              Long.class)
          .setParameter("username", actor.username)
          .setParameter("roomId", target.roomId)
          .getSingleResult() > 0;
      if (!permitted) {
        throw new ForbiddenException("Quyền tự tạo mã tại phòng này đã bị thu hồi hoặc chưa được cấp.");
      }
    }
    if (input == null || input.code() == null || !input.code().matches("\\d{7}")) {
      throw new IllegalArgumentException("Mật khẩu tạm thời phải gồm đúng 7 chữ số.");
    }
    if (input.lockPasswordId() == null || input.lockPasswordId() < 1 || input.lockPasswordId() > 255) {
      throw new IllegalArgumentException("ID mật khẩu trên khóa phải nằm trong khoảng 1 đến 255.");
    }
    LocalDateTime end = localDateTime(target.date, target.endTime);
    if (!end.isAfter(LocalDateTime.now(ZONE))) {
      throw new IllegalArgumentException("Không thể tạo mã cho phiên sử dụng đã kết thúc.");
    }
    Domain.Configuration configuration = configuration();
    Domain.TemporaryPin pin = new Domain.TemporaryPin();
    pin.code = input.code();
    pin.createdAt = Instant.now().toString();
    pin.createdBy = actor.username;
    pin.validFrom = localDateTime(target.date, target.startTime)
        .minusMinutes(configuration.pinGraceMinutes).atZone(ZONE).toInstant().toString();
    pin.validUntil = end.plusMinutes(configuration.pinGraceMinutes)
        .atZone(ZONE).toInstant().toString();
    pin.lockPasswordId = input.lockPasswordId();
    pin.lockCommandId = input.lockCommandId();
    pin.lockDeliveredAt = input.lockDeliveredAt();
    target.temporaryPin = pin;
    Domain.Notification notification = storeNotification(
        target.requesterUsername,
        "Đã cấp mã mở cửa tạm thời",
        "Mã cho phòng " + room.name + " đã sẵn sàng trong chi tiết đặt phòng.");
    return new BookingResult(target, notification);
  }

  private void validateBooking(
      String username,
      BookingInput input,
      List<Domain.Booking> bookings,
      boolean skipAdvanceWindowCheck,
      boolean skipUserLimitCheck) {
    Domain.Room room = em.find(Domain.Room.class, input.roomId());
    if (room == null || !"AVAILABLE".equals(room.status)) {
      throw new IllegalArgumentException("Phòng không tồn tại hoặc đang tạm khóa/bảo trì.");
    }
    LocalDateTime start = validateDateAndTime(input.date(), input.startTime(), input.endTime());
    Domain.Configuration configuration = configuration();
    long dayDifference = ChronoUnit.DAYS.between(LocalDate.now(ZONE), start.toLocalDate());
    if (!skipAdvanceWindowCheck
      && (dayDifference < configuration.minAdvanceDays || dayDifference > configuration.maxAdvanceDays)) {
      throw new IllegalArgumentException(
          "Chỉ được đặt trước từ " + configuration.minAdvanceDays + " đến " + configuration.maxAdvanceDays + " ngày.");
    }
    if (!localDateTime(input.date(), input.endTime()).isAfter(LocalDateTime.now(ZONE))) {
      throw new IllegalArgumentException("Không thể đặt một khoảng thời gian đã kết thúc.");
    }
    if (hasMaintenanceConflict(input.roomId(), input.date(), input.startTime(), input.endTime())) {
      throw new IllegalArgumentException("Phòng có lịch bảo trì trong khoảng thời gian này.");
    }
    List<Domain.Booking> active = bookings.stream().filter(this::isStillActive).toList();
    if (active.stream().anyMatch(item -> item.roomId.equals(input.roomId()) && overlaps(item, input.date(), input.startTime(), input.endTime()))) {
      throw new IllegalArgumentException("Phòng đã có yêu cầu khác trong khoảng thời gian này.");
    }
    if (active.stream().anyMatch(item -> item.requesterUsername.equals(username) && overlaps(item, input.date(), input.startTime(), input.endTime()))) {
      throw new IllegalArgumentException("Bạn đã có lịch đặt khác trùng thời gian.");
    }
    long ownActive = active.stream().filter(item -> item.requesterUsername.equals(username)).count();
    if (!skipUserLimitCheck && ownActive >= configuration.maxActiveBookingsPerUser) {
      throw new IllegalArgumentException(
          "Mỗi người chỉ có tối đa " + configuration.maxActiveBookingsPerUser + " yêu cầu đang chờ hoặc sắp dùng.");
    }
    if (input.purpose() == null || input.purpose().isBlank()) {
      throw new IllegalArgumentException("Vui lòng nhập mục đích sử dụng phòng.");
    }
  }

  private LocalDateTime validateDateAndTime(String date, String startTime, String endTime) {
    if (date == null || !date.matches("\\d{4}-\\d{2}-\\d{2}")) {
      throw new IllegalArgumentException("Ngày phải có định dạng YYYY-MM-DD.");
    }
    if (startTime == null || endTime == null || !startTime.matches("([01]\\d|2[0-3]):[0-5]\\d")
        || !endTime.matches("([01]\\d|2[0-3]):[0-5]\\d")) {
      throw new IllegalArgumentException("Giờ phải có định dạng HH:mm hợp lệ.");
    }
    LocalDate parsedDate;
    LocalTime parsedStart;
    LocalTime parsedEnd;
    try {
      parsedDate = LocalDate.parse(date);
      parsedStart = LocalTime.parse(startTime);
      parsedEnd = LocalTime.parse(endTime);
    } catch (DateTimeParseException error) {
      throw new IllegalArgumentException("Ngày hoặc khoảng thời gian đặt phòng không hợp lệ.");
    }
    if (!parsedStart.isBefore(parsedEnd)) {
      throw new IllegalArgumentException("Ngày hoặc khoảng thời gian đặt phòng không hợp lệ.");
    }
    return LocalDateTime.of(parsedDate, parsedStart);
  }

  private boolean isStillActive(Domain.Booking booking) {
    return ("PENDING".equals(booking.status) || "APPROVED".equals(booking.status))
        && localDateTime(booking.date, booking.endTime).isAfter(LocalDateTime.now(ZONE));
  }

  private boolean overlaps(Domain.Booking booking, String date, String startTime, String endTime) {
    return booking.date.equals(date) && startTime.compareTo(booking.endTime) < 0 && endTime.compareTo(booking.startTime) > 0;
  }

  private boolean hasMaintenanceConflict(String roomId, String date, String startTime, String endTime) {
    return maintenance().stream().anyMatch(item ->
        item.cancelledAt == null
            && roomId.equals(item.roomId)
            && date.equals(item.date)
            && startTime.compareTo(item.endTime) < 0
            && endTime.compareTo(item.startTime) > 0);
  }

  private void grantPin(String username, String roomId, String adminUsername) {
    List<Domain.PinPermission> existing = em.createQuery(
            "select p from PinPermission p where p.username = :username and p.roomId = :roomId",
            Domain.PinPermission.class)
        .setParameter("username", username)
        .setParameter("roomId", roomId)
        .getResultList();
    Domain.PinPermission permission = existing.isEmpty() ? new Domain.PinPermission() : existing.get(0);
    if (permission.id == null) {
      permission.id = "room-pin-" + UUID.randomUUID();
    }
    permission.username = username;
    permission.roomId = roomId;
    permission.grantedAt = Instant.now().toString();
    permission.grantedBy = adminUsername;
    permission.active = true;
    permission.revokedAt = null;
    permission.revokedBy = null;
    em.merge(permission);
  }

  private Domain.Notification storeNotification(String username, String title, String message) {
    Domain.Configuration configuration = em.find(Domain.Configuration.class, "app");
    if (configuration != null && !configuration.notificationsEnabled) {
      return null;
    }
    Domain.Notification notification = new Domain.Notification();
    notification.id = UUID.randomUUID().toString();
    notification.username = username;
    notification.title = title;
    notification.message = message;
    notification.createdAt = Instant.now().toString();
    notification.read = false;
    em.persist(notification);
    return notification;
  }

  private static LocalDateTime localDateTime(String date, String time) {
    return LocalDateTime.of(LocalDate.parse(date), LocalTime.parse(time));
  }

  public record LoginResult(String token, String username, String role) {}

  public record BookingInput(
      String requesterUsername,
      String roomId,
      String date,
      String startTime,
      String endTime,
      String purpose,
      Boolean repeatWeekly,
      Integer repeatWeeks) {}

  public record BookingResult(Domain.Booking booking, Domain.Notification notification) {}

  public record TemporaryPinInput(
      String code,
      Integer lockPasswordId,
      String lockCommandId,
      String lockDeliveredAt) {}

  public static class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
      super(message);
    }
  }

  public static class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
      super(message);
    }
  }
}
