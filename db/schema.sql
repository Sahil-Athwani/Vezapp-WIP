-- Vezapp-WIP: 3 new tables, following the existing database's conventions
-- (PascalCase, CompanyID tenancy, per-company UIDs from CompanyUIDCounters, SubmissionID, OwnerUserID).
-- Only CREATE TABLE IF NOT EXISTS is used, so running this again is safe; existing tables are never altered.
-- Existing tables used (read-only): Companies, Users, Subscriptions. Written: CompanyUIDCounters (new prefixes only).
-- Requires MySQL 8.0.13+ (uuid() column default), same as the existing tables.

CREATE TABLE IF NOT EXISTS PatternMaster (
  CompanyID         INT NOT NULL,
  PatternUID        VARCHAR(10) NOT NULL,
  PatternName       VARCHAR(100) NOT NULL,
  -- PatternName upper-cased with spaces/symbols removed ("pt-102" -> "PT102"); used to match spoken names
  PatternKey        VARCHAR(100) NOT NULL,
  MouldingLine      VARCHAR(100) NULL,
  MouldingProcess   VARCHAR(100) NULL,
  CustomerPartName  VARCHAR(255) NULL,
  Grade             VARCHAR(60) NULL,
  SubGrade          VARCHAR(60) NULL,
  NoOfCavities      SMALLINT NULL,
  SubmissionID      CHAR(36) NOT NULL DEFAULT (uuid()),
  OwnerUserID       INT NOT NULL,
  UpdatedByUserID   INT NULL,
  CreatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (CompanyID, PatternUID),
  UNIQUE KEY uq_PatternMaster_Key (CompanyID, PatternKey),
  KEY ix_PatternMaster_Owner (OwnerUserID),
  CONSTRAINT fk_PatternMaster_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pattern details are copied in at report time (like CalibrationReports copies from InstrumentMaster),
-- so old reports keep the values that were true on the moulding date.
CREATE TABLE IF NOT EXISTS MouldReporting (
  CompanyID         INT NOT NULL,
  MRUID             VARCHAR(10) NOT NULL,
  PatternUID        VARCHAR(10) NOT NULL,
  PatternName       VARCHAR(100) NOT NULL,
  MouldingLine      VARCHAR(100) NULL,
  MouldingProcess   VARCHAR(100) NULL,
  CustomerPartName  VARCHAR(255) NULL,
  Grade             VARCHAR(60) NULL,
  SubGrade          VARCHAR(60) NULL,
  NoOfCavities      SMALLINT NULL,
  MouldingDate      DATE NOT NULL,
  PlannedMouldNo    INT NULL,
  GoodMould         INT NOT NULL,
  RejectMould       INT NULL,
  CavitiesBlocked   SMALLINT NULL,
  SubmissionID      CHAR(36) NOT NULL DEFAULT (uuid()),
  OwnerUserID       INT NOT NULL,
  CreatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (CompanyID, MRUID),
  KEY ix_MouldReporting_Date (CompanyID, MouldingDate),
  KEY ix_MouldReporting_Pattern (CompanyID, PatternUID),
  KEY ix_MouldReporting_Owner (OwnerUserID),
  CONSTRAINT fk_MouldReporting_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID),
  CONSTRAINT fk_MouldReporting_Pattern FOREIGN KEY (CompanyID, PatternUID) REFERENCES PatternMaster (CompanyID, PatternUID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS WIPReporting (
  CompanyID         INT NOT NULL,
  WIPUID            VARCHAR(10) NOT NULL,
  PartName          VARCHAR(255) NOT NULL,
  KnockoutStock     INT NULL,
  ShotBlastStock    INT NULL,
  KnockoutRej       INT NULL,
  ShotBlastingRej   INT NULL,
  SubmissionID      CHAR(36) NOT NULL DEFAULT (uuid()),
  OwnerUserID       INT NOT NULL,
  CreatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (CompanyID, WIPUID),
  KEY ix_WIPReporting_Created (CompanyID, CreatedAt),
  KEY ix_WIPReporting_Owner (OwnerUserID),
  CONSTRAINT fk_WIPReporting_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
