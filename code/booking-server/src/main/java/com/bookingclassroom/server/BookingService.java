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

  @Transactional
  public Domain.Room createRoom(Domain.Account actor, RoomInput input) {
    requireAdmin(actor);
    RoomInput normalized = normalizeRoom(input);
    if (roomNameTaken(normalized.name(), null)) {
      throw new IllegalArgumentException("Tên phòng đã tồn tại.");
    }
    Domain.Room room = new Domain.Room();
    room.id = "room-" + UUID.randomUUID();
    applyRoom(room, normalized);
    em.persist(room);
    return room;
  }

  @Transactional
  public Domain.Room updateRoom(Domain.Account actor, String id, RoomInput input) {
    requireAdmin(actor);
    Domain.Room room = em.find(Domain.Room.class, id);
    if (room == null) {
      throw new IllegalArgumentException("Không tìm thấy phòng.");
    }
    RoomInput normalized = normalizeRoom(input);
    if (roomNameTaken(normalized.name(), id)) {
      throw new IllegalArgumentException("Tên phòng đã tồn tại.");
    }
    applyRoom(room, normalized);
    return room;
  }

  @Transactional
  public void deleteRoom(Domain.Account actor, String id) {
    requireAdmin(actor);
    Domain.Room room = em.find(Domain.Room.class, id);
    if (room == null) {
      throw new IllegalArgumentException("Không tìm thấy phòng.");
    }
    Long activeBookings = em.createQuery(
            "select count(b) from Booking b where b.roomId = :roomId and b.status in ('PENDING', 'APPROVED')",
            Long.class)
        .setParameter("roomId", id)
        .getSingleResult();
    if (activeBookings > 0) {
      throw new IllegalArgumentException("Phòng còn yêu cầu đang hoạt động nên chưa thể xóa.");
    }
    em.remove(room);
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

  @Transactional
  public Domain.Configuration saveConfiguration(Domain.Account actor, Domain.Configuration input) {
    requireAdmin(actor);
    int[] values = {
      input.minAdvanceDays, input.maxAdvanceDays, input.maxActiveBookingsPerUser,
      input.cancellationCutoffMinutes, input.roomChangeCutoffMinutes, input.pinGraceMinutes,
      input.noShowGraceMinutes == null ? 15 : input.noShowGraceMinutes
    };
    for (int value : values) {
      if (value < 0) {
        throw new IllegalArgumentException("Các tham số cấu hình phải là số nguyên không âm.");
      }
    }
    if (input.minAdvanceDays > input.maxAdvanceDays) {
      throw new IllegalArgumentException("Số ngày đặt tối thiểu không được lớn hơn tối đa.");
    }
    if (input.maxActiveBookingsPerUser < 1) {
      throw new IllegalArgumentException("Mỗi người phải được phép có ít nhất một yêu cầu đang hoạt động.");
    }
    Domain.Configuration current = em.find(Domain.Configuration.class, "app");
    if (current == null) {
      current = new Domain.Configuration();
      current.id = "app";
    }
    current.minAdvanceDays = input.minAdvanceDays;
    current.maxAdvanceDays = input.maxAdvanceDays;
    current.maxActiveBookingsPerUser = input.maxActiveBookingsPerUser;
    current.cancellationCutoffMinutes = input.cancellationCutoffMinutes;
    current.roomChangeCutoffMinutes = input.roomChangeCutoffMinutes;
    current.pinGraceMinutes = input.pinGraceMinutes;
    current.noShowGraceMinutes = input.noShowGraceMinutes == null ? 15 : input.noShowGraceMinutes;
    current.notificationsEnabled = input.notificationsEnabled;
    em.merge(current);
    return current;
  }

  @Transactional
  public Domain.Maintenance createMaintenance(Domain.Account actor, MaintenanceInput input) {
    requireAdmin(actor);
    if (em.find(Domain.Room.class, input.roomId()) == null) {
      throw new IllegalArgumentException("Không tìm thấy phòng.");
    }
    if (input.date() == null || !input.date().matches("\\d{4}-\\d{2}-\\d{2}")
        || input.startTime() == null || input.endTime() == null
        || !input.startTime().matches("\\d{2}:\\d{2}") || !input.endTime().matches("\\d{2}:\\d{2}")
        || input.startTime().compareTo(input.endTime()) >= 0) {
      throw new IllegalArgumentException("Ngày hoặc khoảng giờ bảo trì không hợp lệ.");
    }
    if (input.reason() == null || input.reason().isBlank()) {
      throw new IllegalArgumentException("Vui lòng nhập lý do bảo trì.");
    }
    if (hasMaintenanceConflict(input.roomId(), input.date(), input.startTime(), input.endTime())) {
      throw new IllegalArgumentException("Phòng đã có lịch bảo trì trùng thời gian.");
    }
    boolean approvedOverlap = bookings().stream().anyMatch(item ->
        input.roomId().equals(item.roomId)
            && "APPROVED".equals(item.status)
            && overlaps(item, input.date(), input.startTime(), input.endTime()));
    if (approvedOverlap) {
      throw new IllegalArgumentException("Phòng có yêu cầu đã duyệt trùng thời gian; cần đổi phòng trước khi lên lịch bảo trì.");
    }
    Domain.Maintenance record = new Domain.Maintenance();
    record.id = "maintenance-" + UUID.randomUUID();
    record.roomId = input.roomId();
    record.date = input.date();
    record.startTime = input.startTime();
    record.endTime = input.endTime();
    record.reason = input.reason().trim();
    record.createdAt = Instant.now().toString();
    record.createdBy = actor.username;
    em.persist(record);
    return record;
  }

  @Transactional
  public void cancelMaintenance(Domain.Account actor, String id) {
    requireAdmin(actor);
    Domain.Maintenance record = em.find(Domain.Maintenance.class, id);
    if (record == null) {
      throw new IllegalArgumentException("Không tìm thấy lịch bảo trì.");
    }
    record.cancelledAt = Instant.now().toString();
  }

  @Transactional(readOnly = true)
  public List<Domain.MaintenanceRequest> maintenanceRequests(Domain.Account actor) {
    if ("admin".equals(actor.role)) {
      return em.createQuery(
              "select r from MaintenanceRequest r order by r.requestedAt desc",
              Domain.MaintenanceRequest.class)
          .getResultList();
    }
    return em.createQuery(
            "select r from MaintenanceRequest r where r.requesterUsername = :username order by r.requestedAt desc",
            Domain.MaintenanceRequest.class)
        .setParameter("username", actor.username)
        .getResultList();
  }

  @Transactional
  public Domain.MaintenanceRequest requestMaintenance(Domain.Account actor, String bookingId, String reason) {
    if (!"user".equals(actor.role)) {
      throw new ForbiddenException("Tài khoản không hoạt động hoặc không có quyền thực hiện thao tác này.");
    }
    if (reason == null || reason.isBlank()) {
      throw new IllegalArgumentException("Vui lòng nhập lý do yêu cầu bảo trì.");
    }
    Domain.Booking booking = em.find(Domain.Booking.class, bookingId);
    if (booking == null || !actor.username.equals(booking.requesterUsername)) {
      throw new IllegalArgumentException("Bạn không có quyền báo sự cố cho lượt đặt phòng này.");
    }
    if (!"APPROVED".equals(booking.status)) {
      throw new IllegalArgumentException("Phòng phải được duyệt trước khi báo sự cố.");
    }
    LocalDateTime now = LocalDateTime.now(ZONE);
    if (now.isBefore(localDateTime(booking.date, booking.startTime))
        || now.isAfter(localDateTime(booking.date, booking.endTime))) {
      throw new IllegalArgumentException("Chỉ gửi yêu cầu bảo trì khi bạn đang trong thời gian sử dụng phòng.");
    }
    boolean pending = maintenanceRequests(actor).stream()
        .anyMatch(item -> bookingId.equals(item.bookingId) && "PENDING".equals(item.status));
    if (pending) {
      throw new IllegalArgumentException("Lượt sử dụng này đã có yêu cầu bảo trì đang chờ xử lý.");
    }
    Domain.MaintenanceRequest request = new Domain.MaintenanceRequest();
    request.id = "maintenance-request-" + UUID.randomUUID();
    request.bookingId = bookingId;
    request.roomId = booking.roomId;
    request.requesterUsername = actor.username;
    request.reason = reason.trim();
    request.requestedAt = Instant.now().toString();
    request.status = "PENDING";
    em.persist(request);
    Domain.Room room = em.find(Domain.Room.class, booking.roomId);
    storeNotification("admin", "Có yêu cầu bảo trì mới",
        actor.username + " báo sự cố tại phòng " + (room == null ? booking.roomId : room.name) + ": " + request.reason);
    return request;
  }

  @Transactional
  public Domain.Maintenance scheduleMaintenanceRequest(Domain.Account actor, String requestId, MaintenanceInput input) {
    requireAdmin(actor);
    Domain.MaintenanceRequest request = em.find(Domain.MaintenanceRequest.class, requestId);
    if (request == null || !"PENDING".equals(request.status)) {
      throw new IllegalArgumentException("Yêu cầu bảo trì đã được xử lý.");
    }
    if (!request.roomId.equals(input.roomId())) {
      throw new IllegalArgumentException("Lịch bảo trì phải áp dụng cho đúng phòng được báo sự cố.");
    }
    Domain.Maintenance record = createMaintenance(actor, input);
    request.status = "SCHEDULED";
    request.reviewedAt = Instant.now().toString();
    request.reviewedBy = actor.username;
    request.maintenanceRecordId = record.id;
    Domain.Room room = em.find(Domain.Room.class, request.roomId);
    storeNotification(request.requesterUsername, "Yêu cầu bảo trì đã được tiếp nhận",
        "Phòng " + (room == null ? request.roomId : room.name) + " được lên lịch bảo trì "
            + record.date + " " + record.startTime + "–" + record.endTime + ".");
    return record;
  }

  @Transactional
  public Domain.MaintenanceRequest rejectMaintenanceRequest(Domain.Account actor, String requestId, String note) {
    requireAdmin(actor);
    Domain.MaintenanceRequest request = em.find(Domain.MaintenanceRequest.class, requestId);
    if (request == null || !"PENDING".equals(request.status)) {
      throw new IllegalArgumentException("Yêu cầu bảo trì đã được xử lý.");
    }
    request.status = "REJECTED";
    request.reviewedAt = Instant.now().toString();
    request.reviewedBy = actor.username;
    request.adminNote = note == null || note.isBlank() ? null : note.trim();
    Domain.Room room = em.find(Domain.Room.class, request.roomId);
    String message = "Phòng " + (room == null ? request.roomId : room.name) + ".";
    if (request.adminNote != null) {
      message += " Ghi chú: " + request.adminNote;
    }
    storeNotification(request.requesterUsername, "Yêu cầu bảo trì chưa được tiếp nhận", message);
    return request;
  }

  @Transactional
  public Domain.PinPermission grantRoomPin(Domain.Account actor, String username, String roomId) {
    requireAdmin(actor);
    Domain.Room room = em.find(Domain.Room.class, roomId);
    if (room == null || !"PIN_CODE".equals(room.lockType)) {
      throw new IllegalArgumentException("Chỉ cấp quyền tự tạo mã cho phòng dùng khóa mã số.");
    }
    grantPin(username, roomId, actor.username);
    return em.createQuery(
            "select p from PinPermission p where p.username = :username and p.roomId = :roomId",
            Domain.PinPermission.class)
        .setParameter("username", username)
        .setParameter("roomId", roomId)
        .getSingleResult();
  }

  @Transactional
  public Domain.PinPermission revokeRoomPin(Domain.Account actor, String username, String roomId) {
    requireAdmin(actor);
    List<Domain.PinPermission> matches = em.createQuery(
            "select p from PinPermission p where p.username = :username and p.roomId = :roomId and p.active = true",
            Domain.PinPermission.class)
        .setParameter("username", username)
        .setParameter("roomId", roomId)
        .getResultList();
    if (matches.isEmpty()) {
      throw new IllegalArgumentException("Người dùng không có quyền đang hoạt động tại phòng này.");
    }
    Domain.PinPermission permission = matches.get(0);
    permission.active = false;
    permission.revokedAt = Instant.now().toString();
    permission.revokedBy = actor.username;
    Domain.Room room = em.find(Domain.Room.class, roomId);
    storeNotification(username, "Đã thu hồi quyền tự tạo mã",
        "Quyền tự tạo mật khẩu tạm thời của phòng " + (room == null ? roomId : room.name) + " đã bị thu hồi.");
    return permission;
  }

  @Transactional
  public BookingResult cancelBooking(Domain.Account actor, String id) {
    if (!"user".equals(actor.role)) {
      throw new ForbiddenException("Tài khoản không hoạt động hoặc không có quyền thực hiện thao tác này.");
    }
    Domain.Booking booking = em.find(Domain.Booking.class, id, LockModeType.PESSIMISTIC_WRITE);
    if (booking == null || !actor.username.equals(booking.requesterUsername)) {
      throw new IllegalArgumentException("Bạn không có quyền hủy yêu cầu này.");
    }
    if (!"PENDING".equals(booking.status) && !"APPROVED".equals(booking.status)) {
      throw new IllegalArgumentException("Yêu cầu này không thể hủy.");
    }
    long minutesUntilStart = ChronoUnit.MINUTES.between(LocalDateTime.now(ZONE), localDateTime(booking.date, booking.startTime));
    if (minutesUntilStart <= 0) {
      throw new IllegalArgumentException("Không thể hủy sau khi phiên sử dụng đã bắt đầu.");
    }
    Domain.Configuration configuration = configuration();
    int cutoff = configuration == null ? 30 : configuration.cancellationCutoffMinutes;
    if ("APPROVED".equals(booking.status) && minutesUntilStart < cutoff) {
      throw new IllegalArgumentException("Yêu cầu đã duyệt chỉ được hủy trước ít nhất " + cutoff + " phút.");
    }
    booking.status = "CANCELLED";
    if (booking.temporaryPin != null) {
      booking.temporaryPin.revokedAt = Instant.now().toString();
    }
    Domain.Room room = em.find(Domain.Room.class, booking.roomId);
    Domain.Notification notification = storeNotification(
        "admin", "Yêu cầu đã được hủy", actor.username + " đã hủy yêu cầu phòng " + (room == null ? booking.roomId : room.name) + ".");
    return new BookingResult(booking, notification);
  }

  @Transactional
  public BookingResult changeBookingRoom(Domain.Account actor, String id, String newRoomId, String reason) {
    requireAdmin(actor);
    Domain.Booking booking = em.find(Domain.Booking.class, id, LockModeType.PESSIMISTIC_WRITE);
    if (booking == null || !"APPROVED".equals(booking.status)) {
      throw new IllegalArgumentException("Chỉ đổi phòng cho yêu cầu đã duyệt.");
    }
    if (booking.roomId.equals(newRoomId)) {
      throw new IllegalArgumentException("Hãy chọn một phòng khác.");
    }
    if (reason == null || reason.isBlank()) {
      throw new IllegalArgumentException("Vui lòng nhập lý do đổi phòng.");
    }
    Domain.Configuration configuration = configuration();
    int cutoff = configuration == null ? 30 : configuration.roomChangeCutoffMinutes;
    long minutesUntilStart = ChronoUnit.MINUTES.between(LocalDateTime.now(ZONE), localDateTime(booking.date, booking.startTime));
    if (minutesUntilStart < cutoff) {
      throw new IllegalArgumentException("Chỉ được đổi phòng trước giờ bắt đầu ít nhất " + cutoff + " phút.");
    }
    Domain.Room oldRoom = em.find(Domain.Room.class, booking.roomId);
    Domain.Room room = em.find(Domain.Room.class, newRoomId);
    if (oldRoom == null) {
      throw new IllegalArgumentException("Không tìm thấy thông tin phòng hiện tại.");
    }
    if (room == null || !"AVAILABLE".equals(room.status)) {
      throw new IllegalArgumentException("Phòng thay thế không khả dụng.");
    }
    if (!room.lockType.equals(oldRoom.lockType)) {
      throw new IllegalArgumentException("Phòng thay thế phải có cùng loại khóa với phòng hiện tại.");
    }
    if (room.capacity < oldRoom.capacity) {
      throw new IllegalArgumentException("Phòng thay thế phải có sức chứa bằng hoặc lớn hơn phòng hiện tại.");
    }
    java.util.Set<String> replacementEquipment = new java.util.HashSet<>();
    if (room.equipment != null) {
      for (String item : room.equipment) {
        replacementEquipment.add(item.trim().toLowerCase());
      }
    }
    if (oldRoom.equipment != null && oldRoom.equipment.stream()
        .anyMatch(item -> !replacementEquipment.contains(item.trim().toLowerCase()))) {
      throw new IllegalArgumentException("Phòng thay thế phải có đầy đủ thiết bị của phòng hiện tại.");
    }
    if (hasMaintenanceConflict(newRoomId, booking.date, booking.startTime, booking.endTime)) {
      throw new IllegalArgumentException("Phòng thay thế có lịch bảo trì trong khung giờ này.");
    }
    boolean overlap = bookings().stream().anyMatch(item ->
        !item.id.equals(id)
            && ("PENDING".equals(item.status) || "APPROVED".equals(item.status))
            && newRoomId.equals(item.roomId)
            && overlaps(item, booking.date, booking.startTime, booking.endTime));
    if (overlap) {
      throw new IllegalArgumentException("Phòng thay thế đã có yêu cầu chờ hoặc yêu cầu được duyệt trùng thời gian.");
    }
    booking.roomId = newRoomId;
    if (booking.temporaryPin != null) {
      booking.temporaryPin.revokedAt = Instant.now().toString();
    }
    if ("PIN_CODE".equals(room.lockType)) {
      grantPin(booking.requesterUsername, newRoomId, actor.username);
    }
    Domain.Notification notification = storeNotification(
        booking.requesterUsername,
        "Đặt phòng đã được đổi phòng",
        oldRoom.name + " được đổi sang " + room.name + ". Lý do: " + reason.trim());
    return new BookingResult(booking, notification);
  }

  @Transactional(readOnly = true)
  public List<Domain.Account> accounts(Domain.Account actor) {
    requireAdmin(actor);
    return em.createQuery("select a from Account a order by a.username", Domain.Account.class).getResultList();
  }

  @Transactional
  public Domain.Account registerAccount(String username, String password, String recoveryCode) {
    return storeAccount(username, password, recoveryCode, "user", true, null);
  }

  @Transactional
  public Domain.Account createManagedAccount(Domain.Account actor, String username, String password, String recoveryCode, String role) {
    requireAdmin(actor);
    if (!"admin".equals(role) && !"user".equals(role)) {
      throw new IllegalArgumentException("Quyền tài khoản không hợp lệ.");
    }
    return storeAccount(username, password, recoveryCode, role, true, null);
  }

  @Transactional
  public Domain.Account updateManagedAccount(
      Domain.Account actor, String username, String password, String recoveryCode, String role, Boolean active) {
    requireAdmin(actor);
    Domain.Account account = em.find(Domain.Account.class, username);
    if (account == null) {
      throw new IllegalArgumentException("Không tìm thấy tài khoản.");
    }
    if (actor.username.equals(username) && (Boolean.FALSE.equals(active) || "user".equals(role))) {
      throw new IllegalArgumentException("Không thể tự khóa hoặc thay đổi quyền của tài khoản đang đăng nhập.");
    }
    if (password != null && password.length() < 4) {
      throw new IllegalArgumentException("Mật khẩu cần ít nhất 4 ký tự.");
    }
    if (recoveryCode != null && recoveryCode.length() < 4) {
      throw new IllegalArgumentException("Mã khôi phục cần ít nhất 4 ký tự.");
    }
    if (password != null) {
      account.password = password;
    }
    if (recoveryCode != null) {
      account.recoveryCode = recoveryCode;
    }
    if (role != null) {
      account.role = role;
    }
    if (active != null) {
      account.active = active;
    }
    return account;
  }

  @Transactional
  public void deleteManagedAccount(Domain.Account actor, String username) {
    requireAdmin(actor);
    if (actor.username.equals(username)) {
      throw new IllegalArgumentException("Không thể xóa tài khoản đang đăng nhập.");
    }
    Domain.Account account = em.find(Domain.Account.class, username);
    if (account == null) {
      throw new IllegalArgumentException("Không tìm thấy tài khoản.");
    }
    Long activeBookings = em.createQuery(
            "select count(b) from Booking b where b.requesterUsername = :username and b.status in ('PENDING', 'APPROVED')",
            Long.class)
        .setParameter("username", username)
        .getSingleResult();
    if (activeBookings > 0) {
      throw new IllegalArgumentException("Tài khoản còn yêu cầu đặt phòng đang hoạt động. Hãy xử lý trước khi xóa.");
    }
    em.remove(account);
  }

  @Transactional
  public void changePassword(Domain.Account actor, String currentPassword, String newPassword) {
    if (currentPassword == null || !currentPassword.equals(actor.password)) {
      throw new IllegalArgumentException("Mật khẩu hiện tại không đúng.");
    }
    if (newPassword == null || newPassword.length() < 4) {
      throw new IllegalArgumentException("Mật khẩu mới cần ít nhất 4 ký tự.");
    }
    actor.password = newPassword;
  }

  @Transactional
  public void resetPassword(String username, String recoveryCode, String newPassword) {
    if (newPassword == null || newPassword.length() < 4) {
      throw new IllegalArgumentException("Mật khẩu mới cần ít nhất 4 ký tự.");
    }
    String normalized = username == null ? "" : username.trim().toLowerCase();
    Domain.Account account = em.find(Domain.Account.class, normalized);
    if (account == null || account.recoveryCode == null || !account.recoveryCode.equals(recoveryCode)) {
      throw new IllegalArgumentException("Tên đăng nhập hoặc mã khôi phục không đúng.");
    }
    account.password = newPassword;
  }

  private Domain.Account storeAccount(
      String username, String password, String recoveryCode, String role, boolean active, Domain.Account existing) {
    String normalized = username == null ? "" : username.trim().toLowerCase();
    if (!normalized.matches("[a-z0-9._-]{3,30}")) {
      throw new IllegalArgumentException("Tên đăng nhập cần 3–30 ký tự: chữ thường, số, dấu chấm, gạch ngang.");
    }
    if (password == null || password.length() < 4 || recoveryCode == null || recoveryCode.length() < 4) {
      throw new IllegalArgumentException("Mật khẩu và mã khôi phục cần ít nhất 4 ký tự.");
    }
    if (existing == null && em.find(Domain.Account.class, normalized) != null) {
      throw new IllegalArgumentException("Tên đăng nhập đã tồn tại.");
    }
    Domain.Account account = existing == null ? new Domain.Account() : existing;
    account.username = normalized;
    account.password = password;
    account.recoveryCode = recoveryCode;
    account.role = role;
    account.active = active;
    if (existing == null) {
      em.persist(account);
    }
    return account;
  }

  private static void requireAdmin(Domain.Account actor) {
    if (actor == null || !"admin".equals(actor.role)) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này.");
    }
  }

  private boolean roomNameTaken(String name, String exceptId) {
    Long count = em.createQuery(
            "select count(r) from Room r where lower(r.name) = :name and r.id <> :exceptId",
            Long.class)
        .setParameter("name", name.toLowerCase())
        .setParameter("exceptId", exceptId == null ? "" : exceptId)
        .getSingleResult();
    return count > 0;
  }

  private static RoomInput normalizeRoom(RoomInput input) {
    String name = input.name() == null ? "" : input.name().trim().toUpperCase();
    int floor = input.floor() == null ? 0 : input.floor();
    int capacity = input.capacity() == null ? 0 : input.capacity();
    String location = input.location() == null || input.location().isBlank()
        ? "Tầng " + floor + ", tòa nhà A"
        : input.location().trim();
    List<String> equipment = input.equipment() == null
        ? List.of()
        : input.equipment().stream().map(String::trim).filter(item -> !item.isBlank()).toList();
    String lockType = input.lockType();
    String status = input.status();
    if (name.isBlank()) {
      throw new IllegalArgumentException("Tên phòng không được để trống.");
    }
    if (floor < 1 || floor > 8) {
      throw new IllegalArgumentException("Tầng phải nằm trong khoảng 1 đến 8.");
    }
    if (capacity < 1) {
      throw new IllegalArgumentException("Sức chứa phải là số nguyên dương.");
    }
    if (!"PIN_CODE".equals(lockType) && !"PHYSICAL_KEY".equals(lockType)) {
      throw new IllegalArgumentException("Loại khóa không hợp lệ.");
    }
    if (!"AVAILABLE".equals(status) && !"MAINTENANCE".equals(status)) {
      throw new IllegalArgumentException("Trạng thái phòng không hợp lệ.");
    }
    return new RoomInput(name, floor, location, capacity, equipment, lockType, status);
  }

  private static void applyRoom(Domain.Room room, RoomInput input) {
    room.name = input.name();
    room.floor = input.floor();
    room.location = input.location();
    room.capacity = input.capacity();
    room.equipment = new java.util.ArrayList<>(input.equipment());
    room.lockType = input.lockType();
    room.status = input.status();
  }

  private static LocalDateTime localDateTime(String date, String time) {
    return LocalDateTime.of(LocalDate.parse(date), LocalTime.parse(time));
  }

  public record RoomInput(
      String name,
      Integer floor,
      String location,
      Integer capacity,
      List<String> equipment,
      String lockType,
      String status) {}

  public record MaintenanceInput(
      String roomId,
      String date,
      String startTime,
      String endTime,
      String reason) {}

  public record ChangeRoomInput(String roomId, String reason) {}

  public record PinInput(String username, String roomId) {}

  public record AccountInput(String username, String password, String recoveryCode, String role, Boolean active) {}

  public record PasswordChangeInput(String currentPassword, String newPassword) {}

  public record PasswordResetInput(String username, String recoveryCode, String newPassword) {}

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
