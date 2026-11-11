# Architecture Overview (Orbit Squad, fictional)

The fictional "Orbit" product has three services: a gateway, a scheduling service and a notification service.
The gateway is the only public entry point. The scheduling service owns all booking data.
Notifications are asynchronous and best-effort; delivery guarantees are not provided.
