-- AntiGravity API Monitoring Platform - Performance Optimization Script
-- Run these queries on your PostgreSQL database (Neon) to ensure maximum speed and efficiency.

-- 1. Index for Worker: Finding due monitors for checking
CREATE INDEX IF NOT EXISTS "idx_monitor_last_checked" 
ON "Monitor" ("lastCheckedAt") 
WHERE "maintenanceUntil" IS NULL OR "maintenanceUntil" < NOW();

-- 2. Index for Dashboard: Fetching monitors for a specific project
CREATE INDEX IF NOT EXISTS "idx_monitor_project_id" ON "Monitor" ("projectId");

-- 3. Index for Logs: High-performance range queries for charts and uptime
CREATE INDEX IF NOT EXISTS "idx_log_monitor_created" ON "Log" ("monitorId", "createdAt" DESC);

-- 4. Index for Incidents: Fast lookup for active/resolved incidents
CREATE INDEX IF NOT EXISTS "idx_incident_monitor_resolved" ON "Incident" ("monitorId", "resolvedAt") WHERE "resolvedAt" IS NULL;

-- 5. Index for Audit Logs: Efficient retrieval of user action history
CREATE INDEX IF NOT EXISTS "idx_audit_user_created" ON "AuditLog" ("userId", "createdAt" DESC);

-- 6. Statistics update for query planner optimization
ANALYZE "Monitor";
ANALYZE "Log";
ANALYZE "Incident";
ANALYZE "AuditLog";
