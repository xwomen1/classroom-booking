package com.bookingclassroom.server;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Converter;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class Domain {
  private Domain() {}

  @Entity(name = "Account")
  @Table(name = "accounts")
  public static class Account {
    @Id
    public String username;
    public String password;
    public String role;
    public boolean active = true;
  }

  @Entity(name = "Room")
  @Table(name = "rooms")
  public static class Room {
    @Id
    public String id;
    public String name;
    public int floor;
    public String location;
    public int capacity;
    @Convert(converter = EquipmentConverter.class)
    @Column(length = 1000)
    public List<String> equipment = new ArrayList<>();
    public String lockType;
    public String status;
  }

  @Entity(name = "Booking")
  @Table(name = "bookings")
  public static class Booking {
    @Id
    public String id;
    public String requesterUsername;
    public String roomId;
    public String date;
    public String startTime;
    public String endTime;
    public boolean repeatWeekly;
    public int repeatWeeks;
    @Column(length = 1000)
    public String purpose;
    public String status;
    public String createdAt;
    public String reviewedAt;
    public String reviewedBy;
    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "code", column = @Column(name = "temporary_pin_code")),
        @AttributeOverride(name = "createdAt", column = @Column(name = "temporary_pin_created_at")),
        @AttributeOverride(name = "createdBy", column = @Column(name = "temporary_pin_created_by")),
        @AttributeOverride(name = "validFrom", column = @Column(name = "temporary_pin_valid_from")),
        @AttributeOverride(name = "validUntil", column = @Column(name = "temporary_pin_valid_until")),
        @AttributeOverride(name = "lockPasswordId", column = @Column(name = "temporary_pin_lock_password_id")),
        @AttributeOverride(name = "lockCommandId", column = @Column(name = "temporary_pin_lock_command_id")),
        @AttributeOverride(name = "lockDeliveredAt", column = @Column(name = "temporary_pin_lock_delivered_at")),
        @AttributeOverride(name = "revokedAt", column = @Column(name = "temporary_pin_revoked_at"))
    })
    public TemporaryPin temporaryPin;
  }

  @Embeddable
  public static class TemporaryPin {
    public String code;
    public String createdAt;
    public String createdBy;
    public String validFrom;
    public String validUntil;
    public Integer lockPasswordId;
    public String lockCommandId;
    public String lockDeliveredAt;
    public String revokedAt;
  }

  @Entity(name = "Maintenance")
  @Table(name = "maintenance_records")
  public static class Maintenance {
    @Id
    public String id;
    public String roomId;
    public String date;
    public String startTime;
    public String endTime;
    public String reason;
    public String createdAt;
    public String createdBy;
    public String cancelledAt;
  }

  @Entity(name = "PinPermission")
  @Table(name = "pin_permissions")
  public static class PinPermission {
    @Id
    public String id;
    public String username;
    public String roomId;
    public String grantedAt;
    public String grantedBy;
    public boolean active = true;
    public String revokedAt;
    public String revokedBy;
  }

  @Entity(name = "Notification")
  @Table(name = "notifications")
  public static class Notification {
    @Id
    public String id;
    public String username;
    public String title;
    @Column(length = 1000)
    public String message;
    public String createdAt;
    public boolean read;
  }

  @Entity(name = "AuthSession")
  @Table(name = "auth_sessions")
  public static class AuthSession {
    @Id
    public String token;
    public String username;
    public String createdAt;
  }

  @Entity(name = "Configuration")
  @Table(name = "app_configuration")
  public static class Configuration {
    @Id
    public String id;
    public int minAdvanceDays;
    public int maxAdvanceDays;
    public int maxActiveBookingsPerUser;
    public int cancellationCutoffMinutes;
    public int roomChangeCutoffMinutes;
    public int pinGraceMinutes;
    public boolean notificationsEnabled;
  }

  @Converter
  public static class EquipmentConverter implements AttributeConverter<List<String>, String> {
    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
      if (attribute == null || attribute.isEmpty()) {
        return "";
      }
      return String.join("\n", attribute);
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
      if (dbData == null || dbData.isBlank()) {
        return new ArrayList<>();
      }
      return new ArrayList<>(Arrays.asList(dbData.split("\n")));
    }
  }
}
