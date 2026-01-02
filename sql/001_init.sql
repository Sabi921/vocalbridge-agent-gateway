
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Tenant (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    apiKeyHash TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Agent (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  primaryProvider TEXT NOT NULL CHECK(primaryProvider IN ('vendorA','vendorB')),
  fallbackProvider TEXT NULL CHECK(fallbackProvider IN ('vendorA','vendorB')),
  systemPrompt TEXT NOT NULL,
  enabledToolsJson TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  agentId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  metadataJson TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE,
  FOREIGN KEY (agentId) REFERENCES Agent(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Message (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE,
  FOREIGN KEY (sessionId) REFERENCES Session(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ProviderCallEvent (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  agentId TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('vendorA','vendorB')),
  status TEXT NOT NULL, 
  latencyMs INTEGER NOT NULL,
  errorCode TEXT NULL, 
  requestId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS UsageEvent (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  agentId TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('vendorA','vendorB')),
  tokensIn INTEGER NOT NULL,
  tokensOut INTEGER NOT NULL,
  costUsd REAL NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS IdempotencyKey (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  key TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  responseJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE,
  UNIQUE (tenantId, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_tenant ON Agent(tenantId);
CREATE INDEX IF NOT EXISTS idx_session_tenant ON Session(tenantId);
CREATE INDEX IF NOT EXISTS idx_message_session ON Message(sessionId);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_created ON UsageEvent(tenantId, createdAt);