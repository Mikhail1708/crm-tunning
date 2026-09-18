# CRM database backup and restore

JSON backup v4 contains all CRM data models: users, catalogue, customers,
documents/items/sales, expenses, price history, ProductImage data, inventory
reservations/items and the durable status outbox. It is exported from one
REPEATABLE READ snapshot. BigInt money fields use decimal strings; ProductImage
binary data uses base64. Legacy filesystem image files must be backed up separately.

Restore is an administrative full replacement, not a merge. Review the selected
backup and create a current v4 backup before restoring. Perform disaster recovery
in a maintenance window: stop incoming orders and external workers/delivery before
replacement, then reconcile payments and website state. Database rollback cannot
undo an HTTP webhook already sent or an external payment.

Restore locks the affected tables, removes dependent rows before parents and
inserts them in FK order in one transaction. Invalid rows/FKs abort the entire
transaction; errors are not silently skipped. Sequence restart uses transactional
ALTER SEQUENCE RESTART, not non-transactional setval. Current administrator access
is retained; restored user sessions receive fresh auth generations.

Reservations preserve their status, expiry, quantities and money. Stock is restored
from the same snapshot and is not deducted twice. Outbox IDs/payloads/delivered
status are retained; interrupted processing claims become pending for retry.

## Legacy v3 (and converted v1)

These dumps omit reservations, outbox, images and price history. The UI requires
explicit acknowledgement; the API requires `legacyRuntimePolicy: "require-empty"`.
Restore is rejected before deletion when any omitted table in the destination is
nonempty. Nonempty runtime arrays mislabeled as v3 must not be ignored. Do not
bypass this guard by clearing a live database: obtain a complete v4 backup or
prepare and review an offline conversion first. A v3 backup cannot reconstruct
runtime data that was never exported.

## Website status delivery

The Compose deployment reads `SITE_WEBHOOK_URL` and `WEBHOOK_SECRET` from its
environment. Production endpoint: `https://swap38.ru/api/webhooks/crm/order-status`.
The local backend example intentionally uses localhost in development only.
Production startup rejects HTTP, localhost/host.docker.internal, wrong endpoint
paths and missing/placeholder secrets. Use a separately supplied shared secret;
never commit it. Delivery remains HMAC-SHA256 with `X-Webhook-Signature`; retries
remain owned by the durable PostgreSQL outbox. No network delivery is needed for
configuration tests.
