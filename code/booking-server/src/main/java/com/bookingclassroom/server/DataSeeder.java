package com.bookingclassroom.server;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

@Component
public class DataSeeder implements CommandLineRunner {
  private static final int[] CAPACITIES = {30, 45, 60, 35, 50, 40, 80};
  private static final String[][] EQUIPMENT = {
    {"Máy chiếu", "Điều hòa"},
    {"TV", "Bảng thông minh"},
    {"Máy chiếu", "Micro"},
    {"Điều hòa", "Camera"},
    {"Máy chiếu", "Loa"},
    {"TV", "Điều hòa"},
    {"Máy chiếu", "Micro", "Camera"},
  };

  private final EntityManager em;

  public DataSeeder(EntityManager em) {
    this.em = em;
  }

  @Override
  @Transactional
  public void run(String... args) {
    Long accounts = em.createQuery("select count(a) from Account a", Long.class).getSingleResult();
    if (accounts == 0) {
      account("admin", "1", "admin");
      account("user", "2", "user");
      profile("admin", "Cán bộ quản lý cơ sở vật chất");
      profile("user", "Giảng viên");
      seedSmartLock();
      seedRooms();
      seedConfiguration();
      notify("admin", "Chào mừng đến ứng dụng đặt phòng", "Tài khoản của bạn đã sẵn sàng để sử dụng.");
      notify("user", "Chào mừng đến ứng dụng đặt phòng", "Tài khoản của bạn đã sẵn sàng để sử dụng.");
    }
    em.createQuery("update Configuration c set c.noShowGraceMinutes = 15 where c.noShowGraceMinutes is null")
        .executeUpdate();
    em.createQuery("update Booking b set b.repeatWeekly = false where b.repeatWeekly is null")
        .executeUpdate();
    em.createQuery("update Booking b set b.repeatWeeks = 1 where b.repeatWeeks is null")
        .executeUpdate();
    em.createQuery("update Account a set a.recoveryCode = '111111' where a.username = 'admin' and a.recoveryCode is null")
        .executeUpdate();
    em.createQuery("update Account a set a.recoveryCode = '222222' where a.username = 'user' and a.recoveryCode is null")
        .executeUpdate();
    seedMaintenanceWindowIfEmpty();
  }

  private void seedMaintenanceWindowIfEmpty() {
    Long count = em.createQuery("select count(m) from Maintenance m", Long.class).getSingleResult();
    if (count > 0) return;
    LocalDate today = LocalDate.now(BookingService.ZONE);
    for (int offset = 1; offset <= 3; offset += 1) {
      Domain.Maintenance record = new Domain.Maintenance();
      record.id = "maintenance-a103-" + offset;
      record.roomId = "room-floor-1-3";
      record.date = today.plusDays(offset).toString();
      record.startTime = "08:00";
      record.endTime = "10:00";
      record.reason = "Bảo trì định kỳ máy chiếu";
      record.createdAt = Instant.now().toString();
      record.createdBy = "admin";
      em.persist(record);
    }
  }

  private void seedRooms() {
    for (int floor = 1; floor <= 8; floor += 1) {
      for (int ordinal = 1; ordinal <= 7; ordinal += 1) {
        int roomIndex = ordinal - 1;
        boolean legacyA101 = floor == 1 && ordinal == 1;
        boolean legacyB202 = floor == 2 && ordinal == 2;
        Domain.Room room = new Domain.Room();
        room.id = legacyA101 ? "room-a101" : legacyB202 ? "room-b202" : "room-floor-" + floor + "-" + ordinal;
        room.name = legacyB202 ? "B202" : "A" + floor + "0" + ordinal;
        room.floor = floor;
        room.location = "Tầng " + floor + ", tòa nhà A";
        room.capacity = CAPACITIES[roomIndex];
        room.equipment = List.of(EQUIPMENT[roomIndex]);
        room.lockType = legacyB202 || roomIndex % 3 == 2 ? "PHYSICAL_KEY" : "PIN_CODE";
        room.status = "AVAILABLE";
        room.createdAt = Instant.now().toString();
        em.persist(room);
      }
    }
  }

  private void seedConfiguration() {
    Domain.Configuration configuration = new Domain.Configuration();
    configuration.id = "app";
    configuration.minAdvanceDays = 1;
    configuration.maxAdvanceDays = 3;
    configuration.maxActiveBookingsPerUser = 2;
    configuration.cancellationCutoffMinutes = 30;
    configuration.roomChangeCutoffMinutes = 30;
    configuration.pinGraceMinutes = 10;
    configuration.noShowGraceMinutes = 15;
    configuration.notificationsEnabled = true;
    em.persist(configuration);
  }

  private void account(String username, String password, String role) {
    Domain.Account account = new Domain.Account();
    account.username = username;
    account.password = password;
    account.recoveryCode = "admin".equals(username) ? "111111" : "222222";
    account.role = role;
    account.active = true;
    em.persist(account);
  }

  private void profile(String username, String fullName) {
    Domain.Profile profile = new Domain.Profile();
    profile.username = username;
    profile.fullName = fullName;
    profile.email = "";
    profile.phone = "";
    profile.department = "";
    em.persist(profile);
  }

  private void seedSmartLock() {
    Domain.ManagedSmartLock lock = new Domain.ManagedSmartLock();
    lock.id = "primary-smart-lock";
    lock.displayName = "SmartLock DLWA12";
    lock.model = "DLWA12";
    lock.smartLockAeId = "Sdd6f3763-b655-43ad-87d0-3862be2a1201";
    lock.smartLockDeviceId = "Sdd6f3763-b655-43ad-87d0-3862be2a1201";
    lock.smartLockDeviceName = "smartlock_0001";
    lock.oneIotBroker = "oneiot.com.vn";
    lock.oneIotPort = 2111;
    lock.oneIotCseId = "/in-cse";
    lock.toolDeviceId = "Sf391c192-3997-4e6c-a31b-abffac140b4c";
    lock.nextPasswordId = 1;
    em.persist(lock);
  }

  private void notify(String username, String title, String message) {
    Domain.Notification notification = new Domain.Notification();
    notification.id = UUID.randomUUID().toString();
    notification.username = username;
    notification.title = title;
    notification.message = message;
    notification.createdAt = Instant.now().toString();
    notification.read = false;
    em.persist(notification);
  }
}
