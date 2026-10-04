package com.bookingclassroom.server;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "spring.datasource.url=jdbc:h2:mem:remote-sync-test;DB_CLOSE_DELAY=-1",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.show-sql=false"
    })
class RemoteSyncIntegrationTest {
  @LocalServerPort int port;
  @Autowired TestRestTemplate http;

  @Test
  void synchronizesCoreWorkflowAndKeepsUserDataIsolated() {
    String adminToken = login("admin", "1");
    String userToken = login("user", "2");

    JsonNode config = get("/api/configuration", userToken);
    assertThat(config.path("noShowGraceMinutes").asInt()).isEqualTo(15);

    JsonNode profile = request(HttpMethod.PUT, "/api/profiles/user", userToken, Map.of(
        "username", "user", "fullName", "Giảng viên kiểm thử", "email", "", "phone", "", "department", "ET"));
    assertThat(profile.path("fullName").asText()).isEqualTo("Giảng viên kiểm thử");

    String date = LocalDate.now(BookingService.ZONE).plusDays(1).toString();
    JsonNode created = request(HttpMethod.POST, "/api/bookings", userToken, Map.of(
        "requesterUsername", "user",
        "roomId", "room-a101",
        "date", date,
        "startTime", "16:00",
        "endTime", "17:00",
        "purpose", "Kiểm thử đồng bộ",
        "repeatWeekly", true,
        "repeatWeeks", 2));
    JsonNode booking = created.path("booking");
    String bookingId = booking.path("id").asText();
    String seriesId = booking.path("recurringSeriesId").asText();
    assertThat(seriesId).isNotBlank();

    JsonNode reviewed = request(HttpMethod.POST, "/api/booking-series/" + seriesId + "/review", adminToken,
        Map.of("decision", "APPROVED"));
    assertThat(reviewed.path("count").asInt()).isEqualTo(2);

    JsonNode assignedLock = request(HttpMethod.POST, "/api/smart-lock/assign", adminToken,
        Map.of("roomId", "room-a101"));
    assertThat(assignedLock.path("assignedRoomId").asText()).isEqualTo("room-a101");
    JsonNode reservation = request(HttpMethod.POST, "/api/smart-lock/reserve-password-id", userToken,
        Map.of("roomId", "room-a101"));
    assertThat(reservation.path("passwordId").asInt()).isEqualTo(1);

    JsonNode firstPin = request(HttpMethod.POST, "/api/bookings/" + bookingId + "/temporary-pin", userToken,
        Map.of("code", "7654321", "lockPasswordId", 23, "lockCommandId", "command-23"));
    assertThat(firstPin.path("booking").path("temporaryPin").path("code").asText()).isEqualTo("7654321");

    JsonNode deliveredPin = request(HttpMethod.POST, "/api/bookings/" + bookingId + "/temporary-pin", userToken,
        Map.of(
            "code", "7654321",
            "lockPasswordId", 23,
            "lockCommandId", "command-23",
            "lockDeliveredAt", "2026-10-04T00:00:00Z",
            "lockDeliveryAttemptedAt", "2026-10-04T00:00:00Z"));
    assertThat(deliveredPin.path("booking").path("temporaryPin").path("lockDeliveredAt").asText())
        .isEqualTo("2026-10-04T00:00:00Z");

    request(HttpMethod.POST, "/api/auth/register", null,
        Map.of("username", "user.test", "password", "1234", "recoveryCode", "9999"));
    String otherToken = login("user.test", "1234");
    assertThat(get("/api/bookings", userToken).size()).isEqualTo(2);
    assertThat(get("/api/bookings", otherToken).size()).isZero();
    assertThat(get("/api/bookings", adminToken).size()).isEqualTo(2);
  }

  private String login(String username, String password) {
    JsonNode body = request(HttpMethod.POST, "/api/auth/login", null,
        Map.of("username", username, "password", password));
    return body.path("token").asText();
  }

  private JsonNode get(String path, String token) {
    return request(HttpMethod.GET, path, token, null);
  }

  private JsonNode request(HttpMethod method, String path, String token, Object body) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (token != null) headers.setBearerAuth(token);
    ResponseEntity<JsonNode> response = http.exchange(
        "http://127.0.0.1:" + port + path,
        method,
        new HttpEntity<>(body, headers),
        JsonNode.class);
    assertThat(response.getStatusCode().is2xxSuccessful())
        .withFailMessage("%s %s failed: %s", method, path, response.getBody())
        .isTrue();
    return response.getBody();
  }
}
