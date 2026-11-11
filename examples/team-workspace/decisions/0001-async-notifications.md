# Decision 0001: Notifications are asynchronous (Orbit Squad, fictional)

Status: accepted
Context: Synchronous sends slowed the scheduling flow.
Decision: Notifications are queued and sent asynchronously. Failures are retried three times, then dropped and counted.
Consequence: No delivery guarantee. Product copy must not promise one.
