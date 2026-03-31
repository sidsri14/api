-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FailedPayment_userId_idx" ON "FailedPayment"("userId");

-- CreateIndex
CREATE INDEX "FailedPayment_status_nextRetryAt_idx" ON "FailedPayment"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_sourceId_idx" ON "PaymentEvent"("sourceId");

-- CreateIndex
CREATE INDEX "PaymentSource_userId_idx" ON "PaymentSource"("userId");

-- CreateIndex
CREATE INDEX "RecoveryLink_failedPaymentId_idx" ON "RecoveryLink"("failedPaymentId");

-- CreateIndex
CREATE INDEX "Reminder_failedPaymentId_idx" ON "Reminder"("failedPaymentId");
