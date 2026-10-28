# Projects

This folder contains the two main runnable applications:

- `booking_classroom/` is the React Native Android frontend. Its screens and business features live under `src/modules`; app setup is in `App.tsx`.
- `booking-server/` is the Java 17/Spring Boot backend. Its feature API controllers live under `src/main/java/com/bookingclassroom/server/api`.

Each project has its own README and dependencies. Run Node/Android commands from `booking_classroom/`; run Maven commands from `booking-server/`. Do not place shared build output or dependencies at this folder level.
