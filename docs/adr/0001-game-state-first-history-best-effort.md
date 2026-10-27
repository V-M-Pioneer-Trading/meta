# Game state first, history best-effort

agent-service writes transaction history, and fleet-service records contract deliveries, only after SpaceTraders confirms the action, best-effort, with no retry and no outbox. The game cannot be rolled back, so a lost history row must never report a completed purchase, sale or delivery as failed; the price is history that can miss rows.

Source: agent-service/README.md#A credit-moving action, end to end; fleet-service/README.md#Contract delivery
