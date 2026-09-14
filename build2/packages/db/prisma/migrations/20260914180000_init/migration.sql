-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "khOrgId" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanToken" TEXT NOT NULL,
    "collateralToken" TEXT NOT NULL,
    "lltv" TEXT NOT NULL,
    "oracle" TEXT NOT NULL,
    "irm" TEXT NOT NULL,
    "chainId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "borrowShares" TEXT NOT NULL,
    "collateralShares" TEXT NOT NULL,
    "snapshotAt" DATETIME NOT NULL,
    CONSTRAINT "Position_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "triggerRatioPct" REAL NOT NULL,
    "maxSpendUsd" REAL NOT NULL,
    "allowedActions" TEXT NOT NULL,
    "slippageBps" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "circuitBreakerMaxRunsPerDay" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "armedAt" DATETIME,
    CONSTRAINT "Policy_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "workflowJson" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "planOptions" TEXT NOT NULL,
    "criticVerdict" TEXT NOT NULL,
    "simulateResult" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvedAt" DATETIME,
    "humanOverride" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Plan_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Guard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "khWorkflowId" TEXT NOT NULL,
    "khIdempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guard_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Guard_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardId" TEXT NOT NULL,
    "khExecutionId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHashes" TEXT NOT NULL,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "logsJson" TEXT NOT NULL,
    "beforeSnapshot" TEXT NOT NULL,
    "afterSnapshot" TEXT NOT NULL,
    "reconciledAt" DATETIME,
    CONSTRAINT "Run_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT,
    "level" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Heartbeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "component" TEXT NOT NULL,
    "lastTickAt" DATETIME NOT NULL,
    "detail" TEXT NOT NULL
);
