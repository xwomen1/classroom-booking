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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    public String recoveryCode;
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
    public String createdAt;
    public String updatedAt;
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
    public Boolean repeatWeekly;
    public Integer repeatWeeks;
    public String recurringSeriesId;
    public Integer recurringWeekIndex;
    @Column(length = 1000)
    public String purpose;
    public String status;
    public String createdAt;
    public String reviewedAt;
    public String reviewedBy;
    public Boolean userCanGeneratePin;
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
        @AttributeOverride(name = "lockDeliveryAttemptedAt", column = @Column(name = "temporary_pin_lock_delivery_attempted_at")),
        @AttributeOverride(name = "lockDeliveryError", column = @Column(name = "temporary_pin_lock_delivery_error", length = 1000)),
        @AttributeOverride(name = "revokedAt", column = @Column(name = "temporary_pin_revoked_at"))
    })
    public TemporaryPin temporaryPin;
    @Convert(converter = KeyPickupAppointmentConverter.class)
    @Column(length = 10000)
    public KeyPickupAppointment keyPickupAppointment;
    @Convert(converter = KeyPickupNegotiationConverter.class)
    @Column(length = 20000)
    public KeyPickupNegotiation keyPickupNegotiation;
    @Convert(converter = PickupDelegateConverter.class)
    @Column(length = 10000)
    public PickupDelegate pickupDelegate;
    @Convert(converter = RoomChangeListConverter.class)
    @Column(length = 20000)
    public List<RoomChange> roomChanges = new ArrayList<>();
    @Convert(converter = AccessEventListConverter.class)
    @Column(length = 20000)
    public List<SmartLockAccessEvent> smartLockAccessEvents = new ArrayList<>();
    public String checkedInAt;
    public String checkInConfirmedBy;
    public String checkedOutAt;
    public String noShowAt;
    public String noShowMarkedBy;
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
    public String lockDeliveryAttemptedAt;
    @Column(length = 1000)
    public String lockDeliveryError;
    public String revokedAt;
  }

  public static class KeyPickupAppointment {
    public String date;
    public String time;
    public String location;
    public String createdAt;
    public String createdBy;
    public String agreedAt;
    public String agreedBy;
  }

  public static class KeyPickupProposal {
    public String id;
    public String date;
    public String time;
    public String location;
    public String proposedAt;
    public String proposedBy;
    public String proposedByRole;
  }

  public static class KeyPickupNegotiation {
    public String status;
    public KeyPickupProposal currentProposal;
    public List<KeyPickupProposal> history = new ArrayList<>();
    public String agreedAt;
    public String agreedBy;
  }

  public static class PickupDelegate {
    public String fullName;
    public String studentId;
    public String delegatedAt;
  }

  public static class RoomChange {
    public String fromRoomId;
    public String toRoomId;
    public String changedAt;
    public String changedBy;
    public String reason;
  }

  public static class SmartLockAccessEvent {
    public String type;
    public String occurredAt;
    public String trait;
    public String deviceId;
    public String topic;
  }

  @Entity(name = "Profile")
  @Table(name = "user_profiles")
  public static class Profile {
    @Id
    public String username;
    public String fullName;
    public String email;
    public String phone;
    public String department;
  }

  @Entity(name = "ManagedSmartLock")
  @Table(name = "managed_smart_locks")
  public static class ManagedSmartLock {
    @Id
    public String id;
    public String displayName;
    public String model;
    public String smartLockAeId;
    public String smartLockDeviceId;
    public String smartLockDeviceName;
    public String oneIotBroker;
    public int oneIotPort;
    public String oneIotCseId;
    public String toolDeviceId;
    public String assignedRoomId;
    public String assignedAt;
    public String assignedBy;
    public int nextPasswordId;
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

  @Entity(name = "MaintenanceRequest")
  @Table(name = "maintenance_requests")
  public static class MaintenanceRequest {
    @Id
    public String id;
    public String bookingId;
    public String roomId;
    public String requesterUsername;
    @Column(length = 1000)
    public String reason;
    public String requestedAt;
    public String status;
    public String reviewedAt;
    public String reviewedBy;
    @Column(length = 1000)
    public String adminNote;
    public String maintenanceRecordId;
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
    public String tone;
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
    public Integer noShowGraceMinutes;
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

  private static final ObjectMapper JSON = new ObjectMapper();

  private abstract static class JsonConverter<T> implements AttributeConverter<T, String> {
    private final Class<T> type;

    JsonConverter(Class<T> type) {
      this.type = type;
    }

    @Override
    public String convertToDatabaseColumn(T attribute) {
      if (attribute == null) return null;
      try {
        return JSON.writeValueAsString(attribute);
      } catch (JsonProcessingException error) {
        throw new IllegalArgumentException("Không thể lưu dữ liệu nghiệp vụ.", error);
      }
    }

    @Override
    public T convertToEntityAttribute(String dbData) {
      if (dbData == null || dbData.isBlank()) return null;
      try {
        return JSON.readValue(dbData, type);
      } catch (JsonProcessingException error) {
        throw new IllegalArgumentException("Không thể đọc dữ liệu nghiệp vụ.", error);
      }
    }
  }

  @Converter
  public static class KeyPickupAppointmentConverter extends JsonConverter<KeyPickupAppointment> {
    public KeyPickupAppointmentConverter() { super(KeyPickupAppointment.class); }
  }

  @Converter
  public static class KeyPickupNegotiationConverter extends JsonConverter<KeyPickupNegotiation> {
    public KeyPickupNegotiationConverter() { super(KeyPickupNegotiation.class); }
  }

  @Converter
  public static class PickupDelegateConverter extends JsonConverter<PickupDelegate> {
    public PickupDelegateConverter() { super(PickupDelegate.class); }
  }

  private abstract static class JsonListConverter<T> implements AttributeConverter<List<T>, String> {
    private final TypeReference<List<T>> type;

    JsonListConverter(TypeReference<List<T>> type) { this.type = type; }

    @Override
    public String convertToDatabaseColumn(List<T> attribute) {
      if (attribute == null || attribute.isEmpty()) return null;
      try {
        return JSON.writeValueAsString(attribute);
      } catch (JsonProcessingException error) {
        throw new IllegalArgumentException("Không thể lưu lịch sử nghiệp vụ.", error);
      }
    }

    @Override
    public List<T> convertToEntityAttribute(String dbData) {
      if (dbData == null || dbData.isBlank()) return new ArrayList<>();
      try {
        return JSON.readValue(dbData, type);
      } catch (JsonProcessingException error) {
        throw new IllegalArgumentException("Không thể đọc lịch sử nghiệp vụ.", error);
      }
    }
  }

  @Converter
  public static class RoomChangeListConverter extends JsonListConverter<RoomChange> {
    public RoomChangeListConverter() { super(new TypeReference<List<RoomChange>>() {}); }
  }

  @Converter
  public static class AccessEventListConverter extends JsonListConverter<SmartLockAccessEvent> {
    public AccessEventListConverter() { super(new TypeReference<List<SmartLockAccessEvent>>() {}); }
  }
}
