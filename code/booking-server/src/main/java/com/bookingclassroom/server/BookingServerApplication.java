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
    try (InputStream in = BookingServerApplication.class.getResourceAsStream("/h2-truststore.jks")) {
      if (in != null) {
        Path trustStore = Files.createTempFile("h2-truststore", ".jks");
        trustStore.toFile().deleteOnExit();
        Files.copy(in, trustStore, StandardCopyOption.REPLACE_EXISTING);
        System.setProperty("javax.net.ssl.trustStore", trustStore.toAbsolutePath().toString());
        System.setProperty("javax.net.ssl.trustStorePassword", "changeit");
      }
    }
    SpringApplication.run(BookingServerApplication.class, args);
  }
}
