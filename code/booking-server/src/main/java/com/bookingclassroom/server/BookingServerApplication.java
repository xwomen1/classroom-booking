package com.bookingclassroom.server;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BookingServerApplication {
  public static void main(String[] args) throws Exception {
    if (remoteDatabaseEnabled(args)) {
      installRemoteDatabaseTrustStore();
    }
    SpringApplication.run(BookingServerApplication.class, args);
  }

  private static boolean remoteDatabaseEnabled(String[] args) {
    String profiles = System.getProperty("spring.profiles.active");
    if (profiles == null || profiles.isBlank()) {
      profiles = System.getenv("SPRING_PROFILES_ACTIVE");
    }
    if (containsRemoteProfile(profiles)) {
      return true;
    }
    for (String arg : args) {
      if (arg.startsWith("--spring.profiles.active=")
          && containsRemoteProfile(arg.substring(arg.indexOf('=') + 1))) {
        return true;
      }
    }
    return false;
  }

  private static boolean containsRemoteProfile(String profiles) {
    if (profiles == null || profiles.isBlank()) {
      return false;
    }
    for (String profile : profiles.split("[,;\\s]+")) {
      if ("remote".equalsIgnoreCase(profile)) {
        return true;
      }
    }
    return false;
  }

  private static void installRemoteDatabaseTrustStore() throws Exception {
    try (InputStream in =
        BookingServerApplication.class.getResourceAsStream("/h2-truststore.jks")) {
      if (in == null) {
        throw new IllegalStateException("Missing bundled H2 remote truststore.");
      }
      Path trustStore = Files.createTempFile("h2-truststore", ".jks");
      trustStore.toFile().deleteOnExit();
      Files.copy(in, trustStore, StandardCopyOption.REPLACE_EXISTING);
      System.setProperty("javax.net.ssl.trustStore", trustStore.toAbsolutePath().toString());
      System.setProperty("javax.net.ssl.trustStorePassword", "changeit");
    }
  }
}
