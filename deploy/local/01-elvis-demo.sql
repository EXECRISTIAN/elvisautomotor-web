--
-- PostgreSQL database dump
--

\restrict fHDeEyQUU592fkjGnDNGbKDZFN2zzdr1O0BnxnxEUqFnDPXH5dThxDkTdQAqyw6

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ApiKeyStatusType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApiKeyStatusType" AS ENUM (
    'active',
    'inactive',
    'revoked'
);


--
-- Name: invalidate_publication_for_inventory_stock_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_publication_for_inventory_stock_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF ROW(OLD."rooftop", OLD."vehicle", OLD."stockNumber") IS NOT DISTINCT FROM
     ROW(NEW."rooftop", NEW."vehicle", NEW."stockNumber") THEN
    RETURN NEW;
  END IF;

  UPDATE "InventoryStock"
  SET "approvedRevisionHash" = '',
      "merchandisingStatus" = 'draft',
      "feedStatus" = 'not-published',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" IN (OLD."id", NEW."id")
     OR "vehicle" = OLD."vehicle"
     OR "vehicle" = NEW."vehicle";
  RETURN NEW;
END;
$$;


--
-- Name: invalidate_publication_for_vehicle_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_publication_for_vehicle_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF ROW(
    OLD."rooftop", OLD."vin", OLD."stockNumber", OLD."year", OLD."make", OLD."model", OLD."trim",
    OLD."exteriorColor", OLD."interiorColor", OLD."mileage", OLD."condition", OLD."priceCents",
    OLD."listPriceCents", OLD."description", OLD."features"
  ) IS NOT DISTINCT FROM ROW(
    NEW."rooftop", NEW."vin", NEW."stockNumber", NEW."year", NEW."make", NEW."model", NEW."trim",
    NEW."exteriorColor", NEW."interiorColor", NEW."mileage", NEW."condition", NEW."priceCents",
    NEW."listPriceCents", NEW."description", NEW."features"
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE "InventoryStock"
  SET "approvedRevisionHash" = '',
      "merchandisingStatus" = 'draft',
      "feedStatus" = 'not-published',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "vehicle" = NEW."id";
  RETURN NEW;
END;
$$;


--
-- Name: invalidate_publication_for_vehicle_image_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_publication_for_vehicle_image_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  affected_vehicle_ids TEXT[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      OLD."vehicle", OLD."rooftop", OLD."imagePath", OLD."image_id", OLD."image_extension",
      OLD."caption", OLD."category", OLD."isPrimary", OLD."sortOrder"
    ) IS NOT DISTINCT FROM ROW(
      NEW."vehicle", NEW."rooftop", NEW."imagePath", NEW."image_id", NEW."image_extension",
      NEW."caption", NEW."category", NEW."isPrimary", NEW."sortOrder"
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    affected_vehicle_ids := ARRAY[NEW."vehicle"];
  ELSIF TG_OP = 'DELETE' THEN
    affected_vehicle_ids := ARRAY[OLD."vehicle"];
  ELSE
    affected_vehicle_ids := ARRAY[OLD."vehicle", NEW."vehicle"];
  END IF;

  UPDATE "InventoryStock"
  SET "approvedRevisionHash" = '',
      "merchandisingStatus" = 'draft',
      "feedStatus" = 'not-published',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "vehicle" = ANY(affected_vehicle_ids);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AccountingBatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccountingBatch" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "sourceType" text NOT NULL,
    "sourceId" text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    lines jsonb DEFAULT '[]'::jsonb,
    "totalDebitCents" double precision NOT NULL,
    "totalCreditCents" double precision NOT NULL,
    "attemptCount" integer DEFAULT 0 NOT NULL,
    "externalReference" text DEFAULT ''::text NOT NULL,
    "lastErrorCode" text DEFAULT ''::text NOT NULL,
    "postedAt" timestamp(3) without time zone,
    "reconciledAt" timestamp(3) without time zone,
    "lockedAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "AccountingBatch_balanced_check" CHECK ((("totalDebitCents" = "totalCreditCents") AND ("totalDebitCents" > (0)::double precision)))
);


--
-- Name: AccountingMapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccountingMapping" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "sourceType" text NOT NULL,
    "sourceCode" text DEFAULT ''::text NOT NULL,
    "debitAccount" text DEFAULT ''::text NOT NULL,
    "creditAccount" text DEFAULT ''::text NOT NULL,
    "providerKey" text DEFAULT 'operator-recorded'::text NOT NULL
);


--
-- Name: AccountingProviderResponse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccountingProviderResponse" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    batch text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    "requestFingerprint" text DEFAULT ''::text NOT NULL,
    "responseCode" text DEFAULT ''::text NOT NULL,
    "externalReference" text DEFAULT ''::text NOT NULL,
    "immutableResponse" jsonb DEFAULT '{}'::jsonb,
    "receivedAt" timestamp(3) without time zone NOT NULL,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: ApiKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApiKey" (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    "tokenSecret" text NOT NULL,
    "tokenPreview" text DEFAULT ''::text NOT NULL,
    scopes jsonb DEFAULT '[]'::jsonb,
    status public."ApiKeyStatusType" DEFAULT 'active'::public."ApiKeyStatusType",
    "expiresAt" timestamp(3) without time zone,
    "lastUsedAt" timestamp(3) without time zone,
    "usageCount" jsonb DEFAULT '{"daily": {}, "total": 0}'::jsonb,
    "restrictedToIPs" jsonb DEFAULT '[]'::jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "user" text
);


--
-- Name: AuthenticationThrottle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuthenticationThrottle" (
    id text NOT NULL,
    "keyHash" text DEFAULT ''::text NOT NULL,
    purpose text DEFAULT ''::text NOT NULL,
    "failureCount" integer DEFAULT 0 NOT NULL,
    "windowStartedAt" timestamp(3) without time zone NOT NULL,
    "blockedUntil" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "AuthenticationThrottle_values_check" CHECK ((("keyHash" ~ '^[0-9a-f]{64}$'::text) AND (purpose = ANY (ARRAY['sign-in'::text, 'password-reset'::text, 'password-reset-request'::text, 'public-inquiry-identity'::text, 'public-inquiry-network'::text, 'public-test-drive-identity'::text, 'public-test-drive-network'::text, 'public-trade-in-identity'::text, 'public-trade-in-network'::text, 'public-financing-identity'::text, 'public-financing-network'::text, 'public-service-identity'::text, 'public-service-network'::text])) AND ("failureCount" >= 0)))
);


--
-- Name: Bank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Bank" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    website text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    "providerKey" text DEFAULT 'manual'::text NOT NULL
);


--
-- Name: Customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "firstName" text DEFAULT ''::text NOT NULL,
    "lastName" text DEFAULT ''::text NOT NULL,
    "primaryEmail" text DEFAULT ''::text NOT NULL,
    "primaryPhone" text DEFAULT ''::text NOT NULL,
    "normalizedEmail" text DEFAULT ''::text NOT NULL,
    "normalizedPhone" text DEFAULT ''::text NOT NULL,
    "identityKey" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "emailConsent" boolean DEFAULT false NOT NULL,
    "smsConsent" boolean DEFAULT false NOT NULL,
    "phoneConsent" boolean DEFAULT false NOT NULL,
    "mergedAt" timestamp(3) without time zone,
    "mergedInto" text,
    "contactPreferenceUpdatedAt" timestamp(3) without time zone,
    "emailSuppressed" boolean DEFAULT false NOT NULL,
    household text,
    "phoneSuppressed" boolean DEFAULT false NOT NULL,
    "preferredChannel" text DEFAULT 'none'::text NOT NULL,
    "smsSuppressed" boolean DEFAULT false NOT NULL,
    "suppressionReason" text DEFAULT ''::text NOT NULL,
    "suppressionSource" text DEFAULT ''::text NOT NULL,
    account text,
    CONSTRAINT "Customer_preferredChannel_check" CHECK (("preferredChannel" = ANY (ARRAY['email'::text, 'sms'::text, 'phone'::text, 'none'::text])))
);


--
-- Name: CustomerContactPreferenceEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerContactPreferenceEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    customer text NOT NULL,
    actor text NOT NULL,
    source text DEFAULT ''::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    "preferenceSnapshot" jsonb DEFAULT '{}'::jsonb
);


--
-- Name: CustomerHousehold; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerHousehold" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "householdKey" text DEFAULT ''::text NOT NULL,
    "displayName" text DEFAULT ''::text NOT NULL
);


--
-- Name: CustomerInteraction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerInteraction" (
    id text NOT NULL,
    lead text,
    "interactionType" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    duration integer,
    notes text DEFAULT ''::text NOT NULL,
    outcome text,
    "followUpDate" timestamp(3) without time zone,
    "followUpCompleted" timestamp(3) without time zone,
    "performedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL
);


--
-- Name: CustomerMergeEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerMergeEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    survivor text NOT NULL,
    duplicate text NOT NULL,
    actor text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    "mergedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "movedLeadIds" jsonb DEFAULT '[]'::jsonb,
    "evidenceSnapshot" jsonb DEFAULT '{}'::jsonb
);


--
-- Name: Deal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Deal" (
    id text NOT NULL,
    lead text,
    vehicle text,
    salesperson text,
    "vehiclePriceCents" double precision,
    "tradeInValueCents" double precision,
    "tradeInVehicle" text,
    "tradeInDetails" jsonb DEFAULT '{}'::jsonb,
    "downPaymentCents" double precision,
    "financingAmountCents" double precision,
    "monthlyPaymentCents" double precision,
    "loanTerm" integer,
    apr double precision,
    status text DEFAULT 'pencil'::text,
    "taxAmountCents" double precision,
    fees jsonb DEFAULT '[]'::jsonb,
    "saleDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "evidenceSnapshot" jsonb DEFAULT '{}'::jsonb,
    rooftop text NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "acceptedSnapshot" jsonb DEFAULT '{}'::jsonb,
    "grossCents" double precision,
    "moneyFactorBasisPoints" integer,
    "presentedAt" timestamp(3) without time zone,
    "presentedSnapshot" jsonb DEFAULT '{}'::jsonb,
    products jsonb DEFAULT '[]'::jsonb,
    rebates jsonb DEFAULT '[]'::jsonb,
    "residualValueCents" double precision,
    "structureType" text DEFAULT 'cash'::text NOT NULL,
    "taxLines" jsonb DEFAULT '[]'::jsonb,
    "worksheetVersion" integer DEFAULT 0 NOT NULL,
    "selectedLenderDecision" text,
    CONSTRAINT "Deal_nonnegative_check" CHECK ((("vehiclePriceCents" >= (0)::double precision) AND ("tradeInValueCents" >= (0)::double precision) AND ("downPaymentCents" >= (0)::double precision) AND ("financingAmountCents" >= (0)::double precision) AND ("monthlyPaymentCents" >= (0)::double precision) AND ("taxAmountCents" >= (0)::double precision) AND ("residualValueCents" >= (0)::double precision) AND ("loanTerm" >= 0) AND (apr >= (0)::double precision) AND ("moneyFactorBasisPoints" >= 0))),
    CONSTRAINT "Deal_structureType_check" CHECK (("structureType" = ANY (ARRAY['cash'::text, 'finance'::text, 'lease'::text]))),
    CONSTRAINT "Deal_worksheetVersion_check" CHECK (("worksheetVersion" >= 0))
);


--
-- Name: DealApproval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DealApproval" (
    id text NOT NULL,
    deal text,
    approver text,
    decision text DEFAULT 'pending'::text,
    notes text DEFAULT ''::text NOT NULL,
    "approvalDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL
);


--
-- Name: DealerGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DealerGroup" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    slug text DEFAULT ''::text NOT NULL,
    "legalName" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: DealerGroupMembership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DealerGroupMembership" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "membershipKey" text DEFAULT ''::text NOT NULL,
    "user" text,
    "dealerGroup" text,
    role text,
    status text DEFAULT 'invited'::text NOT NULL,
    "accessAllRooftops" boolean DEFAULT false NOT NULL,
    "invitedBy" text,
    "joinedAt" timestamp(3) without time zone
);


--
-- Name: DealershipProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DealershipProfile" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    "shortName" text DEFAULT ''::text NOT NULL,
    "salesEmail" text DEFAULT ''::text NOT NULL,
    "serviceEmail" text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    "addressLine1" text DEFAULT ''::text NOT NULL,
    "addressLine2" text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    state text DEFAULT ''::text NOT NULL,
    "postalCode" text DEFAULT ''::text NOT NULL,
    "hoursMonFri" text DEFAULT ''::text NOT NULL,
    "hoursSaturday" text DEFAULT ''::text NOT NULL,
    "hoursSunday" text DEFAULT ''::text NOT NULL,
    "websiteUrl" text DEFAULT ''::text NOT NULL,
    "currencyCode" text DEFAULT 'ARS'::text NOT NULL,
    "homepageTitle" text DEFAULT ''::text NOT NULL,
    "homepageDescription" text DEFAULT ''::text NOT NULL,
    "logoIcon" text DEFAULT ''::text NOT NULL,
    "logoColor" text DEFAULT '0'::text NOT NULL,
    "docFeeCents" double precision DEFAULT 0 NOT NULL,
    "salesTaxRateBps" integer DEFAULT 0 NOT NULL,
    "whatsappNumber" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "DealershipProfile_pricing_check" CHECK ((("salesTaxRateBps" >= 0) AND ("salesTaxRateBps" <= 10000) AND ("docFeeCents" >= (0)::double precision))),
    CONSTRAINT "DealershipProfile_singleton_id" CHECK ((id = 1))
);


--
-- Name: DeliveryCase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeliveryCase" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text NOT NULL,
    status text NOT NULL,
    "appointmentAt" timestamp(3) without time zone,
    "arrivedAt" timestamp(3) without time zone,
    checklist jsonb DEFAULT '[]'::jsonb,
    "customerAcknowledgment" text DEFAULT ''::text NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "deliverySnapshot" jsonb DEFAULT '{}'::jsonb,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: DomainAuditEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DomainAuditEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "eventKey" text DEFAULT ''::text NOT NULL,
    "requestHash" text DEFAULT ''::text NOT NULL,
    "aggregateType" text DEFAULT ''::text NOT NULL,
    "aggregateId" text DEFAULT ''::text NOT NULL,
    action text DEFAULT ''::text NOT NULL,
    "beforeSnapshot" jsonb,
    "afterSnapshot" jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    actor text,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FinanceComplianceCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinanceComplianceCheck" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text NOT NULL,
    "checkType" text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    "resultCode" text DEFAULT ''::text NOT NULL,
    "requestSnapshot" jsonb DEFAULT '{}'::jsonb,
    "resultSnapshot" jsonb DEFAULT '{}'::jsonb,
    "requestedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: FinanceContractPackage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinanceContractPackage" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text NOT NULL,
    status text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    "envelopeReference" text DEFAULT ''::text NOT NULL,
    "requiredDocuments" jsonb DEFAULT '[]'::jsonb,
    "documentChecklist" jsonb DEFAULT '[]'::jsonb,
    "immutableStatusEvidence" jsonb DEFAULT '{}'::jsonb,
    "sentAt" timestamp(3) without time zone,
    "signedAt" timestamp(3) without time zone,
    "lastWebhookAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: FinanceFundingCase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinanceFundingCase" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text NOT NULL,
    status text NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb,
    exceptions jsonb DEFAULT '[]'::jsonb,
    "fundingReference" text DEFAULT ''::text NOT NULL,
    "fundedAt" timestamp(3) without time zone,
    "immutableEvidence" jsonb DEFAULT '{}'::jsonb,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: FinanceMenuVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinanceMenuVersion" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text NOT NULL,
    version integer NOT NULL,
    status text NOT NULL,
    "optionsSnapshot" jsonb DEFAULT '[]'::jsonb,
    "selectedProductCodes" jsonb DEFAULT '[]'::jsonb,
    "declinedProductCodes" jsonb DEFAULT '[]'::jsonb,
    "disclosureAcknowledgment" text DEFAULT ''::text NOT NULL,
    "presentedAt" timestamp(3) without time zone NOT NULL,
    "decidedAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: FinanceProduct; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinanceProduct" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    category text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "retailPriceCents" double precision NOT NULL,
    "costCents" double precision NOT NULL,
    CONSTRAINT "FinanceProduct_money_check" CHECK ((("retailPriceCents" >= (0)::double precision) AND ("costCents" >= (0)::double precision)))
);


--
-- Name: FinanceProductCancellation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinanceProductCancellation" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text NOT NULL,
    menu text NOT NULL,
    "productCode" text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    "refundCents" double precision,
    evidence jsonb DEFAULT '{}'::jsonb,
    "requestedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "FinanceProductCancellation_refund_check" CHECK ((("refundCents" IS NULL) OR ("refundCents" >= (0)::double precision)))
);


--
-- Name: FinanceProductQuote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinanceProductQuote" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text NOT NULL,
    product text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    "retailPriceCents" double precision,
    "costCents" double precision,
    "evidenceReference" text DEFAULT ''::text NOT NULL,
    "requestSnapshot" jsonb DEFAULT '{}'::jsonb,
    "resultSnapshot" jsonb DEFAULT '{}'::jsonb,
    "requestedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "FinanceProductQuote_money_check" CHECK (((("retailPriceCents" IS NULL) OR ("retailPriceCents" >= (0)::double precision)) AND (("costCents" IS NULL) OR ("costCents" >= (0)::double precision))))
);


--
-- Name: FinancingApplication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinancingApplication" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    lead text,
    vehicle text,
    "applicantName" text DEFAULT ''::text NOT NULL,
    "applicantEmail" text DEFAULT ''::text NOT NULL,
    "applicantPhone" text DEFAULT ''::text NOT NULL,
    "employmentStatus" text DEFAULT ''::text NOT NULL,
    "annualIncomeCents" double precision NOT NULL,
    "selfReportedCreditTier" text DEFAULT ''::text NOT NULL,
    "requestedAmountCents" double precision,
    "plannedMonthlyPaymentCents" double precision,
    "plannedDownPaymentCents" double precision,
    "tradeInValueCents" double precision,
    "aprBasisPoints" integer,
    "loanTermMonths" integer,
    "consentAt" timestamp(3) without time zone NOT NULL,
    "submittedAt" timestamp(3) without time zone NOT NULL,
    "lockedAt" timestamp(3) without time zone NOT NULL,
    "immutableSnapshot" jsonb DEFAULT '{}'::jsonb,
    rooftop text NOT NULL,
    CONSTRAINT "FinancingApplication_nonnegative_check" CHECK ((("annualIncomeCents" >= (0)::double precision) AND ("requestedAmountCents" >= (0)::double precision) AND ("plannedMonthlyPaymentCents" >= (0)::double precision) AND ("plannedDownPaymentCents" >= (0)::double precision) AND ("tradeInValueCents" >= (0)::double precision) AND ("aprBasisPoints" >= 0))),
    CONSTRAINT "FinancingApplication_term_positive_check" CHECK (("loanTermMonths" > 0))
);


--
-- Name: FinancingPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FinancingPlan" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    bank text,
    name text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    "tnaBps" integer NOT NULL,
    "teaBps" integer,
    "cftBps" integer,
    "termsMonths" text DEFAULT ''::text NOT NULL,
    "minAmountCents" double precision,
    "maxAmountCents" double precision,
    "maxFinancedBps" integer,
    amortization text DEFAULT 'frances'::text NOT NULL,
    "validFrom" timestamp(3) without time zone,
    "validUntil" timestamp(3) without time zone,
    "extraCosts" text DEFAULT ''::text NOT NULL,
    requirements text DEFAULT ''::text NOT NULL,
    "sortOrder" integer DEFAULT 0
);


--
-- Name: InventoryAcquisition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryAcquisition" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'appraised'::text NOT NULL,
    "acquisitionSource" text NOT NULL,
    "sourceReference" text DEFAULT ''::text NOT NULL,
    vin text DEFAULT ''::text NOT NULL,
    year integer NOT NULL,
    make text DEFAULT ''::text NOT NULL,
    model text DEFAULT ''::text NOT NULL,
    odometer integer,
    "appraisalCents" double precision NOT NULL,
    "purchaseCents" double precision,
    "reconEstimateCents" double precision,
    vehicle text,
    "immutablePurchaseSnapshot" jsonb,
    "purchasedAt" timestamp(3) without time zone,
    "arrivedAt" timestamp(3) without time zone,
    "frontlineAt" timestamp(3) without time zone,
    "requestedBy" text,
    "lastTransitionedBy" text,
    stock text,
    CONSTRAINT "InventoryAcquisition_nonnegative_check" CHECK (((odometer >= 0) AND ("appraisalCents" >= (0)::double precision) AND ("purchaseCents" >= (0)::double precision) AND ("reconEstimateCents" >= (0)::double precision)))
);


--
-- Name: InventoryAcquisitionEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryAcquisitionEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    acquisition text NOT NULL,
    "fromStatus" text DEFAULT ''::text NOT NULL,
    "toStatus" text DEFAULT ''::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb,
    actor text,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InventoryFeedError; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryFeedError" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    run text NOT NULL,
    stock text,
    "errorCode" text DEFAULT ''::text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    "rowReference" text DEFAULT ''::text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb
);


--
-- Name: InventoryFeedRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryFeedRun" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "runKey" text DEFAULT ''::text NOT NULL,
    "channelKey" text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    "attemptedCount" integer NOT NULL,
    "succeededCount" integer NOT NULL,
    "failedCount" integer NOT NULL,
    "requestSnapshot" jsonb DEFAULT '{}'::jsonb,
    "responseSummary" jsonb DEFAULT '{}'::jsonb,
    "startedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone NOT NULL,
    "recordedBy" text
);


--
-- Name: InventoryMerchandisingVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryMerchandisingVersion" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    stock text NOT NULL,
    version integer NOT NULL,
    "versionKey" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'submitted'::text,
    snapshot jsonb DEFAULT '{}'::jsonb,
    "submittedBy" text,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "decidedBy" text,
    "decidedAt" timestamp(3) without time zone,
    "decisionReason" text DEFAULT ''::text NOT NULL
);


--
-- Name: InventoryReconWorkItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryReconWorkItem" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    stock text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    category text NOT NULL,
    status text DEFAULT 'open'::text,
    "estimatedCostCents" double precision,
    "actualCostCents" double precision,
    "vendorName" text DEFAULT ''::text NOT NULL,
    "assignedTo" text,
    "dueAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    CONSTRAINT "InventoryReconWorkItem_nonnegative_check" CHECK ((("estimatedCostCents" >= (0)::double precision) AND ("actualCostCents" >= (0)::double precision)))
);


--
-- Name: InventoryStock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryStock" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    vehicle text NOT NULL,
    "stockNumber" text DEFAULT ''::text NOT NULL,
    "stockKey" text DEFAULT ''::text NOT NULL,
    "locationCode" text DEFAULT ''::text NOT NULL,
    "locationLabel" text DEFAULT ''::text NOT NULL,
    "stockedAt" timestamp(3) without time zone NOT NULL,
    "frontlineAt" timestamp(3) without time zone,
    "purchaseCostCents" double precision,
    "reconCostCents" double precision DEFAULT 0,
    "otherCostCents" double precision DEFAULT 0,
    "totalCostCents" double precision DEFAULT 0,
    "reconStatus" text DEFAULT 'not-started'::text,
    "merchandisingStatus" text DEFAULT 'draft'::text,
    "feedStatus" text DEFAULT 'not-published'::text,
    "approvedRevisionHash" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "InventoryStock_nonnegative_check" CHECK ((("purchaseCostCents" >= (0)::double precision) AND ("reconCostCents" >= (0)::double precision) AND ("otherCostCents" >= (0)::double precision) AND ("totalCostCents" >= (0)::double precision))),
    CONSTRAINT "InventoryStock_total_cost_check" CHECK (("totalCostCents" = ((COALESCE("purchaseCostCents", (0)::double precision) + COALESCE("reconCostCents", (0)::double precision)) + COALESCE("otherCostCents", (0)::double precision))))
);


--
-- Name: InventoryStockEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryStockEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    stock text NOT NULL,
    "eventKey" text DEFAULT ''::text NOT NULL,
    "eventType" text DEFAULT ''::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    "amountCents" double precision,
    evidence jsonb DEFAULT '{}'::jsonb,
    actor text,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Lead" (
    id text NOT NULL,
    "firstName" text DEFAULT ''::text NOT NULL,
    "lastName" text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    source text,
    "interestedVehicle" text,
    "budgetRange" text,
    "tradeInVehicle" text DEFAULT ''::text NOT NULL,
    timeframe text,
    status text DEFAULT 'new'::text,
    "assignedSalesperson" text,
    notes text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastContact" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "assignedAt" timestamp(3) without time zone,
    customer text NOT NULL,
    "firstResponseAt" timestamp(3) without time zone,
    "firstResponseDueAt" timestamp(3) without time zone,
    "lostReason" text DEFAULT ''::text NOT NULL,
    "cadenceDueAt" timestamp(3) without time zone,
    "cadenceKey" text DEFAULT ''::text NOT NULL,
    "cadenceStatus" text DEFAULT 'none'::text NOT NULL,
    "cadenceStep" text DEFAULT ''::text NOT NULL,
    "campaignKey" text DEFAULT ''::text NOT NULL,
    "lostReasonCode" text,
    CONSTRAINT "Lead_cadenceStatus_check" CHECK (("cadenceStatus" = ANY (ARRAY['none'::text, 'active'::text, 'paused'::text, 'completed'::text, 'suppressed'::text]))),
    CONSTRAINT "Lead_lostReasonCode_check" CHECK ((("lostReasonCode" IS NULL) OR ("lostReasonCode" = ANY (ARRAY['purchased-elsewhere'::text, 'price'::text, 'financing'::text, 'vehicle-unavailable'::text, 'no-response'::text, 'timing'::text, 'other'::text]))))
);


--
-- Name: LeadAssignmentEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeadAssignmentEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    lead text NOT NULL,
    "fromUser" text,
    "toUser" text NOT NULL,
    actor text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    "routeKey" text DEFAULT ''::text NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "firstResponseDueAt" timestamp(3) without time zone
);


--
-- Name: LeadRoutingRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeadRoutingRule" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    "routeKey" text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    source text DEFAULT 'any'::text NOT NULL,
    assignee text NOT NULL,
    "firstResponseMinutes" integer DEFAULT 30 NOT NULL
);


--
-- Name: LenderDecision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LenderDecision" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    application text,
    submission text,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    "externalReference" text,
    decision text NOT NULL,
    "approvedAmountCents" double precision,
    "aprBasisPoints" integer,
    "termMonths" integer,
    "monthlyPaymentCents" double precision,
    "reasonCodes" jsonb DEFAULT '[]'::jsonb,
    "immutableSnapshot" jsonb DEFAULT '{}'::jsonb,
    "decidedAt" timestamp(3) without time zone NOT NULL,
    "recordedBy" text,
    rooftop text NOT NULL,
    CONSTRAINT "LenderDecision_nonnegative_check" CHECK ((("approvedAmountCents" >= (0)::double precision) AND ("aprBasisPoints" >= 0) AND ("monthlyPaymentCents" >= (0)::double precision))),
    CONSTRAINT "LenderDecision_term_positive_check" CHECK (("termMonths" > 0))
);


--
-- Name: LenderSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LenderSubmission" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    application text,
    "providerKey" text DEFAULT ''::text NOT NULL,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    "externalReference" text,
    "requestSnapshot" jsonb DEFAULT '{}'::jsonb,
    "responseSummary" jsonb DEFAULT '{}'::jsonb,
    "errorCode" text,
    "queuedAt" timestamp(3) without time zone NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    rooftop text NOT NULL
);


--
-- Name: Make; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Make" (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    logo_id text,
    logo_filesize integer,
    logo_width integer,
    logo_height integer,
    logo_extension text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MembershipAuditEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MembershipAuditEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "scopeType" text NOT NULL,
    action text NOT NULL,
    "dealerGroup" text,
    rooftop text,
    "targetUser" text,
    actor text,
    "membershipId" text DEFAULT ''::text NOT NULL,
    "previousSnapshot" jsonb,
    "nextSnapshot" jsonb DEFAULT '{}'::jsonb,
    reason text DEFAULT ''::text NOT NULL,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Model" (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    make text,
    "bodyStyle" text,
    "baseYear" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PartsInventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartsInventory" (
    id text NOT NULL,
    "partNumber" text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    "minimumQuantity" integer,
    "costCents" double precision,
    "priceCents" double precision NOT NULL,
    supplier text DEFAULT ''::text NOT NULL,
    "supplierPartNumber" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "binLocation" text DEFAULT ''::text NOT NULL,
    "committedQuantity" integer DEFAULT 0 NOT NULL,
    "onOrderQuantity" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "PartsInventory_nonnegative_check" CHECK ((("priceCents" >= (0)::double precision) AND ("costCents" >= (0)::double precision) AND ("minimumQuantity" >= 0))),
    CONSTRAINT "PartsInventory_quantity_check" CHECK (((quantity >= 0) AND ("committedQuantity" >= 0) AND ("onOrderQuantity" >= 0) AND ("committedQuantity" <= quantity)))
);


--
-- Name: PartsMovement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartsMovement" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    part text NOT NULL,
    "serviceOrder" text,
    "movementType" text NOT NULL,
    "quantityDelta" integer NOT NULL,
    "onHandAfter" integer,
    "committedAfter" integer,
    "onOrderAfter" integer,
    reference text DEFAULT ''::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: PartsPurchaseOrder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartsPurchaseOrder" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    supplier text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    lines jsonb DEFAULT '[]'::jsonb,
    "orderedAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL
);


--
-- Name: PaymentProvider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentProvider" (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    "isInstalled" boolean DEFAULT true NOT NULL,
    credentials jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    "createPaymentFunction" text DEFAULT ''::text NOT NULL,
    "capturePaymentFunction" text DEFAULT ''::text NOT NULL,
    "refundPaymentFunction" text DEFAULT ''::text NOT NULL,
    "getPaymentStatusFunction" text DEFAULT ''::text NOT NULL,
    "generatePaymentLinkFunction" text DEFAULT ''::text NOT NULL,
    "handleWebhookFunction" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PaymentProviderEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentProviderEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    transaction text NOT NULL,
    refund text,
    "providerKey" text DEFAULT ''::text NOT NULL,
    "providerEventId" text DEFAULT ''::text NOT NULL,
    "eventType" text DEFAULT ''::text NOT NULL,
    "payloadDigest" text DEFAULT ''::text NOT NULL,
    "signatureTimestamp" timestamp(3) without time zone NOT NULL,
    "receivedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "PaymentProviderEvent_provider_digest_check" CHECK ((("providerKey" <> ''::text) AND ("payloadDigest" ~ '^[0-9a-f]{64}$'::text)))
);


--
-- Name: PaymentRefund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentRefund" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    transaction text NOT NULL,
    "amountCents" double precision NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    "providerRefundId" text DEFAULT ''::text NOT NULL,
    "failureCode" text DEFAULT ''::text NOT NULL,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "PaymentRefund_amount_check" CHECK (("amountCents" > (0)::double precision)),
    CONSTRAINT "PaymentRefund_status_check" CHECK ((status = ANY (ARRAY['creating'::text, 'pending'::text, 'succeeded'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: PaymentTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentTransaction" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    deal text,
    "serviceOrder" text,
    "sourceType" text NOT NULL,
    "amountCents" double precision NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    "providerKey" text DEFAULT ''::text NOT NULL,
    "providerTransactionId" text DEFAULT ''::text NOT NULL,
    "providerSessionId" text DEFAULT ''::text NOT NULL,
    "checkoutUrl" text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    "capturedCents" double precision DEFAULT 0 NOT NULL,
    "refundedCents" double precision DEFAULT 0 NOT NULL,
    "failureCode" text DEFAULT ''::text NOT NULL,
    "reconciliationReference" text DEFAULT ''::text NOT NULL,
    "reconciledAt" timestamp(3) without time zone,
    version integer DEFAULT 1 NOT NULL,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    "paymentProvider" text,
    "paymentMethod" text DEFAULT ''::text NOT NULL,
    lead text,
    CONSTRAINT "PaymentTransaction_amounts_check" CHECK ((("amountCents" > (0)::double precision) AND ("capturedCents" >= (0)::double precision) AND ("refundedCents" >= (0)::double precision) AND ("refundedCents" <= "capturedCents") AND ("capturedCents" <= "amountCents") AND (version > 0))),
    CONSTRAINT "PaymentTransaction_provider_currency_check" CHECK ((("providerKey" <> ''::text) AND (currency = 'usd'::text))),
    CONSTRAINT "PaymentTransaction_source_check" CHECK (((("sourceType" = 'deal'::text) AND (deal IS NOT NULL) AND ("serviceOrder" IS NULL) AND (lead IS NULL)) OR (("sourceType" = 'service'::text) AND ("serviceOrder" IS NOT NULL) AND (deal IS NULL) AND (lead IS NULL)) OR (("sourceType" = 'reservation'::text) AND (lead IS NOT NULL) AND (deal IS NULL) AND ("serviceOrder" IS NULL)))),
    CONSTRAINT "PaymentTransaction_status_check" CHECK ((status = ANY (ARRAY['creating'::text, 'pending'::text, 'authorized'::text, 'captured'::text, 'failed'::text, 'canceled'::text, 'partially-refunded'::text, 'refunded'::text])))
);


--
-- Name: PriceHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PriceHistory" (
    id text NOT NULL,
    vehicle text,
    "effectiveDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "previousPriceCents" double precision,
    "newPriceCents" double precision NOT NULL,
    "changeReason" text DEFAULT ''::text NOT NULL,
    "changedBy" text,
    notes text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    CONSTRAINT "PriceHistory_nonnegative_check" CHECK ((("newPriceCents" >= (0)::double precision) AND ("previousPriceCents" >= (0)::double precision)))
);


--
-- Name: ProgressiveOffer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProgressiveOffer" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    number integer,
    title text DEFAULT ''::text NOT NULL,
    vehicle text,
    photo_id text,
    photo_filesize integer,
    photo_width integer,
    photo_height integer,
    photo_extension text,
    "photoUrl" text DEFAULT ''::text NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "startPriceCents" double precision NOT NULL,
    "stepCents" double precision NOT NULL,
    "stepEvery" integer DEFAULT 1 NOT NULL,
    "stepUnit" text DEFAULT 'hours'::text NOT NULL,
    "stepMinutes" integer DEFAULT 60,
    "floorPriceCents" double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "soldAt" timestamp(3) without time zone,
    financing text DEFAULT ''::text NOT NULL,
    conditions text DEFAULT ''::text NOT NULL,
    "includesTransfer" text DEFAULT 'included'::text,
    "noAppointment" text DEFAULT 'walk-in'::text
);


--
-- Name: RepairOrderLineItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RepairOrderLineItem" (
    id text NOT NULL,
    "serviceOrder" text,
    "itemType" text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "partNumber" text DEFAULT ''::text NOT NULL,
    quantity double precision DEFAULT 1 NOT NULL,
    "unitPriceCents" double precision NOT NULL,
    "priceCents" double precision NOT NULL,
    "costCents" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    CONSTRAINT "RepairOrderLineItem_line_total_check" CHECK ((abs(("priceCents" - (quantity * "unitPriceCents"))) <= (0.5)::double precision)),
    CONSTRAINT "RepairOrderLineItem_nonnegative_check" CHECK ((("unitPriceCents" >= (0)::double precision) AND ("priceCents" >= (0)::double precision) AND ("costCents" >= (0)::double precision))),
    CONSTRAINT "RepairOrderLineItem_quantity_positive_check" CHECK ((quantity > (0)::double precision))
);


--
-- Name: ReportRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReportRun" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "savedReport" text NOT NULL,
    status text NOT NULL,
    "exportFormat" text NOT NULL,
    "resultSnapshot" jsonb DEFAULT '{}'::jsonb,
    "resultDigest" text DEFAULT ''::text NOT NULL,
    "errorCode" text DEFAULT ''::text NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "ReportRun_status_format_check" CHECK (((status = ANY (ARRAY['queued'::text, 'completed'::text, 'failed'::text, 'expired'::text])) AND ("exportFormat" = ANY (ARRAY['json'::text, 'csv'::text]))))
);


--
-- Name: RetentionPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RetentionPolicy" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    category text NOT NULL,
    "retentionDays" integer NOT NULL,
    "legalHold" boolean DEFAULT false NOT NULL,
    rationale text DEFAULT ''::text NOT NULL,
    "lastSweptAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "RetentionPolicy_minimum_days_check" CHECK ((((category = 'audit-evidence'::text) AND ("retentionDays" >= 2555)) OR ((category = 'customer-intake'::text) AND ("retentionDays" >= 730)) OR ((category = 'provider-payload'::text) AND ("retentionDays" >= 365)) OR ((category = 'report-export'::text) AND ("retentionDays" >= 1))))
);


--
-- Name: Role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    "canSeeOtherPeople" boolean DEFAULT false NOT NULL,
    "canEditOtherPeople" boolean DEFAULT false NOT NULL,
    "canManagePeople" boolean DEFAULT false NOT NULL,
    "canManageRoles" boolean DEFAULT false NOT NULL,
    "canAccessDashboard" boolean DEFAULT false NOT NULL,
    "canApproveDeals" boolean DEFAULT false NOT NULL,
    "canManageDeals" boolean DEFAULT false NOT NULL,
    "canManageFinancing" boolean DEFAULT false NOT NULL,
    "canManageInventory" boolean DEFAULT false NOT NULL,
    "canManageLeads" boolean DEFAULT false NOT NULL,
    "canManageService" boolean DEFAULT false NOT NULL,
    "canManageTradeIns" boolean DEFAULT false NOT NULL,
    "canViewAllLeads" boolean DEFAULT false NOT NULL,
    "canViewInventory" boolean DEFAULT false NOT NULL,
    "canViewReports" boolean DEFAULT false NOT NULL,
    "canManageOnboarding" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "canManageDealerships" boolean DEFAULT false NOT NULL,
    "canManageKeys" boolean DEFAULT false NOT NULL,
    "canManagePayments" boolean DEFAULT false NOT NULL,
    "canManageSettings" boolean DEFAULT false NOT NULL,
    "canManageUsers" boolean DEFAULT false NOT NULL,
    "canReadPayments" boolean DEFAULT false NOT NULL,
    "canReadRoles" boolean DEFAULT false NOT NULL,
    "canReadUsers" boolean DEFAULT false NOT NULL
);


--
-- Name: Rooftop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Rooftop" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rooftopKey" text DEFAULT ''::text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    "publicSlug" text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    timezone text DEFAULT 'America/Argentina/Buenos_Aires'::text NOT NULL,
    "currencyCode" text DEFAULT 'USD'::text NOT NULL,
    "dealerGroup" text
);


--
-- Name: RooftopMembership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RooftopMembership" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "membershipKey" text DEFAULT ''::text NOT NULL,
    "user" text,
    rooftop text,
    role text,
    status text DEFAULT 'invited'::text NOT NULL,
    "invitedBy" text,
    "joinedAt" timestamp(3) without time zone
);


--
-- Name: SalesVisit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SalesVisit" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    lead text NOT NULL,
    customer text NOT NULL,
    vehicle text,
    "assignedSalesperson" text NOT NULL,
    manager text,
    kind text NOT NULL,
    status text NOT NULL,
    "scheduledAt" timestamp(3) without time zone,
    "arrivedAt" timestamp(3) without time zone,
    "managerTurnAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    outcome text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    CONSTRAINT "SalesVisit_kind_check" CHECK ((kind = ANY (ARRAY['appointment'::text, 'showroom'::text]))),
    CONSTRAINT "SalesVisit_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'arrived'::text, 'manager-turn'::text, 'completed'::text, 'cancelled'::text, 'no-show'::text])))
);


--
-- Name: SavedReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SavedReport" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    owner text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    "reportType" text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    "exportFormat" text NOT NULL,
    schedule text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "nextRunAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "SavedReport_configuration_check" CHECK ((("reportType" = ANY (ARRAY['operations'::text, 'audit'::text, 'accounting-exceptions'::text, 'payment-reconciliation'::text])) AND ("exportFormat" = ANY (ARRAY['json'::text, 'csv'::text])) AND (schedule = ANY (ARRAY['manual'::text, 'daily'::text, 'weekly'::text, 'monthly'::text]))))
);


--
-- Name: ServiceAppointment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceAppointment" (
    id text NOT NULL,
    customer text,
    "customerVehicleDescription" text DEFAULT ''::text NOT NULL,
    "appointmentDate" timestamp(3) without time zone NOT NULL,
    "serviceType" text,
    description text DEFAULT ''::text NOT NULL,
    "estimatedDuration" integer,
    "assignedTech" text,
    status text DEFAULT 'scheduled'::text,
    "mileageIn" integer,
    "advisorNotes" text DEFAULT ''::text NOT NULL,
    "serviceOrder" text,
    lead text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "capacitySlot" text DEFAULT ''::text NOT NULL,
    "transportationNeed" text DEFAULT 'none'::text,
    "vehicleVin" text DEFAULT ''::text NOT NULL,
    "requestedBy" text,
    "servicePackage" text,
    CONSTRAINT "ServiceAppointment_nonnegative_check" CHECK ((("estimatedDuration" >= 0) AND ("mileageIn" >= 0)))
);


--
-- Name: ServiceLaborOperation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceLaborOperation" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "serviceOrder" text NOT NULL,
    "operationCode" text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    technician text,
    "soldHours" double precision,
    "actualMinutes" integer,
    "timePunches" jsonb DEFAULT '[]'::jsonb,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "ServiceLaborOperation_time_check" CHECK (((("soldHours" IS NULL) OR ("soldHours" >= (0)::double precision)) AND (("actualMinutes" IS NULL) OR ("actualMinutes" >= 0))))
);


--
-- Name: ServiceOrder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceOrder" (
    id text NOT NULL,
    diagnosis text DEFAULT ''::text NOT NULL,
    "workPerformed" text DEFAULT ''::text NOT NULL,
    recommendations text DEFAULT ''::text NOT NULL,
    "laborTotalCents" double precision,
    "partsTotalCents" double precision,
    "taxCents" double precision,
    "grandTotalCents" double precision,
    status text DEFAULT 'estimate'::text,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "settledAt" timestamp(3) without time zone,
    "evidenceSnapshot" jsonb DEFAULT '{}'::jsonb,
    rooftop text NOT NULL,
    "authorizationEvidence" jsonb DEFAULT '{}'::jsonb,
    "authorizationStatus" text DEFAULT 'pending'::text,
    cause text DEFAULT ''::text NOT NULL,
    concern text DEFAULT ''::text NOT NULL,
    correction text DEFAULT ''::text NOT NULL,
    "declinedWork" jsonb DEFAULT '[]'::jsonb,
    "inspectionEvidence" jsonb DEFAULT '[]'::jsonb,
    "invoiceNumber" text DEFAULT ''::text NOT NULL,
    "payType" text DEFAULT 'customer'::text,
    CONSTRAINT "ServiceOrder_nonnegative_check" CHECK ((("laborTotalCents" >= (0)::double precision) AND ("partsTotalCents" >= (0)::double precision) AND ("taxCents" >= (0)::double precision) AND ("grandTotalCents" >= (0)::double precision))),
    CONSTRAINT "ServiceOrder_total_matches_parts_check" CHECK (("grandTotalCents" = ((COALESCE("laborTotalCents", (0)::double precision) + COALESCE("partsTotalCents", (0)::double precision)) + COALESCE("taxCents", (0)::double precision))))
);


--
-- Name: ServicePackage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServicePackage" (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "priceCents" double precision NOT NULL,
    "estimatedDuration" integer,
    "includedServices" jsonb DEFAULT '[]'::jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    CONSTRAINT "ServicePackage_nonnegative_check" CHECK ((("priceCents" >= (0)::double precision) AND ("estimatedDuration" >= 0)))
);


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "assignedTo" text,
    lead text,
    priority text DEFAULT 'medium'::text,
    completed boolean DEFAULT false NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "completedDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL
);


--
-- Name: TestDrive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestDrive" (
    id text NOT NULL,
    lead text,
    vehicle text,
    salesperson text,
    "scheduledTime" timestamp(3) without time zone NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    "driverLicenseVerified" boolean DEFAULT false NOT NULL,
    feedback text DEFAULT ''::text NOT NULL,
    "interestedLevel" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "requestedBy" text,
    "noShow" boolean DEFAULT false NOT NULL,
    "cancelledAt" timestamp(3) without time zone
);


--
-- Name: TradeIn; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TradeIn" (
    id text NOT NULL,
    vin text DEFAULT ''::text NOT NULL,
    year text DEFAULT ''::text NOT NULL,
    make text DEFAULT ''::text NOT NULL,
    model text DEFAULT ''::text NOT NULL,
    "trim" text DEFAULT ''::text NOT NULL,
    mileage integer,
    condition text,
    "exteriorCondition" text DEFAULT ''::text NOT NULL,
    "interiorCondition" text DEFAULT ''::text NOT NULL,
    "mechanicalIssues" text DEFAULT ''::text NOT NULL,
    "kbbValueCents" double precision,
    "offerAmountCents" double precision,
    "mainPhoto_id" text,
    "mainPhoto_filesize" integer,
    "mainPhoto_width" integer,
    "mainPhoto_height" integer,
    "mainPhoto_extension" text,
    "appraisedBy" text,
    lead text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "photoTokenExpiresAt" timestamp(3) without time zone,
    "photoTokenHash" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "TradeIn_nonnegative_check" CHECK ((("kbbValueCents" >= (0)::double precision) AND ("offerAmountCents" >= (0)::double precision) AND (mileage >= 0)))
);


--
-- Name: TradeInPhoto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TradeInPhoto" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "tradeIn" text,
    image_id text,
    image_filesize integer,
    image_width integer,
    image_height integer,
    image_extension text,
    "sortOrder" integer DEFAULT 0
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    password text NOT NULL,
    role text,
    "passwordResetIssuedAt" timestamp(3) without time zone,
    "passwordResetRedeemedAt" timestamp(3) without time zone,
    "passwordResetToken" text,
    "commissionRate" double precision DEFAULT 0,
    "employeeId" text DEFAULT ''::text NOT NULL,
    "isFinanceManager" boolean DEFAULT false NOT NULL,
    "isSalesperson" boolean DEFAULT false NOT NULL,
    "isServiceAdvisor" boolean DEFAULT false NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    "onboardingStatus" text DEFAULT 'not_started'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "User_commissionRate_range_check" CHECK ((("commissionRate" >= (0)::double precision) AND ("commissionRate" <= (100)::double precision)))
);


--
-- Name: Vehicle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Vehicle" (
    id text NOT NULL,
    vin text DEFAULT ''::text NOT NULL,
    "stockNumber" text DEFAULT ''::text NOT NULL,
    year integer NOT NULL,
    make text DEFAULT ''::text NOT NULL,
    model text DEFAULT ''::text NOT NULL,
    "trim" text DEFAULT ''::text NOT NULL,
    "exteriorColor" text DEFAULT ''::text NOT NULL,
    "interiorColor" text DEFAULT ''::text NOT NULL,
    mileage integer,
    "purchasePriceCents" double precision,
    "listPriceCents" double precision,
    "priceCents" double precision,
    condition text,
    status text DEFAULT 'available'::text,
    description text DEFAULT ''::text NOT NULL,
    features jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    history text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    engine text DEFAULT ''::text NOT NULL,
    "fuelType" text,
    "isFeatured" boolean DEFAULT false NOT NULL,
    transmission text,
    CONSTRAINT "Vehicle_nonnegative_check" CHECK ((("priceCents" >= (0)::double precision) AND ("listPriceCents" >= (0)::double precision) AND ("purchasePriceCents" >= (0)::double precision) AND (mileage >= 0)))
);


--
-- Name: VehicleConditionReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VehicleConditionReport" (
    id text NOT NULL,
    vehicle text,
    "reportDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    inspector text DEFAULT ''::text NOT NULL,
    "overallCondition" text,
    "mechanicalRating" text,
    "bodyRating" text,
    "interiorRating" text,
    issues jsonb DEFAULT '[]'::jsonb,
    "estimatedRepairs" integer,
    notes text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL
);


--
-- Name: VehicleHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VehicleHistory" (
    id text NOT NULL,
    "acquisitionDate" timestamp(3) without time zone,
    "acquisitionSource" text DEFAULT ''::text NOT NULL,
    "previousOwners" integer,
    "hasAccidents" boolean DEFAULT false NOT NULL,
    "accidentDetails" text DEFAULT ''::text NOT NULL,
    "serviceRecords" text DEFAULT ''::text NOT NULL,
    "titleStatus" text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL
);


--
-- Name: VehicleImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VehicleImage" (
    id text NOT NULL,
    vehicle text,
    image_id text,
    image_filesize integer,
    image_width integer,
    image_height integer,
    image_extension text,
    caption text DEFAULT ''::text NOT NULL,
    category text DEFAULT 'exterior'::text,
    "sortOrder" integer DEFAULT 0,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "imagePath" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL
);


--
-- Name: WeOweItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WeOweItem" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rooftop text NOT NULL,
    "deliveryCase" text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    "promisedAt" timestamp(3) without time zone NOT NULL,
    owner text NOT NULL,
    "estimatedCostCents" double precision,
    "fulfillmentEvidence" text DEFAULT ''::text NOT NULL,
    "customerAcknowledgment" text DEFAULT ''::text NOT NULL,
    "fulfilledAt" timestamp(3) without time zone,
    "idempotencyKey" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "WeOweItem_cost_check" CHECK ((("estimatedCostCents" IS NULL) OR ("estimatedCostCents" >= (0)::double precision)))
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: AccountingBatch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AccountingBatch" (id, "createdAt", "updatedAt", rooftop, "sourceType", "sourceId", status, "providerKey", lines, "totalDebitCents", "totalCreditCents", "attemptCount", "externalReference", "lastErrorCode", "postedAt", "reconciledAt", "lockedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: AccountingMapping; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AccountingMapping" (id, "createdAt", "updatedAt", rooftop, "sourceType", "sourceCode", "debitAccount", "creditAccount", "providerKey") FROM stdin;
cmwn5n9py00bj7ds34tj9qbr7	2026-11-19 06:14:10.679	2026-11-19 06:14:10.679	rooftop-default-main	deal	vehicle-sale	1100 Contracts in Transit	4000 Vehicle Sales	operator-recorded
cmwn5n9qr00bn7ds3ymu44jjy	2026-11-19 06:14:10.707	2026-11-19 06:14:10.707	rooftop-default-main	deal	sales-tax	1100 Contracts in Transit	2310 Sales Tax Payable	operator-recorded
cmwn5n9rj00br7ds3i5bgoqt1	2026-11-19 06:14:10.735	2026-11-19 06:14:10.735	rooftop-default-main	deal	fees	1100 Contracts in Transit	4900 Documentation Fees	operator-recorded
cmwn5n9s800bv7ds3gi9o0dye	2026-11-19 06:14:10.761	2026-11-19 06:14:10.761	rooftop-default-main	deal	finance-products	1100 Contracts in Transit	4800 F&I Product Income	operator-recorded
cmwn5n9t100bz7ds3arqmqu30	2026-11-19 06:14:10.79	2026-11-19 06:14:10.79	rooftop-default-main	deal	rebates	1250 Factory Receivables	1100 Contracts in Transit	operator-recorded
cmwn5n9tq00c37ds3hewb8stg	2026-11-19 06:14:10.814	2026-11-19 06:14:10.814	rooftop-default-main	deal	trade-in	2400 Used Vehicle Inventory	1100 Contracts in Transit	operator-recorded
cmwn5n9uf00c77ds3juc97mzo	2026-11-19 06:14:10.839	2026-11-19 06:14:10.839	rooftop-default-main	service	labor	1200 Service Receivables	4600 Customer Labor Sales	operator-recorded
cmwn5n9v300cb7ds326d0ixts	2026-11-19 06:14:10.864	2026-11-19 06:14:10.864	rooftop-default-main	service	parts	1200 Service Receivables	4700 Parts Sales	operator-recorded
cmwn5n9vs00cf7ds3f61dlptx	2026-11-19 06:14:10.889	2026-11-19 06:14:10.889	rooftop-default-main	service	sales-tax	1200 Service Receivables	2310 Sales Tax Payable	operator-recorded
cmwn5n9we00cj7ds39zq5hzbz	2026-11-19 06:14:10.91	2026-11-19 06:14:10.91	rooftop-default-main	parts	inventory-receipt	1400 Parts Inventory	2000 Accounts Payable	operator-recorded
cmwn5n9x200cn7ds3avq4xchy	2026-11-19 06:14:10.934	2026-11-19 06:14:10.934	rooftop-default-main	payment	payment-capture	1010 Cash in Bank	1200 Service Receivables	operator-recorded
\.


--
-- Data for Name: AccountingProviderResponse; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AccountingProviderResponse" (id, "createdAt", "updatedAt", rooftop, batch, "providerKey", "requestFingerprint", "responseCode", "externalReference", "immutableResponse", "receivedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: ApiKey; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ApiKey" (id, name, "tokenSecret", "tokenPreview", scopes, status, "expiresAt", "lastUsedAt", "usageCount", "restrictedToIPs", "createdAt", "updatedAt", "user") FROM stdin;
\.


--
-- Data for Name: AuthenticationThrottle; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuthenticationThrottle" (id, "keyHash", purpose, "failureCount", "windowStartedAt", "blockedUntil", "updatedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Bank; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Bank" (id, "createdAt", "updatedAt", name, active, website, notes, "providerKey") FROM stdin;
bank_nacion	2026-11-19 06:16:08.405	2026-11-19 06:16:08.405	Banco Nación	t	https://www.bna.com.ar	Cargar planes reales en Tablas → Planes de financiación.	manual
bank_provincia	2026-11-19 06:16:08.405	2026-11-19 06:16:08.405	Banco Provincia	t	https://www.bancoprovincia.com.ar	Cargar planes reales en Tablas → Planes de financiación.	manual
bank_ejemplo	2026-11-19 06:16:08.405	2026-11-19 06:16:08.405	Banco de ejemplo	t		Solo para la demostración. Desactivar al cargar los planes reales.	manual
\.


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Customer" (id, "createdAt", "updatedAt", rooftop, "firstName", "lastName", "primaryEmail", "primaryPhone", "normalizedEmail", "normalizedPhone", "identityKey", status, "emailConsent", "smsConsent", "phoneConsent", "mergedAt", "mergedInto", "contactPreferenceUpdatedAt", "emailSuppressed", household, "phoneSuppressed", "preferredChannel", "smsSuppressed", "suppressionReason", "suppressionSource", account) FROM stdin;
\.


--
-- Data for Name: CustomerContactPreferenceEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerContactPreferenceEvent" (id, "createdAt", "updatedAt", rooftop, customer, actor, source, reason, "occurredAt", "preferenceSnapshot") FROM stdin;
\.


--
-- Data for Name: CustomerHousehold; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerHousehold" (id, "createdAt", "updatedAt", rooftop, "householdKey", "displayName") FROM stdin;
\.


--
-- Data for Name: CustomerInteraction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerInteraction" (id, lead, "interactionType", date, duration, notes, outcome, "followUpDate", "followUpCompleted", "performedBy", "createdAt", "updatedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: CustomerMergeEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerMergeEvent" (id, "createdAt", "updatedAt", rooftop, survivor, duplicate, actor, reason, "mergedAt", "movedLeadIds", "evidenceSnapshot") FROM stdin;
\.


--
-- Data for Name: Deal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Deal" (id, lead, vehicle, salesperson, "vehiclePriceCents", "tradeInValueCents", "tradeInVehicle", "tradeInDetails", "downPaymentCents", "financingAmountCents", "monthlyPaymentCents", "loanTerm", apr, status, "taxAmountCents", fees, "saleDate", "createdAt", "updatedAt", "lockedAt", "evidenceSnapshot", rooftop, "acceptedAt", "acceptedSnapshot", "grossCents", "moneyFactorBasisPoints", "presentedAt", "presentedSnapshot", products, rebates, "residualValueCents", "structureType", "taxLines", "worksheetVersion", "selectedLenderDecision") FROM stdin;
\.


--
-- Data for Name: DealApproval; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DealApproval" (id, deal, approver, decision, notes, "approvalDate", "createdAt", "updatedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: DealerGroup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DealerGroup" (id, "createdAt", "updatedAt", name, slug, "legalName", status) FROM stdin;
dealer-group-default	2026-11-19 06:13:07.046	2026-11-19 06:14:08.347	Elvis Automotores S.R.L.	sams-motor-company		active
\.


--
-- Data for Name: DealerGroupMembership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DealerGroupMembership" (id, "createdAt", "updatedAt", "membershipKey", "user", "dealerGroup", role, status, "accessAllRooftops", "invitedBy", "joinedAt") FROM stdin;
cmwn5n7xz00027ds3ib76358j	2026-11-19 06:14:08.359	2026-11-19 06:14:08.359	dealer-group-default:cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	dealer-group-default	cmwn5mdut00007ds3cvywmlzd	active	t	\N	2026-11-19 06:14:08.359
\.


--
-- Data for Name: DealershipProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DealershipProfile" (id, "createdAt", "updatedAt", name, "shortName", "salesEmail", "serviceEmail", phone, "addressLine1", "addressLine2", city, state, "postalCode", "hoursMonFri", "hoursSaturday", "hoursSunday", "websiteUrl", "currencyCode", "homepageTitle", "homepageDescription", "logoIcon", "logoColor", "docFeeCents", "salesTaxRateBps", "whatsappNumber") FROM stdin;
1	2026-11-19 06:14:08.329	2026-11-19 06:14:08.329	Elvis Automotores S.R.L.	Elvis Automotores	elvisautomotores@gmail.com		(011) 4259-1365	Andrés Baranda 2134		Quilmes	Buenos Aires		9 a 13 h sin cita (por la tarde, solo con cita asignada)	Cerrado	Cerrado	https://www.elvisautomotores.com	ARS	Tu próximo auto, más cerca.	Compra y venta de usados y 0 km desde 2009. Venta a crédito con financiación de hasta el 100% (sujeto a calificación y aprobación crediticia).	<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 24c0 6.6274 5.37258 12 12 12v-12c0 6.6274 5.3726 12 12 12v-12c0 6.6274 5.3726 12 12 12s12-5.3726 12-12-5.3726-12-12-12-12 5.3726-12 12v-12c-6.6274 0-12 5.3726-12 12v-12c-6.62742 0-12 5.3726-12 12z" fill="#155eef"/></svg>	180	0	0	5491127235886
\.


--
-- Data for Name: DeliveryCase; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeliveryCase" (id, "createdAt", "updatedAt", rooftop, deal, status, "appointmentAt", "arrivedAt", checklist, "customerAcknowledgment", "acknowledgedAt", "deliverySnapshot", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: DomainAuditEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DomainAuditEvent" (id, "createdAt", "updatedAt", rooftop, "eventKey", "requestHash", "aggregateType", "aggregateId", action, "beforeSnapshot", "afterSnapshot", metadata, actor, "occurredAt") FROM stdin;
cmwn5n8oo001d7ds3q5grlp25	2026-11-19 06:14:09.336	2026-11-19 06:14:09.336	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AXK2DEG0D9PCF43E	8caf83bd897a0fb882f7ab89df03d79dfeff55810071538be8873e0fd7ce2d69	InventoryStock	cmwn5n8nd00117ds3i6j9ibzl	vehicle-intake	null	{"vin": "8AXK2DEG0D9PCF43E", "make": "BMW", "mode": "onboarding-ready", "year": 2021, "model": "530i", "reason": "Onboarding", "mileage": 48200, "features": ["Paquete M Sport", "Navegador", "Asientos calefaccionados", "Sensores de estacionamiento"], "condition": "used", "imagePath": "/images/vehicles/smc-2401.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 5490000000, "description": "Sedán premium con paquete M Sport, asistencias a la conducción e historial de service al día. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-101", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 5490000000, "sourceReference": "onboarding", "acquisitionSource": "trade-in", "purchasePriceCents": 4666500000}	{"stockId": "cmwn5n8nd00117ds3i6j9ibzl", "feedRunId": "cmwn5n8o9001b7ds3zsptt4pc", "vehicleId": "cmwn5n8mu000v7ds3sa4npbgr", "imageCreated": true, "acquisitionId": "cmwn5n8n9000z7ds3rwzk0x8d", "reconWorkItemId": "cmwn5n8nn00177ds3p6ts22ic", "merchandisingVersionId": "cmwn5n8o000197ds37ssx0ez7"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.335
cmwn5n8rl001x7ds33kq36et3	2026-11-19 06:14:09.441	2026-11-19 06:14:09.441	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8A4DHRD2DRCJV3KHW	b24b0f24dbee18f6a89afb411561d72bc5d5eb2beecb8e66c1d5e34497b4bcd8	InventoryStock	cmwn5n8qo001l7ds3l3wcix8b	vehicle-intake	null	{"vin": "8A4DHRD2DRCJV3KHW", "make": "Toyota", "mode": "onboarding-ready", "year": 2020, "model": "Camry", "reason": "Onboarding", "mileage": 62400, "features": ["Audio JBL", "Cargador inalámbrico", "Monitor de punto ciego"], "condition": "used", "imagePath": "/images/vehicles/smc-2404.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 3890000000, "description": "Sedán mediano con suspensión deportiva, cargador inalámbrico y audio JBL. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-102", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 3890000000, "sourceReference": "onboarding", "acquisitionSource": "trade-in", "purchasePriceCents": 3306500000}	{"stockId": "cmwn5n8qo001l7ds3l3wcix8b", "feedRunId": "cmwn5n8rc001v7ds37dh50wu8", "vehicleId": "cmwn5n8qc001f7ds30tli48hk", "imageCreated": true, "acquisitionId": "cmwn5n8qm001j7ds3q00numaw", "reconWorkItemId": "cmwn5n8r2001r7ds358nchv8d", "merchandisingVersionId": "cmwn5n8r8001t7ds3nl6wpkl8"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.44
cmwn5n8ss002h7ds3xgyvdg73	2026-11-19 06:14:09.484	2026-11-19 06:14:09.484	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AN0GEDP84X660WSM	cb3ec8c426004b783bbd3b278c320bff437607f97ac00ab8f83812140ab29eeb	InventoryStock	cmwn5n8sd00257ds3f23er93i	vehicle-intake	null	{"vin": "8AN0GEDP84X660WSM", "make": "Honda", "mode": "onboarding-ready", "year": 2022, "model": "CR-V", "reason": "Onboarding", "mileage": 35100, "features": ["Honda Sensing", "Techo solar", "Tracción integral"], "condition": "used", "imagePath": "/images/vehicles/smc-2405.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 4650000000, "description": "SUV híbrida con tracción integral, techo solar y asistentes de manejo Honda Sensing. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-103", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 4650000000, "sourceReference": "onboarding", "acquisitionSource": "trade-in", "purchasePriceCents": 3952500000}	{"stockId": "cmwn5n8sd00257ds3f23er93i", "feedRunId": "cmwn5n8sp002f7ds3b61xrtm2", "vehicleId": "cmwn5n8s9001z7ds332vylq2q", "imageCreated": true, "acquisitionId": "cmwn5n8sc00237ds39wtppoi9", "reconWorkItemId": "cmwn5n8sj002b7ds3spbf7ek6", "merchandisingVersionId": "cmwn5n8sn002d7ds35twqtoxd"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.483
cmwn5n8u100317ds3ra9jk745	2026-11-19 06:14:09.53	2026-11-19 06:14:09.53	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AW8Y5VEH93LYK83C	dc6efbbad9ddc74dcdb943465f4c9b74cce7cfeed4d69eaa3ce71a1dd3aa8a32	InventoryStock	cmwn5n8tm002p7ds334myjhbi	vehicle-intake	null	{"vin": "8AW8Y5VEH93LYK83C", "make": "Honda", "mode": "onboarding-ready", "year": 2019, "model": "Accord", "reason": "Onboarding", "mileage": 71800, "features": ["Cámara de retroceso", "Pantalla táctil", "Control crucero"], "condition": "used", "imagePath": "/images/vehicles/smc-2406.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 2990000000, "description": "Sedán amplio y confiable, ideal para familia, con pantalla táctil y cámara de retroceso. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-104", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 2990000000, "sourceReference": "onboarding", "acquisitionSource": "trade-in", "purchasePriceCents": 2541500000}	{"stockId": "cmwn5n8tm002p7ds334myjhbi", "feedRunId": "cmwn5n8ty002z7ds3o7v5gzpn", "vehicleId": "cmwn5n8tf002j7ds3g2w2c8uk", "imageCreated": true, "acquisitionId": "cmwn5n8tk002n7ds3x2yfb60l", "reconWorkItemId": "cmwn5n8ts002v7ds3s1xmwhir", "merchandisingVersionId": "cmwn5n8tw002x7ds3oztektdq"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.529
cmwn5n8v8003l7ds3g6k3vddo	2026-11-19 06:14:09.573	2026-11-19 06:14:09.573	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AYZ86EFU7EDW5V1Z	f069aa008a0b3727d9e680672bb2632c5d3ec4a2ba16d51f0b6e3b41eae94d37	InventoryStock	cmwn5n8uu00397ds3owwakuna	vehicle-intake	null	{"vin": "8AYZ86EFU7EDW5V1Z", "make": "Mercedes-Benz", "mode": "onboarding-ready", "year": 2018, "model": "C 300", "reason": "Onboarding", "mileage": 83500, "features": ["Tapizado de cuero", "Climatizador bizona", "Llantas de aleación"], "condition": "used", "imagePath": "/images/vehicles/smc-2409.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 3350000000, "description": "Sedán de lujo con interior en cuero y equipamiento completo. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-105", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 3350000000, "sourceReference": "onboarding", "acquisitionSource": "trade-in", "purchasePriceCents": 2847500000}	{"stockId": "cmwn5n8uu00397ds3owwakuna", "feedRunId": "cmwn5n8v6003j7ds357l7b56j", "vehicleId": "cmwn5n8un00337ds3e0hyldf6", "imageCreated": true, "acquisitionId": "cmwn5n8us00377ds361plk9c8", "reconWorkItemId": "cmwn5n8uz003f7ds3z687f8r7", "merchandisingVersionId": "cmwn5n8v3003h7ds398sbw2s9"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.572
cmwn5n9h700af7ds3crxbj215	2026-11-19 06:14:10.364	2026-11-19 06:14:10.364	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:WB-22-HYB:fecfa3abec962bec	eda009f9aa0f6392b0b05dc51e8e01c36d750e7e30e1a93a7c9df520d0c6325d	PartsInventory	rooftop-default-main:WB-22-HYB	configured	null	{"supplier": "Bosch", "costCents": 850, "rooftopId": "rooftop-default-main", "partNumber": "WB-22-HYB", "priceCents": 2199, "binLocation": "C2-01", "description": "22-inch hybrid wiper blade", "minimumQuantity": 12}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.363
cmwn5n8w700457ds360q4w7cq	2026-11-19 06:14:09.608	2026-11-19 06:14:09.608	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AZLH8DPVJS228FL5	e51cbebcaa8fc458077d3c3f5bbb786a653fad76992b8075c74f4dbb1cc90460	InventoryStock	cmwn5n8vx003t7ds34ktzndka	vehicle-intake	null	{"vin": "8AZLH8DPVJS228FL5", "make": "Ford", "mode": "onboarding-ready", "year": 2017, "model": "Mustang", "reason": "Onboarding", "mileage": 59800, "features": ["Motor V8", "Escape deportivo", "Modo de manejo seleccionable"], "condition": "used", "imagePath": "/images/vehicles/smc-2412.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 5290000000, "description": "Deportivo icónico con motor V8 y caja manual de 6 marchas. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-106", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 5290000000, "sourceReference": "onboarding", "acquisitionSource": "trade-in", "purchasePriceCents": 4496500000}	{"stockId": "cmwn5n8vx003t7ds34ktzndka", "feedRunId": "cmwn5n8w500437ds34g9fh8ge", "vehicleId": "cmwn5n8vt003n7ds36ndp65mb", "imageCreated": true, "acquisitionId": "cmwn5n8vw003r7ds3r4mchv0s", "reconWorkItemId": "cmwn5n8w1003z7ds3br7mle1g", "merchandisingVersionId": "cmwn5n8w300417ds3cmg3x2is"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.607
cmwn5n909006d7ds3tcnkqxud	2026-11-19 06:14:09.754	2026-11-19 06:14:09.754	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9B1KTZ07HH8677WFK	1417e84e04f77e9766d3d38c79dc8ce48975ab4dfa01e7368e6a4a382af0c7bd	InventoryStock	cmwn5n8zv00617ds3kk46hao5	vehicle-intake	null	{"vin": "9B1KTZ07HH8677WFK", "make": "Renault", "mode": "onboarding-ready", "year": 2026, "model": "Kardian", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 2980000000, "description": "Renault Kardian Evolution 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-204", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 2980000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 2682000000}	{"stockId": "cmwn5n8zv00617ds3kk46hao5", "feedRunId": "cmwn5n907006b7ds39hxblvei", "vehicleId": "cmwn5n8zq005v7ds34ku8k4zf", "imageCreated": true, "acquisitionId": "cmwn5n8zt005z7ds3akiojzi7", "reconWorkItemId": "cmwn5n90000677ds357db6vvc", "merchandisingVersionId": "cmwn5n90300697ds3s9m1jjir"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.753
cmwn5n91c006x7ds38f06n0n5	2026-11-19 06:14:09.793	2026-11-19 06:14:09.793	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BT7LBP0KBWFT0LZR	10381cfc4b817e970d5377da0a87eb5e9dade028125f1ee35cc7ead111cca39d	InventoryStock	cmwn5n90z006l7ds3894zgucr	vehicle-intake	null	{"vin": "9BT7LBP0KBWFT0LZR", "make": "Toyota", "mode": "onboarding-ready", "year": 2026, "model": "Hilux", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 6450000000, "description": "Toyota Hilux SRV 4x4 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-205", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 6450000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 5805000000}	{"stockId": "cmwn5n90z006l7ds3894zgucr", "feedRunId": "cmwn5n91a006v7ds3b94wdbfd", "vehicleId": "cmwn5n90v006f7ds3i3bn2uwz", "imageCreated": true, "acquisitionId": "cmwn5n90y006j7ds34yetpfoj", "reconWorkItemId": "cmwn5n914006r7ds3mfh0j41v", "merchandisingVersionId": "cmwn5n917006t7ds3mya2bazt"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.792
cmwn5n93e00817ds3gv1t00a0	2026-11-19 06:14:09.867	2026-11-19 06:14:09.867	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9B0FRGR7NYP7A7ZFH	054398118d4f4095b1e2180ff64afc4d4229e371cc931f74ef9698c88105e61f	InventoryStock	cmwn5n934007p7ds3chn23tv3	vehicle-intake	null	{"vin": "9B0FRGR7NYP7A7ZFH", "make": "Chery", "mode": "onboarding-ready", "year": 2026, "model": "Tiggo 4", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 2870000000, "description": "Chery Tiggo 4 Luxury 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-207", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 2870000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 2583000000}	{"stockId": "cmwn5n934007p7ds3chn23tv3", "feedRunId": "cmwn5n93d007z7ds3n1thaoc7", "vehicleId": "cmwn5n930007j7ds3kkjpr2nm", "imageCreated": true, "acquisitionId": "cmwn5n933007n7ds3g07junbn", "reconWorkItemId": "cmwn5n938007v7ds3lhlj3svy", "merchandisingVersionId": "cmwn5n93b007x7ds3wulsycv2"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.866
cmwn5n9ax00937ds377xdbg4i	2026-11-19 06:14:10.138	2026-11-19 06:14:10.138	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:15400-PLM-A02:58f7a875cb7a6971	6ab1b37fd2d6ea5b9ba2e3dc3fa8a4baf5c18982d0819bc96faecdd4a8d358d8	PartsInventory	rooftop-default-main:15400-PLM-A02	configured	null	{"supplier": "Honda Parts Direct", "costCents": 480, "rooftopId": "rooftop-default-main", "partNumber": "15400-PLM-A02", "priceCents": 949, "binLocation": "A1-02", "description": "Honda oil filter", "minimumQuantity": 20}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.137
cmwn5n9bb00977ds331p3xh7j	2026-11-19 06:14:10.152	2026-11-19 06:14:10.152	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:15400-PLM-A02	f22eede4edd3adb6b2db768327f840706dfb0e414890bb7af7b91c5b2dd4a423	PartsMovement	cmwn5n9b000957ds38h3q51od	receipt	null	{"partId": "cmwn5n9b000957ds38h3q51od", "reason": "Onboarding", "quantity": 40, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.151
cmwn5n9f7009z7ds3ud6r6xlb	2026-11-19 06:14:10.291	2026-11-19 06:14:10.291	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:EAF-17220-5PA:9669288d58c916d3	ebaeb824538f59f8b3b2017b85c994d3e393e71eb847be5ed8ff2026a0607102	PartsInventory	rooftop-default-main:EAF-17220-5PA	configured	null	{"supplier": "Honda Parts Direct", "costCents": 1150, "rooftopId": "rooftop-default-main", "partNumber": "EAF-17220-5PA", "priceCents": 2899, "binLocation": "C1-04", "description": "Engine air filter", "minimumQuantity": 10}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.29
cmwn5n9fk00a37ds33r4dyy5j	2026-11-19 06:14:10.304	2026-11-19 06:14:10.304	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:EAF-17220-5PA	b1c453e71a79e8f2920cad33ac2bca9a2980766318eed798a05052dd235443f5	PartsMovement	cmwn5n9f900a17ds3ru4pkl6f	receipt	null	{"partId": "cmwn5n9f900a17ds3ru4pkl6f", "reason": "Onboarding", "quantity": 20, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.303
cmwn5n8x5004p7ds3pevx8tmb	2026-11-19 06:14:09.641	2026-11-19 06:14:09.641	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BJ4U3Z1RKFMKRRA8	07cc3c51e0c1a280b11c33cf75e0427ddd3385dfc1a675a1d986a6e1d7b7ed74	InventoryStock	cmwn5n8wt004d7ds38oi9yqzd	vehicle-intake	null	{"vin": "9BJ4U3Z1RKFMKRRA8", "make": "Peugeot", "mode": "onboarding-ready", "year": 2026, "model": "208", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 2750000000, "description": "Peugeot 208 Allure 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-201", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 2750000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 2475000000}	{"stockId": "cmwn5n8wt004d7ds38oi9yqzd", "feedRunId": "cmwn5n8x2004n7ds30n5dp9ic", "vehicleId": "cmwn5n8wp00477ds3jfwp8wyn", "imageCreated": true, "acquisitionId": "cmwn5n8ws004b7ds3sdkh76hi", "reconWorkItemId": "cmwn5n8wx004j7ds3d2mlj1n7", "merchandisingVersionId": "cmwn5n8x0004l7ds3h4tc4dfs"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.64
cmwn5n8y600597ds3etvnvplt	2026-11-19 06:14:09.679	2026-11-19 06:14:09.679	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BVAK30XJ9D62222G	de90d06b38cd665304320d17298c37fc3db77895d4caafce8c20e1ddfe6375b0	InventoryStock	cmwn5n8xu004x7ds3zdcfc0rd	vehicle-intake	null	{"vin": "9BVAK30XJ9D62222G", "make": "Fiat", "mode": "onboarding-ready", "year": 2026, "model": "Cronos", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 2490000000, "description": "Fiat Cronos Drive 1.3 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-202", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 2490000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 2241000000}	{"stockId": "cmwn5n8xu004x7ds3zdcfc0rd", "feedRunId": "cmwn5n8y400577ds35i8ndzjw", "vehicleId": "cmwn5n8xq004r7ds309fmvwwt", "imageCreated": true, "acquisitionId": "cmwn5n8xt004v7ds332p9ovbf", "reconWorkItemId": "cmwn5n8xz00537ds3qlk0ie3s", "merchandisingVersionId": "cmwn5n8y200557ds311032qec"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.678
cmwn5n92e007h7ds3gwya397d	2026-11-19 06:14:09.83	2026-11-19 06:14:09.83	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BRNS2RN8ZBBU7TNZ	b848ed9e7b609f16207661808ad53bdd5bb8ef0f86667e3334380999c6c98147	InventoryStock	cmwn5n92200757ds3dcgzo340	vehicle-intake	null	{"vin": "9BRNS2RN8ZBBU7TNZ", "make": "Chevrolet", "mode": "onboarding-ready", "year": 2026, "model": "Tracker", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 3390000000, "description": "Chevrolet Tracker LTZ 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-206", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 3390000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 3051000000}	{"stockId": "cmwn5n92200757ds3dcgzo340", "feedRunId": "cmwn5n92b007f7ds3yv1wh4db", "vehicleId": "cmwn5n91y006z7ds3s100xzir", "imageCreated": true, "acquisitionId": "cmwn5n92100737ds367gav8xt", "reconWorkItemId": "cmwn5n926007b7ds38xpewyef", "merchandisingVersionId": "cmwn5n929007d7ds3mczj9cig"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.829
cmwn5n99r008v7ds3jokq7fgw	2026-11-19 06:14:10.096	2026-11-19 06:14:10.096	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:90915-YZZD1:92cf5c086b39e7ea	9fc1cda051c29957219024bcd48053ad2ee7414bd82c6fdf844f0b621ec78d67	PartsInventory	rooftop-default-main:90915-YZZD1	configured	null	{"supplier": "Toyota Parts Center", "costCents": 510, "rooftopId": "rooftop-default-main", "partNumber": "90915-YZZD1", "priceCents": 999, "binLocation": "A1-01", "description": "Toyota oil filter", "minimumQuantity": 20}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.095
cmwn5n9a6008z7ds3ye32umc2	2026-11-19 06:14:10.111	2026-11-19 06:14:10.111	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:90915-YZZD1	3eab196d9cb5e5ae6fc136616a745a296671d7283b1d5c783ef27bbb46b69d1f	PartsMovement	cmwn5n99t008x7ds356b0smyh	receipt	null	{"partId": "cmwn5n99t008x7ds356b0smyh", "reason": "Onboarding", "quantity": 48, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.11
cmwn5n9d3009j7ds35h5l1gq1	2026-11-19 06:14:10.215	2026-11-19 06:14:10.215	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:BP-CER-F1024:a2aeba66dab7679d	b7fa0e992ebc1c26e12673fdea01018b662d9b563f721a9b7048176e0498c032	PartsInventory	rooftop-default-main:BP-CER-F1024	configured	null	{"supplier": "Akebono", "costCents": 3800, "rooftopId": "rooftop-default-main", "partNumber": "BP-CER-F1024", "priceCents": 8999, "binLocation": "B3-04", "description": "Ceramic front brake pad set", "minimumQuantity": 6}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.214
cmwn5n9df009n7ds3r54dp8hs	2026-11-19 06:14:10.227	2026-11-19 06:14:10.227	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:BP-CER-F1024	c39c18e7ec1f65f0522f751dc5b98fdaaf4e05f3187a125249760afd538fd877	PartsMovement	cmwn5n9d4009l7ds3u1uxx32h	receipt	null	{"partId": "cmwn5n9d4009l7ds3u1uxx32h", "reason": "Onboarding", "quantity": 12, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.226
cmwn5n9g900a77ds3mqne5lq7	2026-11-19 06:14:10.33	2026-11-19 06:14:10.33	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:BAT-H6-AGM:845de0509050544d	b3922e976066334058f23a076cae553e1ce79f3362a98158f0a1bdcb7b9531ad	PartsInventory	rooftop-default-main:BAT-H6-AGM	configured	null	{"supplier": "Interstate Batteries", "costCents": 13500, "rooftopId": "rooftop-default-main", "partNumber": "BAT-H6-AGM", "priceCents": 22999, "binLocation": "D1-01", "description": "H6 AGM 12V battery", "minimumQuantity": 4}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.329
cmwn5n9gk00ab7ds3k0a4qyth	2026-11-19 06:14:10.341	2026-11-19 06:14:10.341	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:BAT-H6-AGM	c31dfbde96d4625ba55e87a03912841aa4f3cdfb28e091904b9f0e92afb395b4	PartsMovement	cmwn5n9gb00a97ds33qkhodic	receipt	null	{"partId": "cmwn5n9gb00a97ds33qkhodic", "reason": "Onboarding", "quantity": 8, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.34
cmwn5n8z7005t7ds31xd9on2i	2026-11-19 06:14:09.715	2026-11-19 06:14:09.715	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BDNEP5LHYDGAKG0B	47330c11b9ed0e849db0daa04350b78e9f9bceb734b2485ea2a4554ef1afe600	InventoryStock	cmwn5n8yu005h7ds33gqlf2tj	vehicle-intake	null	{"vin": "9BDNEP5LHYDGAKG0B", "make": "Volkswagen", "mode": "onboarding-ready", "year": 2026, "model": "Amarok", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 7290000000, "description": "Volkswagen Amarok Highline V6 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-203", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 7290000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 6561000000}	{"stockId": "cmwn5n8yu005h7ds33gqlf2tj", "feedRunId": "cmwn5n8z5005r7ds3uvi6xkfi", "vehicleId": "cmwn5n8yp005b7ds3yri6d7y2", "imageCreated": true, "acquisitionId": "cmwn5n8yt005f7ds3ks3583m3", "reconWorkItemId": "cmwn5n8yz005n7ds3eqmfpo26", "merchandisingVersionId": "cmwn5n8z2005p7ds3mtzz9rhx"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.714
cmwn5n94c008l7ds3gz6y04iu	2026-11-19 06:14:09.9	2026-11-19 06:14:09.9	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9B7M4YF262FLLJBK6	43898d4131351878f7f34d9ef05c0c9fe244c3ad9d64b9089ed517626e729a45	InventoryStock	cmwn5n94000897ds38u015603	vehicle-intake	null	{"vin": "9B7M4YF262FLLJBK6", "make": "Citroën", "mode": "onboarding-ready", "year": 2026, "model": "C3", "reason": "Onboarding", "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "condition": "new", "imagePath": "/images/vehicles/foto-proximamente.jpg", "legacyVin": null, "rooftopId": "rooftop-default-main", "priceCents": 2390000000, "description": "Citroën C3 Feel Pack 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-208", "locationCode": "SALON", "locationLabel": "Salón", "listPriceCents": 2390000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor", "purchasePriceCents": 2151000000}	{"stockId": "cmwn5n94000897ds38u015603", "feedRunId": "cmwn5n94a008j7ds3mpjhyy4h", "vehicleId": "cmwn5n93w00837ds338sllg5v", "imageCreated": true, "acquisitionId": "cmwn5n93z00877ds34ybx8gbe", "reconWorkItemId": "cmwn5n945008f7ds3qsv9b5zl", "merchandisingVersionId": "cmwn5n948008h7ds37kx80u6t"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.899
cmwn5n9c0009b7ds37raiu66r	2026-11-19 06:14:10.176	2026-11-19 06:14:10.176	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:0W20-SYN-5QT:b3f279dae2786a9d	a1002be732536ee74e0f6c7f864b887d166c8a2c6543776dc70060b184864353	PartsInventory	rooftop-default-main:0W20-SYN-5QT	configured	null	{"supplier": "Valvoline", "costCents": 2150, "rooftopId": "rooftop-default-main", "partNumber": "0W20-SYN-5QT", "priceCents": 3899, "binLocation": "A2-01", "description": "Full synthetic 0W-20 motor oil, 5 qt", "minimumQuantity": 24}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.175
cmwn5n9cf009f7ds3ixokrjq8	2026-11-19 06:14:10.191	2026-11-19 06:14:10.191	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:0W20-SYN-5QT	3086599231d0d82f2dd95b6a2a90fef7fd4885da0a7925a54371b8feb0e22939	PartsMovement	cmwn5n9c2009d7ds3abcjgyys	receipt	null	{"partId": "cmwn5n9c2009d7ds3abcjgyys", "reason": "Onboarding", "quantity": 60, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.19
cmwn5n9e7009r7ds37pejiczj	2026-11-19 06:14:10.256	2026-11-19 06:14:10.256	rooftop-default-main	part-config:onboarding:rooftop-default-main:part:CAF-87139-YZZ08:fbe753146ad4adce	6b16a2c1257d585997099e2b97ac1cb0965793c04544592db0c8c88f976c59e5	PartsInventory	rooftop-default-main:CAF-87139-YZZ08	configured	null	{"supplier": "Toyota Parts Center", "costCents": 920, "rooftopId": "rooftop-default-main", "partNumber": "CAF-87139-YZZ08", "priceCents": 2499, "binLocation": "C1-03", "description": "Cabin air filter", "minimumQuantity": 10}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.255
cmwn5n9ej009v7ds36lab0gqk	2026-11-19 06:14:10.267	2026-11-19 06:14:10.267	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:CAF-87139-YZZ08	95eb4fc8eb6301901725a7ecbc85cfbed905aafe674157638a9b96413f63a015	PartsMovement	cmwn5n9e9009t7ds3pn2qndxm	receipt	null	{"partId": "cmwn5n9e9009t7ds3pn2qndxm", "reason": "Onboarding", "quantity": 24, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.266
cmwn5n9i900an7ds3prd2uebz	2026-11-19 06:14:10.401	2026-11-19 06:14:10.401	rooftop-default-main	finance-product:onboarding:rooftop-default-main:finance-product:VSC-60-75:ff9cc64abbd3da20	753929f78610ac6061459e6236d17ae7ba36167b14f1913700bb71dcb64a6a3d	FinanceProduct	rooftop-default-main:VSC-60-75	configured	null	{"code": "VSC-60-75", "name": "Vehicle Service Contract, 60 months / 75,000 miles", "active": true, "category": "service-contract", "costCents": 120000, "rooftopId": "rooftop-default-main", "providerKey": "operator-recorded", "retailPriceCents": 249500}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.4
cmwn5n9jm00av7ds3p9rth944	2026-11-19 06:14:10.451	2026-11-19 06:14:10.451	rooftop-default-main	finance-product:onboarding:rooftop-default-main:finance-product:PPM-3YR:5e39428cb487d418	b73a54eb1c3b492a83f0c25a9289f253a087d277de79dd76d3baa88af8b37c94	FinanceProduct	rooftop-default-main:PPM-3YR	configured	null	{"code": "PPM-3YR", "name": "Prepaid maintenance, 3 years", "active": true, "category": "maintenance", "costCents": 38000, "rooftopId": "rooftop-default-main", "providerKey": "operator-recorded", "retailPriceCents": 69500}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.45
cmwn5n9kv00b37ds3ivhnamz9	2026-11-19 06:14:10.495	2026-11-19 06:14:10.495	rooftop-default-main	finance-product:onboarding:rooftop-default-main:finance-product:APPEAR-5:943092931bc067eb	4d65ccf7c0749d9fe82bfa479a5d1abcf76ee729312e34f3eedc6e196c535abf	FinanceProduct	rooftop-default-main:APPEAR-5	configured	null	{"code": "APPEAR-5", "name": "Paint, fabric & leather protection, 5 years", "active": true, "category": "appearance", "costCents": 18000, "rooftopId": "rooftop-default-main", "providerKey": "operator-recorded", "retailPriceCents": 59900}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.495
cmwn5n9lm00b77ds3c87858ev	2026-11-19 06:14:10.522	2026-11-19 06:14:10.522	rooftop-default-main	lead-route-rule:onboarding:rooftop-default-main:lead-route:website:aef85999f5372c80	e1c52927789863ac2337c771cb1390ffb7a393daaa98a61e226e808e252cbe90	LeadRoutingRule	7d48fcdc-f650-435e-9192-aa535b851d58	configured	null	{"active": true, "ruleId": "7d48fcdc-f650-435e-9192-aa535b851d58", "source": "website", "priority": 10, "routeKey": "rooftop-default-main:website:website-leads", "assigneeId": "cmwn5mdux00017ds3g2ngshoz", "firstResponseMinutes": 15}	{"ruleId": "7d48fcdc-f650-435e-9192-aa535b851d58"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.522
cmwn5n9hi00aj7ds37lddikgn	2026-11-19 06:14:10.374	2026-11-19 06:14:10.374	rooftop-default-main	parts-movement:onboarding:rooftop-default-main:part-opening-stock:WB-22-HYB	bc2cd6381c7d428707b6e27d5959819def292e1fd7055f8852da9632470a70de	PartsMovement	cmwn5n9h800ah7ds32kgd7d3q	receipt	null	{"partId": "cmwn5n9h800ah7ds32kgd7d3q", "reason": "Onboarding", "quantity": 30, "reference": "Opening stock", "movementType": "receipt", "quantityDelta": null, "serviceOrderId": null}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.374
cmwn5n9ix00ar7ds3dfvikadg	2026-11-19 06:14:10.425	2026-11-19 06:14:10.425	rooftop-default-main	finance-product:onboarding:rooftop-default-main:finance-product:GAP-PLUS:47f8d0ea7bd8934f	9c5aef602dfc17a35d8c66a00f99d014396a114f271d00a38e5b2edff155b55a	FinanceProduct	rooftop-default-main:GAP-PLUS	configured	null	{"code": "GAP-PLUS", "name": "GAP protection", "active": true, "category": "gap", "costCents": 32500, "rooftopId": "rooftop-default-main", "providerKey": "operator-recorded", "retailPriceCents": 89500}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.425
cmwn5n9k800az7ds3960jdxoi	2026-11-19 06:14:10.472	2026-11-19 06:14:10.472	rooftop-default-main	finance-product:onboarding:rooftop-default-main:finance-product:TW-60:fb9ee0bd0f8ebbec	4dfddb7686e5914d4966cc6c5bfd97c3237a197550824d7ccdbe542deac4f368	FinanceProduct	rooftop-default-main:TW-60	configured	null	{"code": "TW-60", "name": "Tire & wheel protection, 60 months", "active": true, "category": "tire-wheel", "costCents": 30000, "rooftopId": "rooftop-default-main", "providerKey": "operator-recorded", "retailPriceCents": 79900}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.472
cmwn5n9m800b97ds3h3v86p0l	2026-11-19 06:14:10.544	2026-11-19 06:14:10.544	rooftop-default-main	lead-route-rule:onboarding:rooftop-default-main:lead-route:phone:d571ffa618b1fe97	d8239acf201619b797d6c346184c924f8d6cc08a82ea7b68910730e6009944a1	LeadRoutingRule	5835b408-9a65-4118-bd0b-5a372a223502	configured	null	{"active": true, "ruleId": "5835b408-9a65-4118-bd0b-5a372a223502", "source": "phone", "priority": 20, "routeKey": "rooftop-default-main:phone:phone-leads", "assigneeId": "cmwn5mdux00017ds3g2ngshoz", "firstResponseMinutes": 10}	{"ruleId": "5835b408-9a65-4118-bd0b-5a372a223502"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.544
cmwn5n9ne00bd7ds35968mks9	2026-11-19 06:14:10.586	2026-11-19 06:14:10.586	rooftop-default-main	lead-route-rule:onboarding:rooftop-default-main:lead-route:third-party:7872a439429ce347	74bfd3ba9d7cd61bed30b272318e1bb5fe3d4bca347ed53213cd676650242d48	LeadRoutingRule	ae3c06ab-3faf-456a-b2a6-42a699a05d65	configured	null	{"active": true, "ruleId": "ae3c06ab-3faf-456a-b2a6-42a699a05d65", "source": "third-party", "priority": 40, "routeKey": "rooftop-default-main:third-party:third-party-leads", "assigneeId": "cmwn5mdux00017ds3g2ngshoz", "firstResponseMinutes": 30}	{"ruleId": "ae3c06ab-3faf-456a-b2a6-42a699a05d65"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.585
cmwn5n9mu00bb7ds3hfu73dml	2026-11-19 06:14:10.566	2026-11-19 06:14:10.566	rooftop-default-main	lead-route-rule:onboarding:rooftop-default-main:lead-route:walk-in:390437c4b2901075	56df3406848b52ba93e60fdd8e5d0d5a768960458d277e157564c0e7788eb5df	LeadRoutingRule	a03ea0bb-b998-4712-a9bd-3b0491ad23fd	configured	null	{"active": true, "ruleId": "a03ea0bb-b998-4712-a9bd-3b0491ad23fd", "source": "walk-in", "priority": 30, "routeKey": "rooftop-default-main:walk-in:walk-in-traffic", "assigneeId": "cmwn5mdux00017ds3g2ngshoz", "firstResponseMinutes": 5}	{"ruleId": "a03ea0bb-b998-4712-a9bd-3b0491ad23fd"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.566
cmwn5n9of00bf7ds3rx3csc9n	2026-11-19 06:14:10.624	2026-11-19 06:14:10.624	rooftop-default-main	lead-route-rule:onboarding:rooftop-default-main:lead-route:referral:984938902dad4634	8091662af83e3444d0989abb22d13bb8356580317e7ad8eb1974c7f8209b8f14	LeadRoutingRule	52d57335-18df-49f6-bf77-7b18a7b9f0ce	configured	null	{"active": true, "ruleId": "52d57335-18df-49f6-bf77-7b18a7b9f0ce", "source": "referral", "priority": 50, "routeKey": "rooftop-default-main:referral:referrals", "assigneeId": "cmwn5mdux00017ds3g2ngshoz", "firstResponseMinutes": 60}	{"ruleId": "52d57335-18df-49f6-bf77-7b18a7b9f0ce"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.623
cmwn5n9pw00bh7ds34bccfw18	2026-11-19 06:14:10.676	2026-11-19 06:14:10.676	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:deal-vehicle-sale:a7d4631e482b98f8	6ed476870f6dd18e9ed2e070142a668f41b207e71948965dc37e55cce01073cf	AccountingMapping	rooftop-default-main:deal:vehicle-sale	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "vehicle-sale", "sourceType": "deal", "providerKey": "operator-recorded", "debitAccount": "1100 Contracts in Transit", "creditAccount": "4000 Vehicle Sales"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.675
cmwn5n9qo00bl7ds37spzvul8	2026-11-19 06:14:10.705	2026-11-19 06:14:10.705	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:deal-sales-tax:e753cb9000648c44	681fd04d8120f1801fa3ead84d47374a50fe3fe73af69c068a008fa0fbd95a78	AccountingMapping	rooftop-default-main:deal:sales-tax	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "sales-tax", "sourceType": "deal", "providerKey": "operator-recorded", "debitAccount": "1100 Contracts in Transit", "creditAccount": "2310 Sales Tax Payable"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.704
cmwn5n9s600bt7ds33qnd3mtk	2026-11-19 06:14:10.759	2026-11-19 06:14:10.759	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:deal-finance-products:2993653aa2037830	e9bda81626da1ef79c388ff81eb3ee8ff6069c9ec994c28972b9a896e37c0f1c	AccountingMapping	rooftop-default-main:deal:finance-products	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "finance-products", "sourceType": "deal", "providerKey": "operator-recorded", "debitAccount": "1100 Contracts in Transit", "creditAccount": "4800 F&I Product Income"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.758
cmwn5n9t000bx7ds3ur2f6j5c	2026-11-19 06:14:10.788	2026-11-19 06:14:10.788	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:deal-rebates:012c6a799400c07c	bce18256a86cae7bfae4fc450c4b6244bafb9952991515170b317aa810f10212	AccountingMapping	rooftop-default-main:deal:rebates	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "rebates", "sourceType": "deal", "providerKey": "operator-recorded", "debitAccount": "1250 Factory Receivables", "creditAccount": "1100 Contracts in Transit"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.787
cmwn5n9to00c17ds3cn5hiquc	2026-11-19 06:14:10.813	2026-11-19 06:14:10.813	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:deal-trade-in:75c61837380505ad	7810233bf75aa1399e5367c4f3f42cb8a3e77633dbb039c99c090fb7fb8b5add	AccountingMapping	rooftop-default-main:deal:trade-in	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "trade-in", "sourceType": "deal", "providerKey": "operator-recorded", "debitAccount": "2400 Used Vehicle Inventory", "creditAccount": "1100 Contracts in Transit"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.812
cmwn5n9ud00c57ds3e7bxvb5e	2026-11-19 06:14:10.838	2026-11-19 06:14:10.838	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:service-labor:6631b475dc15676a	8c9dd2098e9adc185d8439203e06c81f01e77ccbd33e6a020c70a39b96104e4c	AccountingMapping	rooftop-default-main:service:labor	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "labor", "sourceType": "service", "providerKey": "operator-recorded", "debitAccount": "1200 Service Receivables", "creditAccount": "4600 Customer Labor Sales"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.837
cmwn5n9v200c97ds3g99i398c	2026-11-19 06:14:10.862	2026-11-19 06:14:10.862	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:service-parts:778564930e5481f4	2dc24d525bb1d3dab1cf5bf63052de9419f982cd384a0afdfa3f9dbc9918f755	AccountingMapping	rooftop-default-main:service:parts	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "parts", "sourceType": "service", "providerKey": "operator-recorded", "debitAccount": "1200 Service Receivables", "creditAccount": "4700 Parts Sales"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.862
cmwn5n9vr00cd7ds3exwp0m8q	2026-11-19 06:14:10.887	2026-11-19 06:14:10.887	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:service-sales-tax:f2cb3d22c0aa20e1	5049ee6e9b135b219d3b2ada52504a695f4c4e491e0bbd723fa3fe7d80c98e33	AccountingMapping	rooftop-default-main:service:sales-tax	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "sales-tax", "sourceType": "service", "providerKey": "operator-recorded", "debitAccount": "1200 Service Receivables", "creditAccount": "2310 Sales Tax Payable"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.886
cmwn5n9wc00ch7ds30x1ogkbf	2026-11-19 06:14:10.909	2026-11-19 06:14:10.909	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:parts-inventory-receipt:88c59e86509d576c	bd7c97b091c20e871c35adc4534b8d288b14f97459b514dbf032bdff02b44014	AccountingMapping	rooftop-default-main:parts:inventory-receipt	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "inventory-receipt", "sourceType": "parts", "providerKey": "operator-recorded", "debitAccount": "1400 Parts Inventory", "creditAccount": "2000 Accounts Payable"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.908
cmwn5n9x000cl7ds3kih4v7as	2026-11-19 06:14:10.933	2026-11-19 06:14:10.933	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:payment-payment-capture:782aa211d457e87e	74575c3e4998f3552c6c860126696b0ca400d9f84042173bd78ec32f03e5a72f	AccountingMapping	rooftop-default-main:payment:payment-capture	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "payment-capture", "sourceType": "payment", "providerKey": "operator-recorded", "debitAccount": "1010 Cash in Bank", "creditAccount": "1200 Service Receivables"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.932
cmwn5n9rh00bp7ds3r1qf13v9	2026-11-19 06:14:10.733	2026-11-19 06:14:10.733	rooftop-default-main	accounting-mapping:onboarding:rooftop-default-main:accounting:deal-fees:941c01139120ca89	61e81aec00a51b877bc7873789cf77758e0c551b81e0b75384d6261c650f738b	AccountingMapping	rooftop-default-main:deal:fees	configured	null	{"rooftopId": "rooftop-default-main", "sourceCode": "fees", "sourceType": "deal", "providerKey": "operator-recorded", "debitAccount": "1100 Contracts in Transit", "creditAccount": "4900 Documentation Fees"}	{}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:10.732
\.


--
-- Data for Name: FinanceComplianceCheck; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinanceComplianceCheck" (id, "createdAt", "updatedAt", rooftop, deal, "checkType", "providerKey", status, "resultCode", "requestSnapshot", "resultSnapshot", "requestedAt", "completedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: FinanceContractPackage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinanceContractPackage" (id, "createdAt", "updatedAt", rooftop, deal, status, "providerKey", "envelopeReference", "requiredDocuments", "documentChecklist", "immutableStatusEvidence", "sentAt", "signedAt", "lastWebhookAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: FinanceFundingCase; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinanceFundingCase" (id, "createdAt", "updatedAt", rooftop, deal, status, checklist, exceptions, "fundingReference", "fundedAt", "immutableEvidence", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: FinanceMenuVersion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinanceMenuVersion" (id, "createdAt", "updatedAt", rooftop, deal, version, status, "optionsSnapshot", "selectedProductCodes", "declinedProductCodes", "disclosureAcknowledgment", "presentedAt", "decidedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: FinanceProduct; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinanceProduct" (id, "createdAt", "updatedAt", rooftop, code, name, category, "providerKey", active, "retailPriceCents", "costCents") FROM stdin;
cmwn5n9ib00ap7ds3xau3vd7z	2026-11-19 06:14:10.403	2026-11-19 06:14:10.403	rooftop-default-main	VSC-60-75	Vehicle Service Contract, 60 months / 75,000 miles	service-contract	operator-recorded	t	249500	120000
cmwn5n9iz00at7ds30fvj3wsn	2026-11-19 06:14:10.427	2026-11-19 06:14:10.427	rooftop-default-main	GAP-PLUS	GAP protection	gap	operator-recorded	t	89500	32500
cmwn5n9jo00ax7ds3vkdwh0er	2026-11-19 06:14:10.452	2026-11-19 06:14:10.452	rooftop-default-main	PPM-3YR	Prepaid maintenance, 3 years	maintenance	operator-recorded	t	69500	38000
cmwn5n9k900b17ds3zvz88h3c	2026-11-19 06:14:10.474	2026-11-19 06:14:10.474	rooftop-default-main	TW-60	Tire & wheel protection, 60 months	tire-wheel	operator-recorded	t	79900	30000
cmwn5n9kw00b57ds3dr1lguiz	2026-11-19 06:14:10.497	2026-11-19 06:14:10.497	rooftop-default-main	APPEAR-5	Paint, fabric & leather protection, 5 years	appearance	operator-recorded	t	59900	18000
\.


--
-- Data for Name: FinanceProductCancellation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinanceProductCancellation" (id, "createdAt", "updatedAt", rooftop, deal, menu, "productCode", status, reason, "refundCents", evidence, "requestedAt", "completedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: FinanceProductQuote; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinanceProductQuote" (id, "createdAt", "updatedAt", rooftop, deal, product, "providerKey", status, "retailPriceCents", "costCents", "evidenceReference", "requestSnapshot", "resultSnapshot", "requestedAt", "completedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: FinancingApplication; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinancingApplication" (id, "createdAt", "updatedAt", reference, "idempotencyKey", status, lead, vehicle, "applicantName", "applicantEmail", "applicantPhone", "employmentStatus", "annualIncomeCents", "selfReportedCreditTier", "requestedAmountCents", "plannedMonthlyPaymentCents", "plannedDownPaymentCents", "tradeInValueCents", "aprBasisPoints", "loanTermMonths", "consentAt", "submittedAt", "lockedAt", "immutableSnapshot", rooftop) FROM stdin;
\.


--
-- Data for Name: FinancingPlan; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FinancingPlan" (id, "createdAt", "updatedAt", bank, name, active, "tnaBps", "teaBps", "cftBps", "termsMonths", "minAmountCents", "maxAmountCents", "maxFinancedBps", amortization, "validFrom", "validUntil", "extraCosts", requirements, "sortOrder") FROM stdin;
plan_ejemplo	2026-11-19 06:16:08.406	2026-11-19 06:16:08.406	bank_ejemplo	Plan de ejemplo (tasas ilustrativas)	t	6000	\N	\N	12, 24, 36, 48	\N	\N	10000	frances	\N	\N	Valores ilustrativos para la demostración: reemplazar por los planes reales del banco.	DNI y recibo de sueldo o constancia de ingresos.	0
\.


--
-- Data for Name: InventoryAcquisition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryAcquisition" (id, "createdAt", "updatedAt", rooftop, reference, "idempotencyKey", status, "acquisitionSource", "sourceReference", vin, year, make, model, odometer, "appraisalCents", "purchaseCents", "reconEstimateCents", vehicle, "immutablePurchaseSnapshot", "purchasedAt", "arrivedAt", "frontlineAt", "requestedBy", "lastTransitionedBy", stock) FROM stdin;
cmwn5n8n9000z7ds3rwzk0x8d	2026-11-19 06:14:09.285	2026-11-19 06:14:09.292	rooftop-default-main	ACQ-186F8B581A67B0FE16DD	inventory-intake:rooftop-default-main:onboarding:8AXK2DEG0D9PCF43E	frontline	trade-in	onboarding	8AXK2DEG0D9PCF43E	2021	BMW	530i	48200	4666500000	4666500000	0	cmwn5n8mu000v7ds3sa4npbgr	{"vin": "8AXK2DEG0D9PCF43E", "odometer": 48200, "stockNumber": "EA-101", "purchaseCents": 4666500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	2026-11-19 06:14:09.269	2026-11-19 06:14:09.269	2026-11-19 06:14:09.269	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8nd00117ds3i6j9ibzl
cmwn5n8qm001j7ds3q00numaw	2026-11-19 06:14:09.407	2026-11-19 06:14:09.413	rooftop-default-main	ACQ-7F685A3279F3C35A80AB	inventory-intake:rooftop-default-main:onboarding:8A4DHRD2DRCJV3KHW	frontline	trade-in	onboarding	8A4DHRD2DRCJV3KHW	2020	Toyota	Camry	62400	3306500000	3306500000	0	cmwn5n8qc001f7ds30tli48hk	{"vin": "8A4DHRD2DRCJV3KHW", "odometer": 62400, "stockNumber": "EA-102", "purchaseCents": 3306500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	2026-11-19 06:14:09.396	2026-11-19 06:14:09.396	2026-11-19 06:14:09.396	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8qo001l7ds3l3wcix8b
cmwn5n8sc00237ds39wtppoi9	2026-11-19 06:14:09.469	2026-11-19 06:14:09.471	rooftop-default-main	ACQ-6DC530D30F2DC53C23CF	inventory-intake:rooftop-default-main:onboarding:8AN0GEDP84X660WSM	frontline	trade-in	onboarding	8AN0GEDP84X660WSM	2022	Honda	CR-V	35100	3952500000	3952500000	0	cmwn5n8s9001z7ds332vylq2q	{"vin": "8AN0GEDP84X660WSM", "odometer": 35100, "stockNumber": "EA-103", "purchaseCents": 3952500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	2026-11-19 06:14:09.465	2026-11-19 06:14:09.465	2026-11-19 06:14:09.465	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8sd00257ds3f23er93i
cmwn5n8tk002n7ds3x2yfb60l	2026-11-19 06:14:09.512	2026-11-19 06:14:09.515	rooftop-default-main	ACQ-52C79874A1F6F0E8BFC3	inventory-intake:rooftop-default-main:onboarding:8AW8Y5VEH93LYK83C	frontline	trade-in	onboarding	8AW8Y5VEH93LYK83C	2019	Honda	Accord	71800	2541500000	2541500000	0	cmwn5n8tf002j7ds3g2w2c8uk	{"vin": "8AW8Y5VEH93LYK83C", "odometer": 71800, "stockNumber": "EA-104", "purchaseCents": 2541500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	2026-11-19 06:14:09.506	2026-11-19 06:14:09.506	2026-11-19 06:14:09.506	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8tm002p7ds334myjhbi
cmwn5n8us00377ds361plk9c8	2026-11-19 06:14:09.557	2026-11-19 06:14:09.559	rooftop-default-main	ACQ-B9D94DEBC0B4D71E47BE	inventory-intake:rooftop-default-main:onboarding:8AYZ86EFU7EDW5V1Z	frontline	trade-in	onboarding	8AYZ86EFU7EDW5V1Z	2018	Mercedes-Benz	C 300	83500	2847500000	2847500000	0	cmwn5n8un00337ds3e0hyldf6	{"vin": "8AYZ86EFU7EDW5V1Z", "odometer": 83500, "stockNumber": "EA-105", "purchaseCents": 2847500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	2026-11-19 06:14:09.55	2026-11-19 06:14:09.55	2026-11-19 06:14:09.55	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8uu00397ds3owwakuna
cmwn5n8vw003r7ds3r4mchv0s	2026-11-19 06:14:09.596	2026-11-19 06:14:09.598	rooftop-default-main	ACQ-712659F126FFEF625E7C	inventory-intake:rooftop-default-main:onboarding:8AZLH8DPVJS228FL5	frontline	trade-in	onboarding	8AZLH8DPVJS228FL5	2017	Ford	Mustang	59800	4496500000	4496500000	0	cmwn5n8vt003n7ds36ndp65mb	{"vin": "8AZLH8DPVJS228FL5", "odometer": 59800, "stockNumber": "EA-106", "purchaseCents": 4496500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	2026-11-19 06:14:09.592	2026-11-19 06:14:09.592	2026-11-19 06:14:09.592	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8vx003t7ds34ktzndka
cmwn5n8ws004b7ds3sdkh76hi	2026-11-19 06:14:09.628	2026-11-19 06:14:09.631	rooftop-default-main	ACQ-E174994E4D742BD65D4E	inventory-intake:rooftop-default-main:onboarding:9BJ4U3Z1RKFMKRRA8	frontline	oem-distributor	onboarding	9BJ4U3Z1RKFMKRRA8	2026	Peugeot	208	0	2475000000	2475000000	0	cmwn5n8wp00477ds3jfwp8wyn	{"vin": "9BJ4U3Z1RKFMKRRA8", "odometer": 0, "stockNumber": "EA-201", "purchaseCents": 2475000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.625	2026-11-19 06:14:09.625	2026-11-19 06:14:09.625	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8wt004d7ds38oi9yqzd
cmwn5n8xt004v7ds332p9ovbf	2026-11-19 06:14:09.666	2026-11-19 06:14:09.668	rooftop-default-main	ACQ-463EA590B8DD12A971BF	inventory-intake:rooftop-default-main:onboarding:9BVAK30XJ9D62222G	frontline	oem-distributor	onboarding	9BVAK30XJ9D62222G	2026	Fiat	Cronos	0	2241000000	2241000000	0	cmwn5n8xq004r7ds309fmvwwt	{"vin": "9BVAK30XJ9D62222G", "odometer": 0, "stockNumber": "EA-202", "purchaseCents": 2241000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.662	2026-11-19 06:14:09.662	2026-11-19 06:14:09.662	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8xu004x7ds3zdcfc0rd
cmwn5n8yt005f7ds3ks3583m3	2026-11-19 06:14:09.702	2026-11-19 06:14:09.704	rooftop-default-main	ACQ-E6B95D4DC2FE76B781BB	inventory-intake:rooftop-default-main:onboarding:9BDNEP5LHYDGAKG0B	frontline	oem-distributor	onboarding	9BDNEP5LHYDGAKG0B	2026	Volkswagen	Amarok	0	6561000000	6561000000	0	cmwn5n8yp005b7ds3yri6d7y2	{"vin": "9BDNEP5LHYDGAKG0B", "odometer": 0, "stockNumber": "EA-203", "purchaseCents": 6561000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.697	2026-11-19 06:14:09.697	2026-11-19 06:14:09.697	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8yu005h7ds33gqlf2tj
cmwn5n8zt005z7ds3akiojzi7	2026-11-19 06:14:09.738	2026-11-19 06:14:09.74	rooftop-default-main	ACQ-FE3CB6160347B685D56D	inventory-intake:rooftop-default-main:onboarding:9B1KTZ07HH8677WFK	frontline	oem-distributor	onboarding	9B1KTZ07HH8677WFK	2026	Renault	Kardian	0	2682000000	2682000000	0	cmwn5n8zq005v7ds34ku8k4zf	{"vin": "9B1KTZ07HH8677WFK", "odometer": 0, "stockNumber": "EA-204", "purchaseCents": 2682000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.733	2026-11-19 06:14:09.733	2026-11-19 06:14:09.733	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n8zv00617ds3kk46hao5
cmwn5n90y006j7ds34yetpfoj	2026-11-19 06:14:09.779	2026-11-19 06:14:09.781	rooftop-default-main	ACQ-29736B6DF54AE6F68385	inventory-intake:rooftop-default-main:onboarding:9BT7LBP0KBWFT0LZR	frontline	oem-distributor	onboarding	9BT7LBP0KBWFT0LZR	2026	Toyota	Hilux	0	5805000000	5805000000	0	cmwn5n90v006f7ds3i3bn2uwz	{"vin": "9BT7LBP0KBWFT0LZR", "odometer": 0, "stockNumber": "EA-205", "purchaseCents": 5805000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.775	2026-11-19 06:14:09.775	2026-11-19 06:14:09.775	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n90z006l7ds3894zgucr
cmwn5n92100737ds367gav8xt	2026-11-19 06:14:09.817	2026-11-19 06:14:09.819	rooftop-default-main	ACQ-05065664AA08E86EB277	inventory-intake:rooftop-default-main:onboarding:9BRNS2RN8ZBBU7TNZ	frontline	oem-distributor	onboarding	9BRNS2RN8ZBBU7TNZ	2026	Chevrolet	Tracker	0	3051000000	3051000000	0	cmwn5n91y006z7ds3s100xzir	{"vin": "9BRNS2RN8ZBBU7TNZ", "odometer": 0, "stockNumber": "EA-206", "purchaseCents": 3051000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.813	2026-11-19 06:14:09.813	2026-11-19 06:14:09.813	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n92200757ds3dcgzo340
cmwn5n933007n7ds3g07junbn	2026-11-19 06:14:09.855	2026-11-19 06:14:09.857	rooftop-default-main	ACQ-3D67A54241BFA6A96D42	inventory-intake:rooftop-default-main:onboarding:9B0FRGR7NYP7A7ZFH	frontline	oem-distributor	onboarding	9B0FRGR7NYP7A7ZFH	2026	Chery	Tiggo 4	0	2583000000	2583000000	0	cmwn5n930007j7ds3kkjpr2nm	{"vin": "9B0FRGR7NYP7A7ZFH", "odometer": 0, "stockNumber": "EA-207", "purchaseCents": 2583000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.851	2026-11-19 06:14:09.851	2026-11-19 06:14:09.851	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n934007p7ds3chn23tv3
cmwn5n93z00877ds34ybx8gbe	2026-11-19 06:14:09.888	2026-11-19 06:14:09.89	rooftop-default-main	ACQ-6714662C041BA618C1A0	inventory-intake:rooftop-default-main:onboarding:9B7M4YF262FLLJBK6	frontline	oem-distributor	onboarding	9B7M4YF262FLLJBK6	2026	Citroën	C3	0	2151000000	2151000000	0	cmwn5n93w00837ds338sllg5v	{"vin": "9B7M4YF262FLLJBK6", "odometer": 0, "stockNumber": "EA-208", "purchaseCents": 2151000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	2026-11-19 06:14:09.884	2026-11-19 06:14:09.884	2026-11-19 06:14:09.884	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n94000897ds38u015603
\.


--
-- Data for Name: InventoryAcquisitionEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryAcquisitionEvent" (id, "createdAt", "updatedAt", rooftop, acquisition, "fromStatus", "toStatus", reason, evidence, actor, "occurredAt") FROM stdin;
cmwn5n8ni00137ds3n9qon61k	2026-11-19 06:14:09.295	2026-11-19 06:14:09.295	rooftop-default-main	cmwn5n8n9000z7ds3rwzk0x8d		frontline	Onboarding	{"vin": "8AXK2DEG0D9PCF43E", "odometer": 48200, "stockNumber": "EA-101", "purchaseCents": 4666500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.269
cmwn5n8qw001n7ds3vi6uw8sz	2026-11-19 06:14:09.416	2026-11-19 06:14:09.416	rooftop-default-main	cmwn5n8qm001j7ds3q00numaw		frontline	Onboarding	{"vin": "8A4DHRD2DRCJV3KHW", "odometer": 62400, "stockNumber": "EA-102", "purchaseCents": 3306500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.396
cmwn5n8sh00277ds3mbj1psfb	2026-11-19 06:14:09.473	2026-11-19 06:14:09.473	rooftop-default-main	cmwn5n8sc00237ds39wtppoi9		frontline	Onboarding	{"vin": "8AN0GEDP84X660WSM", "odometer": 35100, "stockNumber": "EA-103", "purchaseCents": 3952500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.465
cmwn5n8tp002r7ds31owk5a8c	2026-11-19 06:14:09.517	2026-11-19 06:14:09.517	rooftop-default-main	cmwn5n8tk002n7ds3x2yfb60l		frontline	Onboarding	{"vin": "8AW8Y5VEH93LYK83C", "odometer": 71800, "stockNumber": "EA-104", "purchaseCents": 2541500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.506
cmwn5n8ux003b7ds3sik68k4u	2026-11-19 06:14:09.561	2026-11-19 06:14:09.561	rooftop-default-main	cmwn5n8us00377ds361plk9c8		frontline	Onboarding	{"vin": "8AYZ86EFU7EDW5V1Z", "odometer": 83500, "stockNumber": "EA-105", "purchaseCents": 2847500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.55
cmwn5n8vz003v7ds3k7vxaeva	2026-11-19 06:14:09.599	2026-11-19 06:14:09.599	rooftop-default-main	cmwn5n8vw003r7ds3r4mchv0s		frontline	Onboarding	{"vin": "8AZLH8DPVJS228FL5", "odometer": 59800, "stockNumber": "EA-106", "purchaseCents": 4496500000, "sourceReference": "onboarding", "acquisitionSource": "trade-in"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.592
cmwn5n8ww004f7ds33e0qyolm	2026-11-19 06:14:09.632	2026-11-19 06:14:09.632	rooftop-default-main	cmwn5n8ws004b7ds3sdkh76hi		frontline	Onboarding	{"vin": "9BJ4U3Z1RKFMKRRA8", "odometer": 0, "stockNumber": "EA-201", "purchaseCents": 2475000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.625
cmwn5n8xx004z7ds3m97xbga1	2026-11-19 06:14:09.669	2026-11-19 06:14:09.669	rooftop-default-main	cmwn5n8xt004v7ds332p9ovbf		frontline	Onboarding	{"vin": "9BVAK30XJ9D62222G", "odometer": 0, "stockNumber": "EA-202", "purchaseCents": 2241000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.662
cmwn5n8yx005j7ds3si0sisf9	2026-11-19 06:14:09.705	2026-11-19 06:14:09.705	rooftop-default-main	cmwn5n8yt005f7ds3ks3583m3		frontline	Onboarding	{"vin": "9BDNEP5LHYDGAKG0B", "odometer": 0, "stockNumber": "EA-203", "purchaseCents": 6561000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.697
cmwn5n8zx00637ds3fix6zrd0	2026-11-19 06:14:09.742	2026-11-19 06:14:09.742	rooftop-default-main	cmwn5n8zt005z7ds3akiojzi7		frontline	Onboarding	{"vin": "9B1KTZ07HH8677WFK", "odometer": 0, "stockNumber": "EA-204", "purchaseCents": 2682000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.733
cmwn5n912006n7ds3k5a5mudr	2026-11-19 06:14:09.782	2026-11-19 06:14:09.782	rooftop-default-main	cmwn5n90y006j7ds34yetpfoj		frontline	Onboarding	{"vin": "9BT7LBP0KBWFT0LZR", "odometer": 0, "stockNumber": "EA-205", "purchaseCents": 5805000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.775
cmwn5n92400777ds35m5jsfm0	2026-11-19 06:14:09.821	2026-11-19 06:14:09.821	rooftop-default-main	cmwn5n92100737ds367gav8xt		frontline	Onboarding	{"vin": "9BRNS2RN8ZBBU7TNZ", "odometer": 0, "stockNumber": "EA-206", "purchaseCents": 3051000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.813
cmwn5n936007r7ds30n5nep9c	2026-11-19 06:14:09.859	2026-11-19 06:14:09.859	rooftop-default-main	cmwn5n933007n7ds3g07junbn		frontline	Onboarding	{"vin": "9B0FRGR7NYP7A7ZFH", "odometer": 0, "stockNumber": "EA-207", "purchaseCents": 2583000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.851
cmwn5n943008b7ds3vq3ajpie	2026-11-19 06:14:09.891	2026-11-19 06:14:09.891	rooftop-default-main	cmwn5n93z00877ds34ybx8gbe		frontline	Onboarding	{"vin": "9B7M4YF262FLLJBK6", "odometer": 0, "stockNumber": "EA-208", "purchaseCents": 2151000000, "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.884
\.


--
-- Data for Name: InventoryFeedError; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryFeedError" (id, "createdAt", "updatedAt", rooftop, run, stock, "errorCode", message, "rowReference", evidence) FROM stdin;
\.


--
-- Data for Name: InventoryFeedRun; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryFeedRun" (id, "createdAt", "updatedAt", rooftop, "runKey", "channelKey", status, "attemptedCount", "succeededCount", "failedCount", "requestSnapshot", "responseSummary", "startedAt", "completedAt", "recordedBy") FROM stdin;
cmwn5n8o9001b7ds3zsptt4pc	2026-11-19 06:14:09.322	2026-11-19 06:14:09.322	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AXK2DEG0D9PCF43E:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8nd00117ds3i6j9ibzl"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.269	2026-11-19 06:14:09.269	cmwn5mdux00017ds3g2ngshoz
cmwn5n8rc001v7ds37dh50wu8	2026-11-19 06:14:09.432	2026-11-19 06:14:09.432	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8A4DHRD2DRCJV3KHW:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8qo001l7ds3l3wcix8b"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.396	2026-11-19 06:14:09.396	cmwn5mdux00017ds3g2ngshoz
cmwn5n8sp002f7ds3b61xrtm2	2026-11-19 06:14:09.482	2026-11-19 06:14:09.482	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AN0GEDP84X660WSM:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8sd00257ds3f23er93i"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.465	2026-11-19 06:14:09.465	cmwn5mdux00017ds3g2ngshoz
cmwn5n8ty002z7ds3o7v5gzpn	2026-11-19 06:14:09.527	2026-11-19 06:14:09.527	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AW8Y5VEH93LYK83C:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8tm002p7ds334myjhbi"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.506	2026-11-19 06:14:09.506	cmwn5mdux00017ds3g2ngshoz
cmwn5n8v6003j7ds357l7b56j	2026-11-19 06:14:09.57	2026-11-19 06:14:09.57	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AYZ86EFU7EDW5V1Z:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8uu00397ds3owwakuna"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.55	2026-11-19 06:14:09.55	cmwn5mdux00017ds3g2ngshoz
cmwn5n8w500437ds34g9fh8ge	2026-11-19 06:14:09.606	2026-11-19 06:14:09.606	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:8AZLH8DPVJS228FL5:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8vx003t7ds34ktzndka"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.592	2026-11-19 06:14:09.592	cmwn5mdux00017ds3g2ngshoz
cmwn5n8x2004n7ds30n5dp9ic	2026-11-19 06:14:09.639	2026-11-19 06:14:09.639	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BJ4U3Z1RKFMKRRA8:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8wt004d7ds38oi9yqzd"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.625	2026-11-19 06:14:09.625	cmwn5mdux00017ds3g2ngshoz
cmwn5n8y400577ds35i8ndzjw	2026-11-19 06:14:09.677	2026-11-19 06:14:09.677	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BVAK30XJ9D62222G:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8xu004x7ds3zdcfc0rd"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.662	2026-11-19 06:14:09.662	cmwn5mdux00017ds3g2ngshoz
cmwn5n8z5005r7ds3uvi6xkfi	2026-11-19 06:14:09.713	2026-11-19 06:14:09.713	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BDNEP5LHYDGAKG0B:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8yu005h7ds33gqlf2tj"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.697	2026-11-19 06:14:09.697	cmwn5mdux00017ds3g2ngshoz
cmwn5n907006b7ds39hxblvei	2026-11-19 06:14:09.751	2026-11-19 06:14:09.751	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9B1KTZ07HH8677WFK:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n8zv00617ds3kk46hao5"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.733	2026-11-19 06:14:09.733	cmwn5mdux00017ds3g2ngshoz
cmwn5n91a006v7ds3b94wdbfd	2026-11-19 06:14:09.79	2026-11-19 06:14:09.79	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BT7LBP0KBWFT0LZR:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n90z006l7ds3894zgucr"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.775	2026-11-19 06:14:09.775	cmwn5mdux00017ds3g2ngshoz
cmwn5n92b007f7ds3yv1wh4db	2026-11-19 06:14:09.828	2026-11-19 06:14:09.828	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9BRNS2RN8ZBBU7TNZ:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n92200757ds3dcgzo340"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.813	2026-11-19 06:14:09.813	cmwn5mdux00017ds3g2ngshoz
cmwn5n93d007z7ds3n1thaoc7	2026-11-19 06:14:09.865	2026-11-19 06:14:09.865	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9B0FRGR7NYP7A7ZFH:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n934007p7ds3chn23tv3"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.851	2026-11-19 06:14:09.851	cmwn5mdux00017ds3g2ngshoz
cmwn5n94a008j7ds3mpjhyy4h	2026-11-19 06:14:09.898	2026-11-19 06:14:09.898	rooftop-default-main	inventory-intake:rooftop-default-main:onboarding:9B7M4YF262FLLJBK6:public-feed	public-inventory-feed	succeeded	1	1	0	{"stockIds": ["cmwn5n94000897ds38u015603"]}	{"mode": "onboarding-internal", "externalRequestSent": false}	2026-11-19 06:14:09.884	2026-11-19 06:14:09.884	cmwn5mdux00017ds3g2ngshoz
\.


--
-- Data for Name: InventoryMerchandisingVersion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryMerchandisingVersion" (id, "createdAt", "updatedAt", rooftop, stock, version, "versionKey", status, snapshot, "submittedBy", "submittedAt", "decidedBy", "decidedAt", "decisionReason") FROM stdin;
cmwn5n8o000197ds37ssx0ez7	2026-11-19 06:14:09.313	2026-11-19 06:14:09.313	rooftop-default-main	cmwn5n8nd00117ds3i6j9ibzl	1	cmwn5n8nd00117ds3i6j9ibzl:1	approved	{"vin": "8AXK2DEG0D9PCF43E", "make": "BMW", "trim": "M Sport", "year": 2021, "model": "530i", "title": "2021 BMW 530i M Sport", "engine": "2.0 Turbo", "images": [{"id": "cmwn5n8n2000x7ds3f9xbabuo", "caption": "2021 BMW 530i", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/smc-2401.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 48200, "features": ["Paquete M Sport", "Navegador", "Asientos calefaccionados", "Sensores de estacionamiento"], "fuelType": "nafta", "condition": "used", "vehicleId": "cmwn5n8mu000v7ds3sa4npbgr", "priceCents": 5490000000, "description": "Sedán premium con paquete M Sport, asistencias a la conducción e historial de service al día. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-101", "transmission": "automatica", "exteriorColor": "Negro", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 5490000000, "primaryImagePath": "/images/vehicles/smc-2401.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.269	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.269	Onboarding
cmwn5n8r8001t7ds3nl6wpkl8	2026-11-19 06:14:09.428	2026-11-19 06:14:09.428	rooftop-default-main	cmwn5n8qo001l7ds3l3wcix8b	1	cmwn5n8qo001l7ds3l3wcix8b:1	approved	{"vin": "8A4DHRD2DRCJV3KHW", "make": "Toyota", "trim": "XSE", "year": 2020, "model": "Camry", "title": "2020 Toyota Camry XSE", "engine": "2.5", "images": [{"id": "cmwn5n8ql001h7ds3kcgoct75", "caption": "2020 Toyota Camry", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/smc-2404.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 62400, "features": ["Audio JBL", "Cargador inalámbrico", "Monitor de punto ciego"], "fuelType": "nafta", "condition": "used", "vehicleId": "cmwn5n8qc001f7ds30tli48hk", "priceCents": 3890000000, "description": "Sedán mediano con suspensión deportiva, cargador inalámbrico y audio JBL. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-102", "transmission": "automatica", "exteriorColor": "Gris claro", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 3890000000, "primaryImagePath": "/images/vehicles/smc-2404.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.396	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.396	Onboarding
cmwn5n8sn002d7ds35twqtoxd	2026-11-19 06:14:09.479	2026-11-19 06:14:09.479	rooftop-default-main	cmwn5n8sd00257ds3f23er93i	1	cmwn5n8sd00257ds3f23er93i:1	approved	{"vin": "8AN0GEDP84X660WSM", "make": "Honda", "trim": "Touring", "year": 2022, "model": "CR-V", "title": "2022 Honda CR-V Touring", "engine": "2.0 Híbrido", "images": [{"id": "cmwn5n8sb00217ds33mcctt5t", "caption": "2022 Honda CR-V", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/smc-2405.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 35100, "features": ["Honda Sensing", "Techo solar", "Tracción integral"], "fuelType": "hibrido", "condition": "used", "vehicleId": "cmwn5n8s9001z7ds332vylq2q", "priceCents": 4650000000, "description": "SUV híbrida con tracción integral, techo solar y asistentes de manejo Honda Sensing. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-103", "transmission": "automatica", "exteriorColor": "Azul", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 4650000000, "primaryImagePath": "/images/vehicles/smc-2405.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.465	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.465	Onboarding
cmwn5n8tw002x7ds3oztektdq	2026-11-19 06:14:09.524	2026-11-19 06:14:09.524	rooftop-default-main	cmwn5n8tm002p7ds334myjhbi	1	cmwn5n8tm002p7ds334myjhbi:1	approved	{"vin": "8AW8Y5VEH93LYK83C", "make": "Honda", "trim": "Sport", "year": 2019, "model": "Accord", "title": "2019 Honda Accord Sport", "engine": "1.5 Turbo", "images": [{"id": "cmwn5n8ti002l7ds3tq4r53qb", "caption": "2019 Honda Accord", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/smc-2406.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 71800, "features": ["Cámara de retroceso", "Pantalla táctil", "Control crucero"], "fuelType": "nafta", "condition": "used", "vehicleId": "cmwn5n8tf002j7ds3g2w2c8uk", "priceCents": 2990000000, "description": "Sedán amplio y confiable, ideal para familia, con pantalla táctil y cámara de retroceso. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-104", "transmission": "automatica", "exteriorColor": "Blanco", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 2990000000, "primaryImagePath": "/images/vehicles/smc-2406.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.506	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.506	Onboarding
cmwn5n8v3003h7ds398sbw2s9	2026-11-19 06:14:09.568	2026-11-19 06:14:09.568	rooftop-default-main	cmwn5n8uu00397ds3owwakuna	1	cmwn5n8uu00397ds3owwakuna:1	approved	{"vin": "8AYZ86EFU7EDW5V1Z", "make": "Mercedes-Benz", "trim": "Avantgarde", "year": 2018, "model": "C 300", "title": "2018 Mercedes-Benz C 300 Avantgarde", "engine": "2.0 Turbo", "images": [{"id": "cmwn5n8up00357ds3qzxjy3mi", "caption": "2018 Mercedes-Benz C 300", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/smc-2409.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 83500, "features": ["Tapizado de cuero", "Climatizador bizona", "Llantas de aleación"], "fuelType": "nafta", "condition": "used", "vehicleId": "cmwn5n8un00337ds3e0hyldf6", "priceCents": 3350000000, "description": "Sedán de lujo con interior en cuero y equipamiento completo. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-105", "transmission": "automatica", "exteriorColor": "Gris", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 3350000000, "primaryImagePath": "/images/vehicles/smc-2409.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.55	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.55	Onboarding
cmwn5n8w300417ds3cmg3x2is	2026-11-19 06:14:09.604	2026-11-19 06:14:09.604	rooftop-default-main	cmwn5n8vx003t7ds34ktzndka	1	cmwn5n8vx003t7ds34ktzndka:1	approved	{"vin": "8AZLH8DPVJS228FL5", "make": "Ford", "trim": "GT", "year": 2017, "model": "Mustang", "title": "2017 Ford Mustang GT", "engine": "5.0 V8", "images": [{"id": "cmwn5n8vv003p7ds36ef6n5ne", "caption": "2017 Ford Mustang", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/smc-2412.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 59800, "features": ["Motor V8", "Escape deportivo", "Modo de manejo seleccionable"], "fuelType": "nafta", "condition": "used", "vehicleId": "cmwn5n8vt003n7ds36ndp65mb", "priceCents": 5290000000, "description": "Deportivo icónico con motor V8 y caja manual de 6 marchas. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-106", "transmission": "manual", "exteriorColor": "Rojo", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 5290000000, "primaryImagePath": "/images/vehicles/smc-2412.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.592	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.592	Onboarding
cmwn5n8x0004l7ds3h4tc4dfs	2026-11-19 06:14:09.637	2026-11-19 06:14:09.637	rooftop-default-main	cmwn5n8wt004d7ds38oi9yqzd	1	cmwn5n8wt004d7ds38oi9yqzd:1	approved	{"vin": "9BJ4U3Z1RKFMKRRA8", "make": "Peugeot", "trim": "Allure", "year": 2026, "model": "208", "title": "2026 Peugeot 208 Allure", "engine": "1.6", "images": [{"id": "cmwn5n8wr00497ds30xfr3rrr", "caption": "2026 Peugeot 208", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "nafta", "condition": "new", "vehicleId": "cmwn5n8wp00477ds3jfwp8wyn", "priceCents": 2750000000, "description": "Peugeot 208 Allure 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-201", "transmission": "manual", "exteriorColor": "Blanco", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 2750000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.625	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.625	Onboarding
cmwn5n8y200557ds311032qec	2026-11-19 06:14:09.674	2026-11-19 06:14:09.674	rooftop-default-main	cmwn5n8xu004x7ds3zdcfc0rd	1	cmwn5n8xu004x7ds3zdcfc0rd:1	approved	{"vin": "9BVAK30XJ9D62222G", "make": "Fiat", "trim": "Drive 1.3", "year": 2026, "model": "Cronos", "title": "2026 Fiat Cronos Drive 1.3", "engine": "1.3", "images": [{"id": "cmwn5n8xs004t7ds32n6hdr2y", "caption": "2026 Fiat Cronos", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "nafta", "condition": "new", "vehicleId": "cmwn5n8xq004r7ds309fmvwwt", "priceCents": 2490000000, "description": "Fiat Cronos Drive 1.3 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-202", "transmission": "manual", "exteriorColor": "Gris", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 2490000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.662	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.662	Onboarding
cmwn5n929007d7ds3mczj9cig	2026-11-19 06:14:09.826	2026-11-19 06:14:09.826	rooftop-default-main	cmwn5n92200757ds3dcgzo340	1	cmwn5n92200757ds3dcgzo340:1	approved	{"vin": "9BRNS2RN8ZBBU7TNZ", "make": "Chevrolet", "trim": "LTZ", "year": 2026, "model": "Tracker", "title": "2026 Chevrolet Tracker LTZ", "engine": "1.2 Turbo", "images": [{"id": "cmwn5n91z00717ds3yt04gmfq", "caption": "2026 Chevrolet Tracker", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "nafta", "condition": "new", "vehicleId": "cmwn5n91y006z7ds3s100xzir", "priceCents": 3390000000, "description": "Chevrolet Tracker LTZ 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-206", "transmission": "automatica", "exteriorColor": "Azul", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 3390000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.813	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.813	Onboarding
cmwn5n8z2005p7ds3mtzz9rhx	2026-11-19 06:14:09.711	2026-11-19 06:14:09.711	rooftop-default-main	cmwn5n8yu005h7ds33gqlf2tj	1	cmwn5n8yu005h7ds33gqlf2tj:1	approved	{"vin": "9BDNEP5LHYDGAKG0B", "make": "Volkswagen", "trim": "Highline V6", "year": 2026, "model": "Amarok", "title": "2026 Volkswagen Amarok Highline V6", "engine": "3.0 V6 TDI", "images": [{"id": "cmwn5n8ys005d7ds3d8dxyfak", "caption": "2026 Volkswagen Amarok", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "diesel", "condition": "new", "vehicleId": "cmwn5n8yp005b7ds3yri6d7y2", "priceCents": 7290000000, "description": "Volkswagen Amarok Highline V6 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-203", "transmission": "automatica", "exteriorColor": "Negro", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 7290000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.697	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.697	Onboarding
cmwn5n948008h7ds37kx80u6t	2026-11-19 06:14:09.896	2026-11-19 06:14:09.896	rooftop-default-main	cmwn5n94000897ds38u015603	1	cmwn5n94000897ds38u015603:1	approved	{"vin": "9B7M4YF262FLLJBK6", "make": "Citroën", "trim": "Feel Pack", "year": 2026, "model": "C3", "title": "2026 Citroën C3 Feel Pack", "engine": "1.6", "images": [{"id": "cmwn5n93y00857ds3psgnfsmc", "caption": "2026 Citroën C3", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "nafta", "condition": "new", "vehicleId": "cmwn5n93w00837ds338sllg5v", "priceCents": 2390000000, "description": "Citroën C3 Feel Pack 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-208", "transmission": "manual", "exteriorColor": "Blanco", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 2390000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.884	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.884	Onboarding
cmwn5n90300697ds3s9m1jjir	2026-11-19 06:14:09.748	2026-11-19 06:14:09.748	rooftop-default-main	cmwn5n8zv00617ds3kk46hao5	1	cmwn5n8zv00617ds3kk46hao5:1	approved	{"vin": "9B1KTZ07HH8677WFK", "make": "Renault", "trim": "Evolution", "year": 2026, "model": "Kardian", "title": "2026 Renault Kardian Evolution", "engine": "1.6", "images": [{"id": "cmwn5n8zs005x7ds35qtmhq0k", "caption": "2026 Renault Kardian", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "nafta", "condition": "new", "vehicleId": "cmwn5n8zq005v7ds34ku8k4zf", "priceCents": 2980000000, "description": "Renault Kardian Evolution 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-204", "transmission": "manual", "exteriorColor": "Rojo", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 2980000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.733	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.733	Onboarding
cmwn5n917006t7ds3mya2bazt	2026-11-19 06:14:09.788	2026-11-19 06:14:09.788	rooftop-default-main	cmwn5n90z006l7ds3894zgucr	1	cmwn5n90z006l7ds3894zgucr:1	approved	{"vin": "9BT7LBP0KBWFT0LZR", "make": "Toyota", "trim": "SRV 4x4", "year": 2026, "model": "Hilux", "title": "2026 Toyota Hilux SRV 4x4", "engine": "2.8 TD", "images": [{"id": "cmwn5n90x006h7ds38y0c8vhv", "caption": "2026 Toyota Hilux", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "diesel", "condition": "new", "vehicleId": "cmwn5n90v006f7ds3i3bn2uwz", "priceCents": 6450000000, "description": "Toyota Hilux SRV 4x4 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-205", "transmission": "automatica", "exteriorColor": "Plata", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 6450000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.775	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.775	Onboarding
cmwn5n93b007x7ds3wulsycv2	2026-11-19 06:14:09.863	2026-11-19 06:14:09.863	rooftop-default-main	cmwn5n934007p7ds3chn23tv3	1	cmwn5n934007p7ds3chn23tv3:1	approved	{"vin": "9B0FRGR7NYP7A7ZFH", "make": "Chery", "trim": "Luxury", "year": 2026, "model": "Tiggo 4", "title": "2026 Chery Tiggo 4 Luxury", "engine": "1.5", "images": [{"id": "cmwn5n931007l7ds3vyvntvsi", "caption": "2026 Chery Tiggo 4", "imageId": null, "category": "exterior", "imagePath": "/images/vehicles/foto-proximamente.jpg", "isPrimary": true, "sortOrder": 0, "imageExtension": null}], "mileage": 0, "features": ["0 km", "Garantía oficial de fábrica"], "fuelType": "nafta", "condition": "new", "vehicleId": "cmwn5n930007j7ds3kkjpr2nm", "priceCents": 2870000000, "description": "Chery Tiggo 4 Luxury 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.", "stockNumber": "EA-207", "transmission": "automatica", "exteriorColor": "Gris oscuro", "interiorColor": "Negro", "schemaVersion": 2, "listPriceCents": 2870000000, "primaryImagePath": "/images/vehicles/foto-proximamente.jpg"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.851	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.851	Onboarding
\.


--
-- Data for Name: InventoryReconWorkItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryReconWorkItem" (id, "createdAt", "updatedAt", rooftop, stock, title, category, status, "estimatedCostCents", "actualCostCents", "vendorName", "assignedTo", "dueAt", "completedAt") FROM stdin;
cmwn5n8nn00177ds3p6ts22ic	2026-11-19 06:14:09.3	2026-11-19 06:14:09.3	rooftop-default-main	cmwn5n8nd00117ds3i6j9ibzl	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.269
cmwn5n8r2001r7ds358nchv8d	2026-11-19 06:14:09.422	2026-11-19 06:14:09.422	rooftop-default-main	cmwn5n8qo001l7ds3l3wcix8b	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.396
cmwn5n8sj002b7ds3spbf7ek6	2026-11-19 06:14:09.476	2026-11-19 06:14:09.476	rooftop-default-main	cmwn5n8sd00257ds3f23er93i	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.465
cmwn5n8ts002v7ds3s1xmwhir	2026-11-19 06:14:09.52	2026-11-19 06:14:09.52	rooftop-default-main	cmwn5n8tm002p7ds334myjhbi	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.506
cmwn5n8uz003f7ds3z687f8r7	2026-11-19 06:14:09.564	2026-11-19 06:14:09.564	rooftop-default-main	cmwn5n8uu00397ds3owwakuna	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.55
cmwn5n8w1003z7ds3br7mle1g	2026-11-19 06:14:09.601	2026-11-19 06:14:09.601	rooftop-default-main	cmwn5n8vx003t7ds34ktzndka	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.592
cmwn5n8wx004j7ds3d2mlj1n7	2026-11-19 06:14:09.634	2026-11-19 06:14:09.634	rooftop-default-main	cmwn5n8wt004d7ds38oi9yqzd	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.625
cmwn5n8xz00537ds3qlk0ie3s	2026-11-19 06:14:09.671	2026-11-19 06:14:09.671	rooftop-default-main	cmwn5n8xu004x7ds3zdcfc0rd	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.662
cmwn5n8yz005n7ds3eqmfpo26	2026-11-19 06:14:09.707	2026-11-19 06:14:09.707	rooftop-default-main	cmwn5n8yu005h7ds33gqlf2tj	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.697
cmwn5n90000677ds357db6vvc	2026-11-19 06:14:09.744	2026-11-19 06:14:09.744	rooftop-default-main	cmwn5n8zv00617ds3kk46hao5	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.733
cmwn5n914006r7ds3mfh0j41v	2026-11-19 06:14:09.785	2026-11-19 06:14:09.785	rooftop-default-main	cmwn5n90z006l7ds3894zgucr	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.775
cmwn5n926007b7ds38xpewyef	2026-11-19 06:14:09.823	2026-11-19 06:14:09.823	rooftop-default-main	cmwn5n92200757ds3dcgzo340	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.813
cmwn5n938007v7ds3lhlj3svy	2026-11-19 06:14:09.861	2026-11-19 06:14:09.861	rooftop-default-main	cmwn5n934007p7ds3chn23tv3	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.851
cmwn5n945008f7ds3qsv9b5zl	2026-11-19 06:14:09.893	2026-11-19 06:14:09.893	rooftop-default-main	cmwn5n94000897ds38u015603	Onboarding readiness inspection	inspection	completed	0	0		cmwn5mdux00017ds3g2ngshoz	\N	2026-11-19 06:14:09.884
\.


--
-- Data for Name: InventoryStock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryStock" (id, "createdAt", "updatedAt", rooftop, vehicle, "stockNumber", "stockKey", "locationCode", "locationLabel", "stockedAt", "frontlineAt", "purchaseCostCents", "reconCostCents", "otherCostCents", "totalCostCents", "reconStatus", "merchandisingStatus", "feedStatus", "approvedRevisionHash") FROM stdin;
cmwn5n8nd00117ds3i6j9ibzl	2026-11-19 06:14:09.289	2026-11-19 06:14:09.317	rooftop-default-main	cmwn5n8mu000v7ds3sa4npbgr	EA-101	rooftop-default-main:EA-101	SALON	Salón	2026-11-19 06:14:09.269	2026-11-19 06:14:09.269	4666500000	0	0	4666500000	completed	approved	succeeded	fc7a7749a14c66951fbbb821663d9cbc2b750cb9fbdfb0fe80e7f878a4dbee8b
cmwn5n8qo001l7ds3l3wcix8b	2026-11-19 06:14:09.408	2026-11-19 06:14:09.43	rooftop-default-main	cmwn5n8qc001f7ds30tli48hk	EA-102	rooftop-default-main:EA-102	SALON	Salón	2026-11-19 06:14:09.396	2026-11-19 06:14:09.396	3306500000	0	0	3306500000	completed	approved	succeeded	c82e479e0040c69f0581bfb9cbfef445f17289a6ef60eb6285911368915f77a5
cmwn5n8sd00257ds3f23er93i	2026-11-19 06:14:09.47	2026-11-19 06:14:09.48	rooftop-default-main	cmwn5n8s9001z7ds332vylq2q	EA-103	rooftop-default-main:EA-103	SALON	Salón	2026-11-19 06:14:09.465	2026-11-19 06:14:09.465	3952500000	0	0	3952500000	completed	approved	succeeded	e69e7cbcdbd348be1b43a7bded6be4996d64357fcceda23e6625befe971b8ba1
cmwn5n8tm002p7ds334myjhbi	2026-11-19 06:14:09.514	2026-11-19 06:14:09.525	rooftop-default-main	cmwn5n8tf002j7ds3g2w2c8uk	EA-104	rooftop-default-main:EA-104	SALON	Salón	2026-11-19 06:14:09.506	2026-11-19 06:14:09.506	2541500000	0	0	2541500000	completed	approved	succeeded	37efa31ef7a5d206da929d6bfc94c5df21fc6acbdfc388978db8217d7bff02a3
cmwn5n8uu00397ds3owwakuna	2026-11-19 06:14:09.558	2026-11-19 06:14:09.569	rooftop-default-main	cmwn5n8un00337ds3e0hyldf6	EA-105	rooftop-default-main:EA-105	SALON	Salón	2026-11-19 06:14:09.55	2026-11-19 06:14:09.55	2847500000	0	0	2847500000	completed	approved	succeeded	3170786ac36a48eda322a1be12ff069066c8d6c1e9b4c312772c4ea0d20860ec
cmwn5n8vx003t7ds34ktzndka	2026-11-19 06:14:09.597	2026-11-19 06:14:09.604	rooftop-default-main	cmwn5n8vt003n7ds36ndp65mb	EA-106	rooftop-default-main:EA-106	SALON	Salón	2026-11-19 06:14:09.592	2026-11-19 06:14:09.592	4496500000	0	0	4496500000	completed	approved	succeeded	45e00c9bfe49d0a64e0f0569281ced1be361e773e1c127b3e7ee5b1827f469a0
cmwn5n8wt004d7ds38oi9yqzd	2026-11-19 06:14:09.63	2026-11-19 06:14:09.638	rooftop-default-main	cmwn5n8wp00477ds3jfwp8wyn	EA-201	rooftop-default-main:EA-201	SALON	Salón	2026-11-19 06:14:09.625	2026-11-19 06:14:09.625	2475000000	0	0	2475000000	completed	approved	succeeded	4f885d3af13cac7aa7d3ca4051fe7ea3aebd8d650abe47a1e24a8e9a5a14c78b
cmwn5n8xu004x7ds3zdcfc0rd	2026-11-19 06:14:09.667	2026-11-19 06:14:09.675	rooftop-default-main	cmwn5n8xq004r7ds309fmvwwt	EA-202	rooftop-default-main:EA-202	SALON	Salón	2026-11-19 06:14:09.662	2026-11-19 06:14:09.662	2241000000	0	0	2241000000	completed	approved	succeeded	4641963bd5f55fbfebca8ee3441b3a107c948a2b87f5f09e2da109840a0417b3
cmwn5n8yu005h7ds33gqlf2tj	2026-11-19 06:14:09.703	2026-11-19 06:14:09.712	rooftop-default-main	cmwn5n8yp005b7ds3yri6d7y2	EA-203	rooftop-default-main:EA-203	SALON	Salón	2026-11-19 06:14:09.697	2026-11-19 06:14:09.697	6561000000	0	0	6561000000	completed	approved	succeeded	3c052a821a5870be980ef2539b5736be83c507a4de1d51b956444a060dc01603
cmwn5n8zv00617ds3kk46hao5	2026-11-19 06:14:09.739	2026-11-19 06:14:09.75	rooftop-default-main	cmwn5n8zq005v7ds34ku8k4zf	EA-204	rooftop-default-main:EA-204	SALON	Salón	2026-11-19 06:14:09.733	2026-11-19 06:14:09.733	2682000000	0	0	2682000000	completed	approved	succeeded	7ec8a17783ede4188c2ddba19b7197c583110ece94885da9c028264f39c72315
cmwn5n90z006l7ds3894zgucr	2026-11-19 06:14:09.78	2026-11-19 06:14:09.789	rooftop-default-main	cmwn5n90v006f7ds3i3bn2uwz	EA-205	rooftop-default-main:EA-205	SALON	Salón	2026-11-19 06:14:09.775	2026-11-19 06:14:09.775	5805000000	0	0	5805000000	completed	approved	succeeded	d80a171d3d9f1eb92c491c510a132872ba8c24e848dd7cbb9f9c35818cfbecb7
cmwn5n92200757ds3dcgzo340	2026-11-19 06:14:09.818	2026-11-19 06:14:09.827	rooftop-default-main	cmwn5n91y006z7ds3s100xzir	EA-206	rooftop-default-main:EA-206	SALON	Salón	2026-11-19 06:14:09.813	2026-11-19 06:14:09.813	3051000000	0	0	3051000000	completed	approved	succeeded	25442ef30acbf1ef9c7888dab0ad366e7b006488d7bba5e06fcbd7087b5b0e3e
cmwn5n934007p7ds3chn23tv3	2026-11-19 06:14:09.856	2026-11-19 06:14:09.864	rooftop-default-main	cmwn5n930007j7ds3kkjpr2nm	EA-207	rooftop-default-main:EA-207	SALON	Salón	2026-11-19 06:14:09.851	2026-11-19 06:14:09.851	2583000000	0	0	2583000000	completed	approved	succeeded	8d25aa35dac1063395d5113ac999993f8c30dbf143e9fc6f9ef8d5fe06db5584
cmwn5n94000897ds38u015603	2026-11-19 06:14:09.889	2026-11-19 06:14:09.897	rooftop-default-main	cmwn5n93w00837ds338sllg5v	EA-208	rooftop-default-main:EA-208	SALON	Salón	2026-11-19 06:14:09.884	2026-11-19 06:14:09.884	2151000000	0	0	2151000000	completed	approved	succeeded	dacde13bcf58c09f28b3ecd7e4648655a8f080cc8e7c5cebc871ea5f281eab6f
\.


--
-- Data for Name: InventoryStockEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryStockEvent" (id, "createdAt", "updatedAt", rooftop, stock, "eventKey", "eventType", reason, "amountCents", evidence, actor, "occurredAt") FROM stdin;
cmwn5n8nk00157ds3q5qmre05	2026-11-19 06:14:09.296	2026-11-19 06:14:09.296	rooftop-default-main	cmwn5n8nd00117ds3i6j9ibzl	inventory-intake:rooftop-default-main:onboarding:8AXK2DEG0D9PCF43E:stock	vehicle-intake	Onboarding	4666500000	{"vehicleId": "cmwn5n8mu000v7ds3sa4npbgr", "locationCode": "SALON", "acquisitionId": "cmwn5n8n9000z7ds3rwzk0x8d"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.269
cmwn5n8qy001p7ds31xttr8oq	2026-11-19 06:14:09.418	2026-11-19 06:14:09.418	rooftop-default-main	cmwn5n8qo001l7ds3l3wcix8b	inventory-intake:rooftop-default-main:onboarding:8A4DHRD2DRCJV3KHW:stock	vehicle-intake	Onboarding	3306500000	{"vehicleId": "cmwn5n8qc001f7ds30tli48hk", "locationCode": "SALON", "acquisitionId": "cmwn5n8qm001j7ds3q00numaw"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.396
cmwn5n8si00297ds3vsfsosx7	2026-11-19 06:14:09.474	2026-11-19 06:14:09.474	rooftop-default-main	cmwn5n8sd00257ds3f23er93i	inventory-intake:rooftop-default-main:onboarding:8AN0GEDP84X660WSM:stock	vehicle-intake	Onboarding	3952500000	{"vehicleId": "cmwn5n8s9001z7ds332vylq2q", "locationCode": "SALON", "acquisitionId": "cmwn5n8sc00237ds39wtppoi9"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.465
cmwn5n8tq002t7ds3thqmuuyv	2026-11-19 06:14:09.518	2026-11-19 06:14:09.518	rooftop-default-main	cmwn5n8tm002p7ds334myjhbi	inventory-intake:rooftop-default-main:onboarding:8AW8Y5VEH93LYK83C:stock	vehicle-intake	Onboarding	2541500000	{"vehicleId": "cmwn5n8tf002j7ds3g2w2c8uk", "locationCode": "SALON", "acquisitionId": "cmwn5n8tk002n7ds3x2yfb60l"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.506
cmwn5n8uy003d7ds3jaybc0cl	2026-11-19 06:14:09.562	2026-11-19 06:14:09.562	rooftop-default-main	cmwn5n8uu00397ds3owwakuna	inventory-intake:rooftop-default-main:onboarding:8AYZ86EFU7EDW5V1Z:stock	vehicle-intake	Onboarding	2847500000	{"vehicleId": "cmwn5n8un00337ds3e0hyldf6", "locationCode": "SALON", "acquisitionId": "cmwn5n8us00377ds361plk9c8"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.55
cmwn5n8w0003x7ds38batnbhb	2026-11-19 06:14:09.6	2026-11-19 06:14:09.6	rooftop-default-main	cmwn5n8vx003t7ds34ktzndka	inventory-intake:rooftop-default-main:onboarding:8AZLH8DPVJS228FL5:stock	vehicle-intake	Onboarding	4496500000	{"vehicleId": "cmwn5n8vt003n7ds36ndp65mb", "locationCode": "SALON", "acquisitionId": "cmwn5n8vw003r7ds3r4mchv0s"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.592
cmwn5n8wx004h7ds3qquj4njj	2026-11-19 06:14:09.633	2026-11-19 06:14:09.633	rooftop-default-main	cmwn5n8wt004d7ds38oi9yqzd	inventory-intake:rooftop-default-main:onboarding:9BJ4U3Z1RKFMKRRA8:stock	vehicle-intake	Onboarding	2475000000	{"vehicleId": "cmwn5n8wp00477ds3jfwp8wyn", "locationCode": "SALON", "acquisitionId": "cmwn5n8ws004b7ds3sdkh76hi"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.625
cmwn5n8xy00517ds3l23qw3vf	2026-11-19 06:14:09.67	2026-11-19 06:14:09.67	rooftop-default-main	cmwn5n8xu004x7ds3zdcfc0rd	inventory-intake:rooftop-default-main:onboarding:9BVAK30XJ9D62222G:stock	vehicle-intake	Onboarding	2241000000	{"vehicleId": "cmwn5n8xq004r7ds309fmvwwt", "locationCode": "SALON", "acquisitionId": "cmwn5n8xt004v7ds332p9ovbf"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.662
cmwn5n8yy005l7ds3ihkyck9s	2026-11-19 06:14:09.706	2026-11-19 06:14:09.706	rooftop-default-main	cmwn5n8yu005h7ds33gqlf2tj	inventory-intake:rooftop-default-main:onboarding:9BDNEP5LHYDGAKG0B:stock	vehicle-intake	Onboarding	6561000000	{"vehicleId": "cmwn5n8yp005b7ds3yri6d7y2", "locationCode": "SALON", "acquisitionId": "cmwn5n8yt005f7ds3ks3583m3"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.697
cmwn5n8zy00657ds35vsmlgdx	2026-11-19 06:14:09.743	2026-11-19 06:14:09.743	rooftop-default-main	cmwn5n8zv00617ds3kk46hao5	inventory-intake:rooftop-default-main:onboarding:9B1KTZ07HH8677WFK:stock	vehicle-intake	Onboarding	2682000000	{"vehicleId": "cmwn5n8zq005v7ds34ku8k4zf", "locationCode": "SALON", "acquisitionId": "cmwn5n8zt005z7ds3akiojzi7"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.733
cmwn5n913006p7ds39sglugdt	2026-11-19 06:14:09.783	2026-11-19 06:14:09.783	rooftop-default-main	cmwn5n90z006l7ds3894zgucr	inventory-intake:rooftop-default-main:onboarding:9BT7LBP0KBWFT0LZR:stock	vehicle-intake	Onboarding	5805000000	{"vehicleId": "cmwn5n90v006f7ds3i3bn2uwz", "locationCode": "SALON", "acquisitionId": "cmwn5n90y006j7ds34yetpfoj"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.775
cmwn5n92500797ds3b270304o	2026-11-19 06:14:09.822	2026-11-19 06:14:09.822	rooftop-default-main	cmwn5n92200757ds3dcgzo340	inventory-intake:rooftop-default-main:onboarding:9BRNS2RN8ZBBU7TNZ:stock	vehicle-intake	Onboarding	3051000000	{"vehicleId": "cmwn5n91y006z7ds3s100xzir", "locationCode": "SALON", "acquisitionId": "cmwn5n92100737ds367gav8xt"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.813
cmwn5n937007t7ds38bia0r8l	2026-11-19 06:14:09.86	2026-11-19 06:14:09.86	rooftop-default-main	cmwn5n934007p7ds3chn23tv3	inventory-intake:rooftop-default-main:onboarding:9B0FRGR7NYP7A7ZFH:stock	vehicle-intake	Onboarding	2583000000	{"vehicleId": "cmwn5n930007j7ds3kkjpr2nm", "locationCode": "SALON", "acquisitionId": "cmwn5n933007n7ds3g07junbn"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.851
cmwn5n944008d7ds30xpcxefb	2026-11-19 06:14:09.892	2026-11-19 06:14:09.892	rooftop-default-main	cmwn5n94000897ds38u015603	inventory-intake:rooftop-default-main:onboarding:9B7M4YF262FLLJBK6:stock	vehicle-intake	Onboarding	2151000000	{"vehicleId": "cmwn5n93w00837ds338sllg5v", "locationCode": "SALON", "acquisitionId": "cmwn5n93z00877ds34ybx8gbe"}	cmwn5mdux00017ds3g2ngshoz	2026-11-19 06:14:09.884
\.


--
-- Data for Name: Lead; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Lead" (id, "firstName", "lastName", email, phone, source, "interestedVehicle", "budgetRange", "tradeInVehicle", timeframe, status, "assignedSalesperson", notes, "createdAt", "lastContact", "updatedAt", rooftop, "assignedAt", customer, "firstResponseAt", "firstResponseDueAt", "lostReason", "cadenceDueAt", "cadenceKey", "cadenceStatus", "cadenceStep", "campaignKey", "lostReasonCode") FROM stdin;
\.


--
-- Data for Name: LeadAssignmentEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LeadAssignmentEvent" (id, "createdAt", "updatedAt", rooftop, lead, "fromUser", "toUser", actor, reason, "routeKey", "assignedAt", "firstResponseDueAt") FROM stdin;
\.


--
-- Data for Name: LeadRoutingRule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LeadRoutingRule" (id, "createdAt", "updatedAt", rooftop, name, "routeKey", active, priority, source, assignee, "firstResponseMinutes") FROM stdin;
7d48fcdc-f650-435e-9192-aa535b851d58	2026-11-19 06:14:10.52	2026-11-19 06:14:10.52	rooftop-default-main	Website leads	rooftop-default-main:website:website-leads	t	10	website	cmwn5mdux00017ds3g2ngshoz	15
5835b408-9a65-4118-bd0b-5a372a223502	2026-11-19 06:14:10.541	2026-11-19 06:14:10.541	rooftop-default-main	Phone leads	rooftop-default-main:phone:phone-leads	t	20	phone	cmwn5mdux00017ds3g2ngshoz	10
a03ea0bb-b998-4712-a9bd-3b0491ad23fd	2026-11-19 06:14:10.564	2026-11-19 06:14:10.564	rooftop-default-main	Walk-in traffic	rooftop-default-main:walk-in:walk-in-traffic	t	30	walk-in	cmwn5mdux00017ds3g2ngshoz	5
ae3c06ab-3faf-456a-b2a6-42a699a05d65	2026-11-19 06:14:10.584	2026-11-19 06:14:10.584	rooftop-default-main	Third-party leads	rooftop-default-main:third-party:third-party-leads	t	40	third-party	cmwn5mdux00017ds3g2ngshoz	30
52d57335-18df-49f6-bf77-7b18a7b9f0ce	2026-11-19 06:14:10.619	2026-11-19 06:14:10.619	rooftop-default-main	Referrals	rooftop-default-main:referral:referrals	t	50	referral	cmwn5mdux00017ds3g2ngshoz	60
\.


--
-- Data for Name: LenderDecision; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LenderDecision" (id, "createdAt", "updatedAt", application, submission, "idempotencyKey", "providerKey", "externalReference", decision, "approvedAmountCents", "aprBasisPoints", "termMonths", "monthlyPaymentCents", "reasonCodes", "immutableSnapshot", "decidedAt", "recordedBy", rooftop) FROM stdin;
\.


--
-- Data for Name: LenderSubmission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LenderSubmission" (id, "createdAt", "updatedAt", application, "providerKey", "idempotencyKey", status, "externalReference", "requestSnapshot", "responseSummary", "errorCode", "queuedAt", "submittedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: Make; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Make" (id, name, logo_id, logo_filesize, logo_width, logo_height, logo_extension, "createdAt", "updatedAt") FROM stdin;
cmwn5n7ze00047ds3rsu5epl0	BMW	\N	\N	\N	\N	\N	2026-11-19 06:14:08.426	2026-11-19 06:14:08.426
cmwn5n80200057ds3bbzkpm1g	Chery	\N	\N	\N	\N	\N	2026-11-19 06:14:08.449	2026-11-19 06:14:08.449
cmwn5n80h00067ds3944d47m2	Chevrolet	\N	\N	\N	\N	\N	2026-11-19 06:14:08.465	2026-11-19 06:14:08.465
cmwn5n80v00077ds3wg5a8xc9	Citroën	\N	\N	\N	\N	\N	2026-11-19 06:14:08.478	2026-11-19 06:14:08.478
cmwn5n81c00087ds3lzyxrekg	Fiat	\N	\N	\N	\N	\N	2026-11-19 06:14:08.495	2026-11-19 06:14:08.495
cmwn5n81o00097ds3bkiwgj4e	Ford	\N	\N	\N	\N	\N	2026-11-19 06:14:08.508	2026-11-19 06:14:08.508
cmwn5n81z000a7ds35cfn538v	Honda	\N	\N	\N	\N	\N	2026-11-19 06:14:08.519	2026-11-19 06:14:08.519
cmwn5n82b000b7ds36rq1bntt	Mercedes-Benz	\N	\N	\N	\N	\N	2026-11-19 06:14:08.53	2026-11-19 06:14:08.53
cmwn5n82l000c7ds3cj3y7scg	Peugeot	\N	\N	\N	\N	\N	2026-11-19 06:14:08.541	2026-11-19 06:14:08.541
cmwn5n82x000d7ds3qcnxlb66	Renault	\N	\N	\N	\N	\N	2026-11-19 06:14:08.552	2026-11-19 06:14:08.552
cmwn5n838000e7ds3h9lasxcb	Toyota	\N	\N	\N	\N	\N	2026-11-19 06:14:08.564	2026-11-19 06:14:08.564
cmwn5n83m000f7ds3yuh6gmvu	Volkswagen	\N	\N	\N	\N	\N	2026-11-19 06:14:08.578	2026-11-19 06:14:08.578
\.


--
-- Data for Name: MembershipAuditEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MembershipAuditEvent" (id, "createdAt", "updatedAt", "scopeType", action, "dealerGroup", rooftop, "targetUser", actor, "membershipId", "previousSnapshot", "nextSnapshot", reason, "occurredAt") FROM stdin;
cmwn5n7yj00037ds3i6efnat5	2026-11-19 06:14:08.381	2026-11-19 06:14:08.381	dealer-group	onboarding-bootstrap	dealer-group-default	\N	cmwn5mdux00017ds3g2ngshoz	cmwn5mdux00017ds3g2ngshoz	cmwn5n7xz00027ds3ib76358j	\N	{"id": "cmwn5n7xz00027ds3ib76358j", "roleId": "cmwn5mdut00007ds3cvywmlzd", "status": "active", "accessAllRooftops": true}	Onboarding	2026-11-19 06:14:08.381
\.


--
-- Data for Name: Model; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Model" (id, name, make, "bodyStyle", "baseYear", "createdAt", "updatedAt") FROM stdin;
cmwn5n84h000g7ds32b3f0ge1	530i	cmwn5n7ze00047ds3rsu5epl0	sedan	2015	2026-11-19 06:14:08.605	2026-11-19 06:14:08.605
cmwn5n85s000h7ds3k16idihl	Camry	cmwn5n838000e7ds3h9lasxcb	sedan	2015	2026-11-19 06:14:08.649	2026-11-19 06:14:08.649
cmwn5n870000i7ds3ltm79jsf	CR-V	cmwn5n81z000a7ds35cfn538v	suv	2015	2026-11-19 06:14:08.696	2026-11-19 06:14:08.696
cmwn5n884000j7ds3vd457zj3	Accord	cmwn5n81z000a7ds35cfn538v	sedan	2015	2026-11-19 06:14:08.737	2026-11-19 06:14:08.737
cmwn5n89d000k7ds3xefw2u2e	C 300	cmwn5n82b000b7ds36rq1bntt	sedan	2015	2026-11-19 06:14:08.781	2026-11-19 06:14:08.781
cmwn5n8ag000l7ds3sflw99kv	Mustang	cmwn5n81o00097ds3bkiwgj4e	coupe	2015	2026-11-19 06:14:08.822	2026-11-19 06:14:08.822
cmwn5n8bh000m7ds3ahqqook0	208	cmwn5n82l000c7ds3cj3y7scg	sedan	2015	2026-11-19 06:14:08.857	2026-11-19 06:14:08.857
cmwn5n8cl000n7ds3qkh9ph0a	Cronos	cmwn5n81c00087ds3lzyxrekg	sedan	2015	2026-11-19 06:14:08.897	2026-11-19 06:14:08.897
cmwn5n8dt000o7ds3l996echk	Amarok	cmwn5n83m000f7ds3yuh6gmvu	truck	2015	2026-11-19 06:14:08.941	2026-11-19 06:14:08.941
cmwn5n8ff000p7ds3try50mx3	Kardian	cmwn5n82x000d7ds3qcnxlb66	suv	2015	2026-11-19 06:14:08.998	2026-11-19 06:14:08.998
cmwn5n8hz000q7ds3ogmte37f	Hilux	cmwn5n838000e7ds3h9lasxcb	truck	2015	2026-11-19 06:14:09.089	2026-11-19 06:14:09.089
cmwn5n8j0000r7ds3udlu90da	Tracker	cmwn5n80h00067ds3944d47m2	suv	2015	2026-11-19 06:14:09.13	2026-11-19 06:14:09.13
cmwn5n8k6000s7ds3epuip15s	Tiggo 4	cmwn5n80200057ds3bbzkpm1g	suv	2015	2026-11-19 06:14:09.171	2026-11-19 06:14:09.171
cmwn5n8l8000t7ds39nri7acc	C3	cmwn5n80v00077ds3wg5a8xc9	sedan	2015	2026-11-19 06:14:09.21	2026-11-19 06:14:09.21
\.


--
-- Data for Name: PartsInventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PartsInventory" (id, "partNumber", description, quantity, "minimumQuantity", "costCents", "priceCents", supplier, "supplierPartNumber", "createdAt", "updatedAt", rooftop, "binLocation", "committedQuantity", "onOrderQuantity") FROM stdin;
cmwn5n99t008x7ds356b0smyh	90915-YZZD1	Toyota oil filter	48	20	510	999	Toyota Parts Center		2026-11-19 06:14:10.098	2026-11-19 06:14:10.113	rooftop-default-main	A1-01	0	0
cmwn5n9b000957ds38h3q51od	15400-PLM-A02	Honda oil filter	40	20	480	949	Honda Parts Direct		2026-11-19 06:14:10.14	2026-11-19 06:14:10.153	rooftop-default-main	A1-02	0	0
cmwn5n9c2009d7ds3abcjgyys	0W20-SYN-5QT	Full synthetic 0W-20 motor oil, 5 qt	60	24	2150	3899	Valvoline		2026-11-19 06:14:10.178	2026-11-19 06:14:10.193	rooftop-default-main	A2-01	0	0
cmwn5n9d4009l7ds3u1uxx32h	BP-CER-F1024	Ceramic front brake pad set	12	6	3800	8999	Akebono		2026-11-19 06:14:10.217	2026-11-19 06:14:10.229	rooftop-default-main	B3-04	0	0
cmwn5n9e9009t7ds3pn2qndxm	CAF-87139-YZZ08	Cabin air filter	24	10	920	2499	Toyota Parts Center		2026-11-19 06:14:10.257	2026-11-19 06:14:10.269	rooftop-default-main	C1-03	0	0
cmwn5n9f900a17ds3ru4pkl6f	EAF-17220-5PA	Engine air filter	20	10	1150	2899	Honda Parts Direct		2026-11-19 06:14:10.293	2026-11-19 06:14:10.306	rooftop-default-main	C1-04	0	0
cmwn5n9gb00a97ds33qkhodic	BAT-H6-AGM	H6 AGM 12V battery	8	4	13500	22999	Interstate Batteries		2026-11-19 06:14:10.331	2026-11-19 06:14:10.342	rooftop-default-main	D1-01	0	0
cmwn5n9h800ah7ds32kgd7d3q	WB-22-HYB	22-inch hybrid wiper blade	30	12	850	2199	Bosch		2026-11-19 06:14:10.365	2026-11-19 06:14:10.376	rooftop-default-main	C2-01	0	0
\.


--
-- Data for Name: PartsMovement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PartsMovement" (id, "createdAt", "updatedAt", rooftop, part, "serviceOrder", "movementType", "quantityDelta", "onHandAfter", "committedAfter", "onOrderAfter", reference, reason, evidence, "occurredAt", "idempotencyKey") FROM stdin;
cmwn5n9a900917ds3f4q1chof	2026-11-19 06:14:10.114	2026-11-19 06:14:10.114	rooftop-default-main	cmwn5n99t008x7ds356b0smyh	\N	receipt	48	48	0	0	Opening stock	Onboarding	{"partId": "cmwn5n99t008x7ds356b0smyh", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 48, "reference": "Opening stock", "partNumber": "90915-YZZD1", "onHandAfter": 48, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 48, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.113	onboarding:rooftop-default-main:part-opening-stock:90915-YZZD1
cmwn5n9be00997ds32dj32gj2	2026-11-19 06:14:10.154	2026-11-19 06:14:10.154	rooftop-default-main	cmwn5n9b000957ds38h3q51od	\N	receipt	40	40	0	0	Opening stock	Onboarding	{"partId": "cmwn5n9b000957ds38h3q51od", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 40, "reference": "Opening stock", "partNumber": "15400-PLM-A02", "onHandAfter": 40, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 40, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.154	onboarding:rooftop-default-main:part-opening-stock:15400-PLM-A02
cmwn5n9ch009h7ds3tmslag2r	2026-11-19 06:14:10.194	2026-11-19 06:14:10.194	rooftop-default-main	cmwn5n9c2009d7ds3abcjgyys	\N	receipt	60	60	0	0	Opening stock	Onboarding	{"partId": "cmwn5n9c2009d7ds3abcjgyys", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 60, "reference": "Opening stock", "partNumber": "0W20-SYN-5QT", "onHandAfter": 60, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 60, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.193	onboarding:rooftop-default-main:part-opening-stock:0W20-SYN-5QT
cmwn5n9dh009p7ds3ycefxsl5	2026-11-19 06:14:10.229	2026-11-19 06:14:10.229	rooftop-default-main	cmwn5n9d4009l7ds3u1uxx32h	\N	receipt	12	12	0	0	Opening stock	Onboarding	{"partId": "cmwn5n9d4009l7ds3u1uxx32h", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 12, "reference": "Opening stock", "partNumber": "BP-CER-F1024", "onHandAfter": 12, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 12, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.229	onboarding:rooftop-default-main:part-opening-stock:BP-CER-F1024
cmwn5n9el009x7ds3in2vrnf2	2026-11-19 06:14:10.269	2026-11-19 06:14:10.269	rooftop-default-main	cmwn5n9e9009t7ds3pn2qndxm	\N	receipt	24	24	0	0	Opening stock	Onboarding	{"partId": "cmwn5n9e9009t7ds3pn2qndxm", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 24, "reference": "Opening stock", "partNumber": "CAF-87139-YZZ08", "onHandAfter": 24, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 24, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.269	onboarding:rooftop-default-main:part-opening-stock:CAF-87139-YZZ08
cmwn5n9fm00a57ds3o25o0lpe	2026-11-19 06:14:10.307	2026-11-19 06:14:10.307	rooftop-default-main	cmwn5n9f900a17ds3ru4pkl6f	\N	receipt	20	20	0	0	Opening stock	Onboarding	{"partId": "cmwn5n9f900a17ds3ru4pkl6f", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 20, "reference": "Opening stock", "partNumber": "EAF-17220-5PA", "onHandAfter": 20, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 20, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.306	onboarding:rooftop-default-main:part-opening-stock:EAF-17220-5PA
cmwn5n9gn00ad7ds3cwkeov41	2026-11-19 06:14:10.343	2026-11-19 06:14:10.343	rooftop-default-main	cmwn5n9gb00a97ds33qkhodic	\N	receipt	8	8	0	0	Opening stock	Onboarding	{"partId": "cmwn5n9gb00a97ds33qkhodic", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 8, "reference": "Opening stock", "partNumber": "BAT-H6-AGM", "onHandAfter": 8, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 8, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.342	onboarding:rooftop-default-main:part-opening-stock:BAT-H6-AGM
cmwn5n9hk00al7ds31glcl17v	2026-11-19 06:14:10.377	2026-11-19 06:14:10.377	rooftop-default-main	cmwn5n9h800ah7ds32kgd7d3q	\N	receipt	30	30	0	0	Opening stock	Onboarding	{"partId": "cmwn5n9h800ah7ds32kgd7d3q", "reason": "Onboarding", "actorId": "cmwn5mdux00017ds3g2ngshoz", "quantity": 30, "reference": "Opening stock", "partNumber": "WB-22-HYB", "onHandAfter": 30, "movementType": "receipt", "onHandBefore": 0, "onOrderAfter": 0, "onOrderBefore": 0, "quantityDelta": 30, "committedAfter": 0, "serviceOrderId": null, "committedBefore": 0, "purchaseOrderId": null}	2026-11-19 06:14:10.376	onboarding:rooftop-default-main:part-opening-stock:WB-22-HYB
\.


--
-- Data for Name: PartsPurchaseOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PartsPurchaseOrder" (id, "createdAt", "updatedAt", rooftop, reference, supplier, status, lines, "orderedAt", "receivedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: PaymentProvider; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentProvider" (id, name, code, "isInstalled", credentials, metadata, "createPaymentFunction", "capturePaymentFunction", "refundPaymentFunction", "getPaymentStatusFunction", "generatePaymentLinkFunction", "handleWebhookFunction", "createdAt", "updatedAt") FROM stdin;
cmwn5n9xi00co7ds3qu4kh43u	Manual	pp_system_default	t	{}	{}	manual	manual	manual	manual	manual	manual	2026-11-19 06:14:10.949	2026-11-19 06:14:10.949
cmwn5n9y200cp7ds3j0nfr4s1	Stripe	pp_stripe_stripe	t	{}	{}	stripe	stripe	stripe	stripe	stripe	stripe	2026-11-19 06:14:10.97	2026-11-19 06:14:10.97
\.


--
-- Data for Name: PaymentProviderEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentProviderEvent" (id, "createdAt", "updatedAt", rooftop, transaction, refund, "providerKey", "providerEventId", "eventType", "payloadDigest", "signatureTimestamp", "receivedAt") FROM stdin;
\.


--
-- Data for Name: PaymentRefund; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentRefund" (id, "createdAt", "updatedAt", rooftop, transaction, "amountCents", reason, status, "providerRefundId", "failureCode", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: PaymentTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentTransaction" (id, "createdAt", "updatedAt", rooftop, deal, "serviceOrder", "sourceType", "amountCents", currency, "providerKey", "providerTransactionId", "providerSessionId", "checkoutUrl", status, "capturedCents", "refundedCents", "failureCode", "reconciliationReference", "reconciledAt", version, "idempotencyKey", "paymentProvider", "paymentMethod", lead) FROM stdin;
\.


--
-- Data for Name: PriceHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PriceHistory" (id, vehicle, "effectiveDate", "previousPriceCents", "newPriceCents", "changeReason", "changedBy", notes, "createdAt", "updatedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: ProgressiveOffer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProgressiveOffer" (id, "createdAt", "updatedAt", number, title, vehicle, photo_id, photo_filesize, photo_width, photo_height, photo_extension, "photoUrl", "startsAt", "startPriceCents", "stepCents", "stepEvery", "stepUnit", "stepMinutes", "floorPriceCents", status, "soldAt", financing, conditions, "includesTransfer", "noAppointment") FROM stdin;
\.


--
-- Data for Name: RepairOrderLineItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RepairOrderLineItem" (id, "serviceOrder", "itemType", description, "partNumber", quantity, "unitPriceCents", "priceCents", "costCents", "createdAt", "updatedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: ReportRun; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ReportRun" (id, "createdAt", "updatedAt", rooftop, "savedReport", status, "exportFormat", "resultSnapshot", "resultDigest", "errorCode", "completedAt", "expiresAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: RetentionPolicy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RetentionPolicy" (id, "createdAt", "updatedAt", rooftop, category, "retentionDays", "legalHold", rationale, "lastSweptAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Role" (id, name, "canSeeOtherPeople", "canEditOtherPeople", "canManagePeople", "canManageRoles", "canAccessDashboard", "canApproveDeals", "canManageDeals", "canManageFinancing", "canManageInventory", "canManageLeads", "canManageService", "canManageTradeIns", "canViewAllLeads", "canViewInventory", "canViewReports", "canManageOnboarding", "createdAt", "updatedAt", "canManageDealerships", "canManageKeys", "canManagePayments", "canManageSettings", "canManageUsers", "canReadPayments", "canReadRoles", "canReadUsers") FROM stdin;
cmwn5mdut00007ds3cvywmlzd	Administrador	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	2026-11-19 06:13:29.379	2026-11-19 06:13:29.379	t	t	t	t	t	t	t	t
cmwn5n9z500cs7ds36p9nfbin	Responsable de créditos	f	f	f	f	t	t	t	t	f	f	f	f	t	t	t	f	2026-11-19 06:14:11.009	2026-11-19 06:14:11.009	f	f	f	f	f	t	f	f
cmwn5na1000cx7ds3yfuvwra4	Administración	f	f	f	f	t	f	f	f	f	f	f	f	f	t	t	f	2026-11-19 06:14:11.075	2026-11-19 06:14:11.075	f	f	t	f	f	t	f	f
cmwn5na0n00cw7ds37pb2cdan	Repuestos	f	f	f	f	t	f	f	f	f	f	t	f	f	t	f	f	2026-11-19 06:14:11.062	2026-11-19 06:14:11.062	f	f	f	f	f	f	f	f
cmwn5n9ys00cr7ds35ziuwbh1	Vendedor	f	f	f	f	t	f	t	f	f	t	f	t	f	t	f	f	2026-11-19 06:14:10.996	2026-11-19 06:14:10.996	f	f	f	f	f	f	f	f
cmwn5n9yf00cq7ds3ww7gsnm2	Gerente de ventas	f	f	f	f	t	t	t	f	t	t	f	t	t	t	t	f	2026-11-19 06:14:10.982	2026-11-19 06:14:10.982	f	f	f	f	f	f	f	f
cmwn5n9zw00cu7ds3vf5ph150	Asesor de servicio	f	f	f	f	t	f	f	f	f	f	t	f	f	t	f	f	2026-11-19 06:14:11.035	2026-11-19 06:14:11.035	f	f	f	f	f	f	f	f
cmwn5n9zi00ct7ds3ryn8gwis	Jefe de taller	f	f	f	f	t	f	f	f	f	f	t	f	f	t	t	f	2026-11-19 06:14:11.021	2026-11-19 06:14:11.021	f	f	f	f	f	f	f	f
cmwn5na0900cv7ds3y6t14j6m	Técnico	f	f	f	f	t	f	f	f	f	f	t	f	f	t	f	f	2026-11-19 06:14:11.048	2026-11-19 06:14:11.048	f	f	f	f	f	f	f	f
\.


--
-- Data for Name: Rooftop; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Rooftop" (id, "createdAt", "updatedAt", "rooftopKey", code, name, "publicSlug", status, timezone, "currencyCode", "dealerGroup") FROM stdin;
rooftop-default-main	2026-11-19 06:13:07.046	2026-11-19 06:14:08.35	dealer-group-default:SAM-MAIN	SAM-MAIN	Elvis Automotores S.R.L.	main	active	America/Argentina/Buenos_Aires	USD	dealer-group-default
\.


--
-- Data for Name: RooftopMembership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RooftopMembership" (id, "createdAt", "updatedAt", "membershipKey", "user", rooftop, role, status, "invitedBy", "joinedAt") FROM stdin;
\.


--
-- Data for Name: SalesVisit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SalesVisit" (id, "createdAt", "updatedAt", rooftop, lead, customer, vehicle, "assignedSalesperson", manager, kind, status, "scheduledAt", "arrivedAt", "managerTurnAt", "completedAt", outcome, notes) FROM stdin;
\.


--
-- Data for Name: SavedReport; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SavedReport" (id, "createdAt", "updatedAt", rooftop, owner, name, "reportType", filters, "exportFormat", schedule, active, "nextRunAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: ServiceAppointment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceAppointment" (id, customer, "customerVehicleDescription", "appointmentDate", "serviceType", description, "estimatedDuration", "assignedTech", status, "mileageIn", "advisorNotes", "serviceOrder", lead, "createdAt", "updatedAt", rooftop, "capacitySlot", "transportationNeed", "vehicleVin", "requestedBy", "servicePackage") FROM stdin;
\.


--
-- Data for Name: ServiceLaborOperation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceLaborOperation" (id, "createdAt", "updatedAt", rooftop, "serviceOrder", "operationCode", description, status, technician, "soldHours", "actualMinutes", "timePunches", "startedAt", "completedAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: ServiceOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServiceOrder" (id, diagnosis, "workPerformed", recommendations, "laborTotalCents", "partsTotalCents", "taxCents", "grandTotalCents", status, "completedAt", "createdAt", "updatedAt", "lockedAt", "settledAt", "evidenceSnapshot", rooftop, "authorizationEvidence", "authorizationStatus", cause, concern, correction, "declinedWork", "inspectionEvidence", "invoiceNumber", "payType") FROM stdin;
\.


--
-- Data for Name: ServicePackage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ServicePackage" (id, name, description, "priceCents", "estimatedDuration", "includedServices", "createdAt", "updatedAt", rooftop) FROM stdin;
cmwn5n94x008m7ds38qwapw6d	Synthetic Oil Change	Full synthetic oil and filter change with a multi-point inspection.	8995	30	[{"service": "Synthetic Oil Change", "description": "Full synthetic oil and filter change with a multi-point inspection."}]	2026-11-19 06:14:09.918	2026-11-19 06:14:09.918	rooftop-default-main
cmwn5n95j008n7ds3f37eh215	Tire Rotation & Balance	Rotate and balance all four tires and set tire pressures.	5995	45	[{"service": "Tire Rotation & Balance", "description": "Rotate and balance all four tires and set tire pressures."}]	2026-11-19 06:14:09.939	2026-11-19 06:14:09.939	rooftop-default-main
cmwn5n964008o7ds32ps4fr2h	Front Brake Pad Replacement	Replace front brake pads, resurface or inspect rotors and road test.	24995	120	[{"service": "Front Brake Pad Replacement", "description": "Replace front brake pads, resurface or inspect rotors and road test."}]	2026-11-19 06:14:09.96	2026-11-19 06:14:09.96	rooftop-default-main
cmwn5n96q008p7ds343lxi7s2	Multi-Point Inspection	Inspection of brakes, tires, fluids, belts, hoses, battery and lights.	4995	45	[{"service": "Multi-Point Inspection", "description": "Inspection of brakes, tires, fluids, belts, hoses, battery and lights."}]	2026-11-19 06:14:09.982	2026-11-19 06:14:09.982	rooftop-default-main
cmwn5n97b008q7ds37ctk2elp	Four-Wheel Alignment	Computerized four-wheel alignment to manufacturer specifications.	12995	60	[{"service": "Four-Wheel Alignment", "description": "Computerized four-wheel alignment to manufacturer specifications."}]	2026-11-19 06:14:10.003	2026-11-19 06:14:10.003	rooftop-default-main
cmwn5n97x008r7ds3ygz8zcai	Battery Test & Replacement	Test the charging system and install a new 12V battery.	21995	45	[{"service": "Battery Test & Replacement", "description": "Test the charging system and install a new 12V battery."}]	2026-11-19 06:14:10.025	2026-11-19 06:14:10.025	rooftop-default-main
cmwn5n98g008s7ds3022i8pmv	Cabin & Engine Air Filters	Replace the cabin and engine air filters.	7995	30	[{"service": "Cabin & Engine Air Filters", "description": "Replace the cabin and engine air filters."}]	2026-11-19 06:14:10.045	2026-11-19 06:14:10.045	rooftop-default-main
cmwn5n993008t7ds3jc36q2a2	Full Detail	Hand wash, clay bar, wax, interior shampoo and leather conditioning.	24900	180	[{"service": "Full Detail", "description": "Hand wash, clay bar, wax, interior shampoo and leather conditioning."}]	2026-11-19 06:14:10.068	2026-11-19 06:14:10.068	rooftop-default-main
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Task" (id, title, description, "assignedTo", lead, priority, completed, "dueDate", "completedDate", "createdAt", "updatedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: TestDrive; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TestDrive" (id, lead, vehicle, salesperson, "scheduledTime", completed, "driverLicenseVerified", feedback, "interestedLevel", "createdAt", "updatedAt", rooftop, "requestedBy", "noShow", "cancelledAt") FROM stdin;
\.


--
-- Data for Name: TradeIn; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TradeIn" (id, vin, year, make, model, "trim", mileage, condition, "exteriorCondition", "interiorCondition", "mechanicalIssues", "kbbValueCents", "offerAmountCents", "mainPhoto_id", "mainPhoto_filesize", "mainPhoto_width", "mainPhoto_height", "mainPhoto_extension", "appraisedBy", lead, "createdAt", "updatedAt", rooftop, "photoTokenExpiresAt", "photoTokenHash") FROM stdin;
\.


--
-- Data for Name: TradeInPhoto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TradeInPhoto" (id, "createdAt", "updatedAt", rooftop, "tradeIn", image_id, image_filesize, image_width, image_height, image_extension, "sortOrder") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, email, password, role, "passwordResetIssuedAt", "passwordResetRedeemedAt", "passwordResetToken", "commissionRate", "employeeId", "isFinanceManager", "isSalesperson", "isServiceAdvisor", phone, "onboardingStatus", "createdAt", "updatedAt") FROM stdin;
cmwn5mdux00017ds3g2ngshoz	Administrador	admin@elvis.local	$2a$10$eDGi9jmtjKWERxTVFE.dRuettK5IoVWunHSHsQ2JKUgTf8VSbHK4i	cmwn5mdut00007ds3cvywmlzd	\N	\N	\N	0		f	f	f		completed	2026-11-19 06:13:29.298	2026-11-19 06:14:11.109
\.


--
-- Data for Name: Vehicle; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Vehicle" (id, vin, "stockNumber", year, make, model, "trim", "exteriorColor", "interiorColor", mileage, "purchasePriceCents", "listPriceCents", "priceCents", condition, status, description, features, metadata, history, "createdAt", "updatedAt", rooftop, engine, "fuelType", "isFeatured", transmission) FROM stdin;
cmwn5n8mu000v7ds3sa4npbgr	8AXK2DEG0D9PCF43E	EA-101	2021	BMW	530i	M Sport	Negro	Negro	48200	4666500000	5490000000	5490000000	used	available	Sedán premium con paquete M Sport, asistencias a la conducción e historial de service al día. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["Paquete M Sport", "Navegador", "Asientos calefaccionados", "Sensores de estacionamiento"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:8AXK2DEG0D9PCF43E", "sourceReference": "onboarding", "acquisitionSource": "trade-in"}}	\N	2026-11-19 06:14:09.27	2026-11-19 06:14:09.344	rooftop-default-main	2.0 Turbo	nafta	t	automatica
cmwn5n8qc001f7ds30tli48hk	8A4DHRD2DRCJV3KHW	EA-102	2020	Toyota	Camry	XSE	Gris claro	Negro	62400	3306500000	3890000000	3890000000	used	available	Sedán mediano con suspensión deportiva, cargador inalámbrico y audio JBL. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["Audio JBL", "Cargador inalámbrico", "Monitor de punto ciego"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:8A4DHRD2DRCJV3KHW", "sourceReference": "onboarding", "acquisitionSource": "trade-in"}}	\N	2026-11-19 06:14:09.397	2026-11-19 06:14:09.444	rooftop-default-main	2.5	nafta	t	automatica
cmwn5n8s9001z7ds332vylq2q	8AN0GEDP84X660WSM	EA-103	2022	Honda	CR-V	Touring	Azul	Negro	35100	3952500000	4650000000	4650000000	used	available	SUV híbrida con tracción integral, techo solar y asistentes de manejo Honda Sensing. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["Honda Sensing", "Techo solar", "Tracción integral"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:8AN0GEDP84X660WSM", "sourceReference": "onboarding", "acquisitionSource": "trade-in"}}	\N	2026-11-19 06:14:09.466	2026-11-19 06:14:09.486	rooftop-default-main	2.0 Híbrido	hibrido	t	automatica
cmwn5n8tf002j7ds3g2w2c8uk	8AW8Y5VEH93LYK83C	EA-104	2019	Honda	Accord	Sport	Blanco	Negro	71800	2541500000	2990000000	2990000000	used	available	Sedán amplio y confiable, ideal para familia, con pantalla táctil y cámara de retroceso. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["Cámara de retroceso", "Pantalla táctil", "Control crucero"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:8AW8Y5VEH93LYK83C", "sourceReference": "onboarding", "acquisitionSource": "trade-in"}}	\N	2026-11-19 06:14:09.507	2026-11-19 06:14:09.507	rooftop-default-main	1.5 Turbo	nafta	f	automatica
cmwn5n8un00337ds3e0hyldf6	8AYZ86EFU7EDW5V1Z	EA-105	2018	Mercedes-Benz	C 300	Avantgarde	Gris	Negro	83500	2847500000	3350000000	3350000000	used	available	Sedán de lujo con interior en cuero y equipamiento completo. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["Tapizado de cuero", "Climatizador bizona", "Llantas de aleación"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:8AYZ86EFU7EDW5V1Z", "sourceReference": "onboarding", "acquisitionSource": "trade-in"}}	\N	2026-11-19 06:14:09.551	2026-11-19 06:14:09.551	rooftop-default-main	2.0 Turbo	nafta	f	automatica
cmwn5n8vt003n7ds36ndp65mb	8AZLH8DPVJS228FL5	EA-106	2017	Ford	Mustang	GT	Rojo	Negro	59800	4496500000	5290000000	5290000000	used	available	Deportivo icónico con motor V8 y caja manual de 6 marchas. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["Motor V8", "Escape deportivo", "Modo de manejo seleccionable"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:8AZLH8DPVJS228FL5", "sourceReference": "onboarding", "acquisitionSource": "trade-in"}}	\N	2026-11-19 06:14:09.593	2026-11-19 06:14:09.593	rooftop-default-main	5.0 V8	nafta	f	manual
cmwn5n8wp00477ds3jfwp8wyn	9BJ4U3Z1RKFMKRRA8	EA-201	2026	Peugeot	208	Allure	Blanco	Negro	0	2475000000	2750000000	2750000000	new	available	Peugeot 208 Allure 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9BJ4U3Z1RKFMKRRA8", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.625	2026-11-19 06:14:09.625	rooftop-default-main	1.6	nafta	f	manual
cmwn5n8xq004r7ds309fmvwwt	9BVAK30XJ9D62222G	EA-202	2026	Fiat	Cronos	Drive 1.3	Gris	Negro	0	2241000000	2490000000	2490000000	new	available	Fiat Cronos Drive 1.3 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9BVAK30XJ9D62222G", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.663	2026-11-19 06:14:09.663	rooftop-default-main	1.3	nafta	f	manual
cmwn5n8yp005b7ds3yri6d7y2	9BDNEP5LHYDGAKG0B	EA-203	2026	Volkswagen	Amarok	Highline V6	Negro	Negro	0	6561000000	7290000000	7290000000	new	available	Volkswagen Amarok Highline V6 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9BDNEP5LHYDGAKG0B", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.697	2026-11-19 06:14:09.697	rooftop-default-main	3.0 V6 TDI	diesel	f	automatica
cmwn5n8zq005v7ds34ku8k4zf	9B1KTZ07HH8677WFK	EA-204	2026	Renault	Kardian	Evolution	Rojo	Negro	0	2682000000	2980000000	2980000000	new	available	Renault Kardian Evolution 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9B1KTZ07HH8677WFK", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.734	2026-11-19 06:14:09.734	rooftop-default-main	1.6	nafta	f	manual
cmwn5n90v006f7ds3i3bn2uwz	9BT7LBP0KBWFT0LZR	EA-205	2026	Toyota	Hilux	SRV 4x4	Plata	Negro	0	5805000000	6450000000	6450000000	new	available	Toyota Hilux SRV 4x4 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9BT7LBP0KBWFT0LZR", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.776	2026-11-19 06:14:09.776	rooftop-default-main	2.8 TD	diesel	f	automatica
cmwn5n91y006z7ds3s100xzir	9BRNS2RN8ZBBU7TNZ	EA-206	2026	Chevrolet	Tracker	LTZ	Azul	Negro	0	3051000000	3390000000	3390000000	new	available	Chevrolet Tracker LTZ 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9BRNS2RN8ZBBU7TNZ", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.814	2026-11-19 06:14:09.814	rooftop-default-main	1.2 Turbo	nafta	f	automatica
cmwn5n930007j7ds3kkjpr2nm	9B0FRGR7NYP7A7ZFH	EA-207	2026	Chery	Tiggo 4	Luxury	Gris oscuro	Negro	0	2583000000	2870000000	2870000000	new	available	Chery Tiggo 4 Luxury 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9B0FRGR7NYP7A7ZFH", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.852	2026-11-19 06:14:09.852	rooftop-default-main	1.5	nafta	f	automatica
cmwn5n93w00837ds338sllg5v	9B7M4YF262FLLJBK6	EA-208	2026	Citroën	C3	Feel Pack	Blanco	Negro	0	2151000000	2390000000	2390000000	new	available	Citroën C3 Feel Pack 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo.	["0 km", "Garantía oficial de fábrica"]	{"provenance": {"mode": "onboarding-ready", "intakeEventKey": "inventory-intake:rooftop-default-main:onboarding:9B7M4YF262FLLJBK6", "sourceReference": "onboarding", "acquisitionSource": "oem-distributor"}}	\N	2026-11-19 06:14:09.885	2026-11-19 06:14:09.885	rooftop-default-main	1.6	nafta	f	manual
\.


--
-- Data for Name: VehicleConditionReport; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VehicleConditionReport" (id, vehicle, "reportDate", inspector, "overallCondition", "mechanicalRating", "bodyRating", "interiorRating", issues, "estimatedRepairs", notes, "createdAt", "updatedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: VehicleHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VehicleHistory" (id, "acquisitionDate", "acquisitionSource", "previousOwners", "hasAccidents", "accidentDetails", "serviceRecords", "titleStatus", notes, "createdAt", "updatedAt", rooftop) FROM stdin;
\.


--
-- Data for Name: VehicleImage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VehicleImage" (id, vehicle, image_id, image_filesize, image_width, image_height, image_extension, caption, category, "sortOrder", "isPrimary", "imagePath", "createdAt", "updatedAt", rooftop) FROM stdin;
cmwn5n8n2000x7ds3f9xbabuo	cmwn5n8mu000v7ds3sa4npbgr	\N	\N	\N	\N	\N	2021 BMW 530i	exterior	0	t	/images/vehicles/smc-2401.jpg	2026-11-19 06:14:09.278	2026-11-19 06:14:09.278	rooftop-default-main
cmwn5n8ql001h7ds3kcgoct75	cmwn5n8qc001f7ds30tli48hk	\N	\N	\N	\N	\N	2020 Toyota Camry	exterior	0	t	/images/vehicles/smc-2404.jpg	2026-11-19 06:14:09.405	2026-11-19 06:14:09.405	rooftop-default-main
cmwn5n8sb00217ds33mcctt5t	cmwn5n8s9001z7ds332vylq2q	\N	\N	\N	\N	\N	2022 Honda CR-V	exterior	0	t	/images/vehicles/smc-2405.jpg	2026-11-19 06:14:09.467	2026-11-19 06:14:09.467	rooftop-default-main
cmwn5n8ti002l7ds3tq4r53qb	cmwn5n8tf002j7ds3g2w2c8uk	\N	\N	\N	\N	\N	2019 Honda Accord	exterior	0	t	/images/vehicles/smc-2406.jpg	2026-11-19 06:14:09.51	2026-11-19 06:14:09.51	rooftop-default-main
cmwn5n8up00357ds3qzxjy3mi	cmwn5n8un00337ds3e0hyldf6	\N	\N	\N	\N	\N	2018 Mercedes-Benz C 300	exterior	0	t	/images/vehicles/smc-2409.jpg	2026-11-19 06:14:09.554	2026-11-19 06:14:09.554	rooftop-default-main
cmwn5n8vv003p7ds36ef6n5ne	cmwn5n8vt003n7ds36ndp65mb	\N	\N	\N	\N	\N	2017 Ford Mustang	exterior	0	t	/images/vehicles/smc-2412.jpg	2026-11-19 06:14:09.595	2026-11-19 06:14:09.595	rooftop-default-main
cmwn5n8wr00497ds30xfr3rrr	cmwn5n8wp00477ds3jfwp8wyn	\N	\N	\N	\N	\N	2026 Peugeot 208	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.627	2026-11-19 06:14:09.627	rooftop-default-main
cmwn5n8xs004t7ds32n6hdr2y	cmwn5n8xq004r7ds309fmvwwt	\N	\N	\N	\N	\N	2026 Fiat Cronos	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.665	2026-11-19 06:14:09.665	rooftop-default-main
cmwn5n8ys005d7ds3d8dxyfak	cmwn5n8yp005b7ds3yri6d7y2	\N	\N	\N	\N	\N	2026 Volkswagen Amarok	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.7	2026-11-19 06:14:09.7	rooftop-default-main
cmwn5n8zs005x7ds35qtmhq0k	cmwn5n8zq005v7ds34ku8k4zf	\N	\N	\N	\N	\N	2026 Renault Kardian	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.736	2026-11-19 06:14:09.736	rooftop-default-main
cmwn5n90x006h7ds38y0c8vhv	cmwn5n90v006f7ds3i3bn2uwz	\N	\N	\N	\N	\N	2026 Toyota Hilux	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.777	2026-11-19 06:14:09.777	rooftop-default-main
cmwn5n91z00717ds3yt04gmfq	cmwn5n91y006z7ds3s100xzir	\N	\N	\N	\N	\N	2026 Chevrolet Tracker	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.816	2026-11-19 06:14:09.816	rooftop-default-main
cmwn5n931007l7ds3vyvntvsi	cmwn5n930007j7ds3kkjpr2nm	\N	\N	\N	\N	\N	2026 Chery Tiggo 4	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.854	2026-11-19 06:14:09.854	rooftop-default-main
cmwn5n93y00857ds3psgnfsmc	cmwn5n93w00837ds338sllg5v	\N	\N	\N	\N	\N	2026 Citroën C3	exterior	0	t	/images/vehicles/foto-proximamente.jpg	2026-11-19 06:14:09.886	2026-11-19 06:14:09.886	rooftop-default-main
\.


--
-- Data for Name: WeOweItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WeOweItem" (id, "createdAt", "updatedAt", rooftop, "deliveryCase", description, status, "promisedAt", owner, "estimatedCostCents", "fulfillmentEvidence", "customerAcknowledgment", "fulfilledAt", "idempotencyKey") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
827024d5-5265-4bb7-9af5-df3d810c88da	f3f806c6ef7c03a2886525bbae4a0f3fe99796879599f43e5e2f342946523dc8	2026-11-19 06:13:07.291344+00	20260730015000_dealership_release_constraints	\N	\N	2026-11-19 06:13:07.289764+00	1
ad88cdb7-5f17-4757-9fcb-8bea945825f1	9d5671a110306364e3e4e8b71f59c67024c58ab187db0be28f0b429a3cd4fdf7	2026-11-19 06:13:06.916297+00	20250529211349_initial_migration	\N	\N	2026-11-19 06:13:06.909185+00	1
96b1bb1b-6043-45d5-a65a-b1c2786f47c7	270a1895b3bd7250cd19423811b3445dbeb5e11372de858f1056e3005dac0c1e	2026-11-19 06:13:06.993493+00	20260710193000_dealership_profile	\N	\N	2026-11-19 06:13:06.990835+00	1
d3731c30-eeb2-43e2-8864-ab9b2df954e2	2fb35ac573fe9e0e8d0c67cc07d38859d87f99d10eebe94d6aea73a8e9af05d5	2026-11-19 06:13:06.917953+00	20250618162316_add_description_field_to_todo	\N	\N	2026-11-19 06:13:06.91665+00	1
27212768-9198-432a-ad78-5621add98d6e	7956c4ddbe9987f1181d0203900f0258e155a7340df3d4af850cdd0d60d0aec1	2026-11-19 06:13:06.919952+00	20250621232051_add_all_fields	\N	\N	2026-11-19 06:13:06.918303+00	1
7e3f78b5-5b98-47ff-a7cd-64e3c0b970c7	ca90bbb06973eed04e52119ad138cebc6bd12daa94a14bc795b3396196f15dad	2026-11-19 06:13:07.182489+00	20260729083725_dealership_crm_identity_gate9	\N	\N	2026-11-19 06:13:07.162416+00	1
1c18d331-7d9e-4bc7-ab97-65a6cdaa748a	7ccf4b8c6313790d42366e629ae37351846a084af3876729635d5a2f843309ff	2026-11-19 06:13:06.921521+00	20250704004833_add_image_field	\N	\N	2026-11-19 06:13:06.920238+00	1
61f733a3-dce9-4a97-9337-c0dd25b7808a	bbf35bc760a0e4418a80028def48745183bb8f11183946b435350e2024cade83	2026-11-19 06:13:07.013209+00	20260717214525_dealership_evidence_integrity	\N	\N	2026-11-19 06:13:06.993847+00	1
00223ea9-d070-46a4-b727-e91ba807baf6	50cbdb57d00d9e72fe6cb9f2e886e7eb4d60f09aa359781e991e007c09629970	2026-11-19 06:13:06.92619+00	20250704011715_make_todoimage_a_separate_model	\N	\N	2026-11-19 06:13:06.921873+00	1
2273d528-e93c-4ef2-b528-2e5d52fd0ab5	4cdcc9e3493c99b1ef3770aed81c552edb99cc8e32d32eaa09d28079ec57ad05	2026-11-19 06:13:06.927808+00	20250806014640_update_user_to_include_reset_token_field	\N	\N	2026-11-19 06:13:06.926508+00	1
a985af53-9d8d-47da-a049-3913f6819d96	476c85671cd65f9e04081421f3e1d3605090b12b0529e5775a7b17190195ec76	2026-11-19 06:13:06.929388+00	20250815215522_add_multi_select_field_to_todo_model	\N	\N	2026-11-19 06:13:06.92816+00	1
daaa4235-dc04-47ad-a075-25b486cfd912	a967cef15d7634349fed7c5c7617681ca16471415bdd0052f0f02657f061b4a7	2026-11-19 06:13:07.02552+00	20260717222056_dealership_financing_integrity	\N	\N	2026-11-19 06:13:07.013537+00	1
0374bf02-b04d-4362-821b-9572b33aca58	1f3e672125e80149f39933ba313fa31faaadbbcc4974186fc56e9cfcd0388e0f	2026-11-19 06:13:06.972774+00	20260507173216_y	\N	\N	2026-11-19 06:13:06.929751+00	1
613eb8df-6b1f-425e-ab4d-49a1d164ff0e	05094e21d286da16bbd2d8c6485034590678e0d2c5a843bc607a3fa37980381e	2026-11-19 06:13:06.974607+00	20260708123000_dealership_onboarding_fields	\N	\N	2026-11-19 06:13:06.973106+00	1
ac96ee54-3825-41c3-ad89-9c8feb8642d6	aba2e4c938ee98347cbe9df16c3535cc87e5eea92f2297dc2ca6bc7f6cc96941	2026-11-19 06:13:07.231661+00	20260729232145_dealership_finance_product_evidence_gate11	\N	\N	2026-11-19 06:13:07.222621+00	1
78a43355-ef0b-431e-8f04-038fcf3c93bd	dc3001dc447fbc72ca0461eafb3ab5d35d4947786705fbad52237c9763a55f3a	2026-11-19 06:13:06.976174+00	20260709120000_vehicle_image_path	\N	\N	2026-11-19 06:13:06.974941+00	1
1bda7109-46a6-41ad-b6d0-7e8127b37369	5f8c76e708925c7c24ef958fa115a5ccd0c8501d655930da1c61540d03ed3747	2026-11-19 06:13:07.045492+00	20260718134632_dealership_rooftop_tenancy_foundation	\N	\N	2026-11-19 06:13:07.025826+00	1
2396a1b5-71e6-4f5f-8cdf-15d6341aab40	cb76dc32c643ebe977595174c293bf7079f28b760d44b71c609a513318704ccd	2026-11-19 06:13:06.978564+00	20260710123000_trade_in_lead	\N	\N	2026-11-19 06:13:06.976462+00	1
2f103251-4c01-4bb5-a784-75e66cf74775	48b1f1b4645024bc48c16ed63ca019b9091e862bb375db681bcd734fa720a6ad	2026-11-19 06:13:06.981002+00	20260710143000_service_appointment_lead	\N	\N	2026-11-19 06:13:06.978911+00	1
85f3f331-2a2a-4244-a582-8c48831e6157	009cb83507a286d298f6eec2cabac0c9c9b79d3a13b1c348684ad42d0500751b	2026-11-19 06:13:07.198212+00	20260729205226_dealership_crm_engagement_gate9	\N	\N	2026-11-19 06:13:07.182828+00	1
e856c479-e1b1-48ec-adc2-1f96b56cc662	d54f7087354146ad0f99c26cfd32dc0e73327f493653464cdb0edbd203696645	2026-11-19 06:13:06.990499+00	20260710190000_domain_tracking_fields	\N	\N	2026-11-19 06:13:06.981417+00	1
a3765c20-4507-4079-b33b-39d414fc2ab9	f03e7788f98ea7ba91000f03be51337e5ab87ec6d3c5f454ccce3d8faf99bc3e	2026-11-19 06:13:07.067659+00	20260718152836_dealership_rooftop_operational_scope	\N	\N	2026-11-19 06:13:07.045899+00	1
9e6ced13-e8bd-400a-9a32-4c80dce14c6e	e4cf85589f33b8918d72fb420e575ca32cfbe9eb37d9fa436c6f03003bd12cfc	2026-11-19 06:13:07.077212+00	20260718155046_dealership_inventory_acquisition_workflow	\N	\N	2026-11-19 06:13:07.067993+00	1
4abb4aff-706d-4401-9a2f-e25c302446c2	55f8a3f18743d389d7f372d546a12da61122a9ff67f666f8e056792c002a378c	2026-11-19 06:13:07.088161+00	20260719125316_dealership_domain_events_and_outbox	\N	\N	2026-11-19 06:13:07.077536+00	1
9826ba18-1a89-47be-925d-9118a26b6f34	35ef39cc6f7d2da8b2cfc4edd976388ee184a8278fc4ae9adbd4e92f90a7759a	2026-11-19 06:13:07.200789+00	20260729211543_dealership_desking_gate10	\N	\N	2026-11-19 06:13:07.198555+00	1
69b54804-dd71-4cad-b207-87ba2b01c59a	4a2ee979a36903e10421a98fe4bfef7dbcf36803a29e917786368a60d41a11c4	2026-11-19 06:13:07.162013+00	20260719164251_dealership_inventory_operations_gate8	\N	\N	2026-11-19 06:13:07.088597+00	1
350433f2-5d6a-4833-8d3e-204c6d9c7d44	0ac30282fab9efcd2abeab6b522a97bfd4fc3f16eacdc5d901add965fa2ae535	2026-11-19 06:13:07.26606+00	20260730002214_dealership_accounting_gate14	\N	\N	2026-11-19 06:13:07.256337+00	1
e2f11865-9784-4903-8169-d6606b37e0ab	4826409658a01f2a71c62009147ffa6f0fb358be727a3bf7aa9e71b06a187d8f	2026-11-19 06:13:07.204026+00	20260729223904_dealership_desking_lender_gate10	\N	\N	2026-11-19 06:13:07.201171+00	1
7783ad9a-dadc-44e2-b041-c5120d88ffa9	a83b2f228f41a45633b2e3e6b05a6caf0276826653e1f21f324daa8b065755df	2026-11-19 06:13:07.242139+00	20260729234009_dealership_delivery_we_owe_gate12	\N	\N	2026-11-19 06:13:07.231997+00	1
5c3ce87d-7aaa-4e73-91ef-12a7e27f8bc2	b68cf7b0aa86a223537feed8d5738a6a6aaec95a8aaba6616688c03a80acd294	2026-11-19 06:13:07.222279+00	20260729230200_dealership_finance_operations_gate11	\N	\N	2026-11-19 06:13:07.204449+00	1
9e3bd41b-93c1-43f7-b5ed-86768fc72435	cb599bf310bbc34db27a40e78bae3f792b37883423c69ec5bc340a2bcf83204f	2026-11-19 06:13:07.255985+00	20260729235836_dealership_fixed_ops_gate13	\N	\N	2026-11-19 06:13:07.242587+00	1
1cd0fa00-872e-48e4-8a9c-2f2051691319	9b509da8be45046e9bf57c6e432d2f3e31348d38c735b3fc6bf85e4bfca023e6	2026-11-19 06:13:07.289476+00	20260730011921_dealership_reporting_release_gate15	\N	\N	2026-11-19 06:13:07.279807+00	1
00b5655b-c4fa-4b9c-9e78-136c635f3245	09c1b317d2beb959c30d88971332523020b5205ea0600107256291285f54062b	2026-11-19 06:13:07.279483+00	20260730010024_dealership_payments_gate14	\N	\N	2026-11-19 06:13:07.266421+00	1
23d0fc04-4a7b-45ed-acb0-6b8221d9d35e	33e47f8b5def9532905b8b4a69b2ba342568a1354dabb38d118c9b2632f4c935	2026-11-19 06:13:07.293899+00	20260730020000_optional_employee_identity	\N	\N	2026-11-19 06:13:07.29167+00	1
b073dbf6-0dea-4f38-b0a3-24db76338223	8d2307e6d6720405ab5c40257ede9fc5b6f3acc33d289bfcb7670056605b55c5	2026-11-19 06:13:07.297633+00	20260730023000_authentication_throttle	\N	\N	2026-11-19 06:13:07.294277+00	1
2ba9eb91-f3d2-406f-9eb9-20cda936ec4b	dcfb757da249d1f6907d78fc131bc78e3f6936d6ad6422a14ee0854f7f53cf4d	2026-11-19 06:13:07.299634+00	20260730024500_authentication_throttle_cleanup_index	\N	\N	2026-11-19 06:13:07.297914+00	1
bb5c655a-aa75-4d04-9b6f-5213f9dfef5a	f7a83a640f380e64851c5aab69c04d89f68d630a27b166de7e792dcecd58c191	2026-11-19 06:13:07.304712+00	20260804031117_batch3_dealersocket_remediation	\N	\N	2026-11-19 06:13:07.299932+00	1
1bde607f-15dc-46d0-8743-0b6c0e7bf21d	da3c82fbe87c00caa772d4c08a8744978cfd72a0f1b61986f76f88a5fd3403d8	2026-11-19 06:13:07.306238+00	20260912131800_dealership_profile_settings_defaults	\N	\N	2026-11-19 06:13:07.305052+00	1
1905d48e-be66-42ea-87dc-c491fde71d58	147e2ab9b4b52273e5ad98d8bff10c45e447e3ad69505bfff58ddaae3eddcfeb	2026-11-20 02:43:34.277863+00	20261120120000_elvis_timezone_ar	\N	\N	2026-11-20 02:43:33.784947+00	1
7f75bb36-7240-4db5-8762-6f78989715e8	36ed8eb58c1240d5538660c1c4a696c3c4b1ce909dc3afdae4a5c7f22027ad59	2026-11-19 06:13:07.311227+00	20260923081657_dealership_inventory_publication_revision_gate16	\N	\N	2026-11-19 06:13:07.3069+00	1
11200831-e02c-47b8-b0e6-38c53c0ac8f6	f56e5d7ff7020d15f087e3e3fae09f618f9987e2405879fefb6bab4a95bee6fb	2026-11-19 06:13:07.363421+00	20261107180000_dealership_record_invariants	\N	\N	2026-11-19 06:13:07.356358+00	1
e7aac471-d7ef-43cb-9c4d-b3b255dbf64a	e0b7404d2b7f7780a9aad27781db53c55c4a1a46134d4a25fdf82527bec12a5a	2026-11-19 06:13:07.318653+00	20260923101500_dealership_publication_invalidation_triggers	\N	\N	2026-11-19 06:13:07.316323+00	1
00420a48-da8c-4833-b90c-9655d85d7bf6	cb27b11f7a4a14b43bac806d317b72071f26d739061fdd1a4d643e283b6df295	2026-11-19 06:13:07.320829+00	20261019001500_authentication_throttle_tracking	\N	\N	2026-11-19 06:13:07.319131+00	1
0145b8e0-35de-4c19-a82b-10ce81fd72ee	c16638eeeba5837a57452257f3f47b811f89e91afb72c41cc03590f6f5e6b3be	2026-11-19 06:13:07.324974+00	20261019002500_customer_request_ownership	\N	\N	2026-11-19 06:13:07.321149+00	1
2a4f5343-a351-4c77-8161-72e5acfdc815	43346fc98d8252ffae241b503da3f6ced6359afc3ea1fec24d52fd13a9784102	2026-11-19 06:13:07.367138+00	20261109200000_drop_domain_outbox_event	\N	\N	2026-11-19 06:13:07.363917+00	1
015acb8b-679b-459b-8495-713ced2b6ea8	da48b8a086999b8e4fd7fe83384ec494f932d398496b4a7b01d1815d7755f9d0	2026-11-19 06:13:07.335328+00	20261021120000_platform_parity_api_keys_payment_providers	\N	\N	2026-11-19 06:13:07.325395+00	1
8bea2e81-0d39-43de-9aea-5e8a4a88abcc	aebf021a1fb2adfb13257e96eeaff3ad9408263e428a3ca9ca9aef7dd48389b0	2026-11-19 06:13:07.337199+00	20261023120000_deal_tax_defaults	\N	\N	2026-11-19 06:13:07.335725+00	1
71ad623d-0ed8-41a7-9009-18c7c0a7d18a	ba9f980a7d311d18d8988fccfce9cb90da87b0c08014389374ad4f00d48af391	2026-11-19 06:13:07.338833+00	20261023121000_test_drive_no_show	\N	\N	2026-11-19 06:13:07.337555+00	1
975799d8-e1f7-432d-aa88-855b820444ac	0e4a210dda263d7b3802a643e34f9569abdda66a1ce4c111dab0ace9f1a746eb	2026-11-19 06:13:07.369057+00	20261119120000_elvis_whatsapp	\N	\N	2026-11-19 06:13:07.367623+00	1
ecf0b649-83f9-47a3-8347-fe254d357095	ebe49f1a4cb4c1fd151344fed20e9c9ca4e425411e96710ba8d5f2dea3b1939a	2026-11-19 06:13:07.342992+00	20261024190000_storefront_customer_depth	\N	\N	2026-11-19 06:13:07.339221+00	1
93231598-ff23-46a3-86ce-d10cf45f770a	81c2b8204228cb1f46ab37bc4370b75ce5c4f9aa5c3d470987fb643a0c7c0ff3	2026-11-19 06:13:07.345141+00	20261024200000_payment_method_and_provider_keys	\N	\N	2026-11-19 06:13:07.343306+00	1
fef2dd6f-26bf-4e7f-8e73-333f2ea1000d	6fc539908b7d81c42b2e81e8ac52390c990c24afd5358843551ec10be51e0da5	2026-11-19 06:13:07.347399+00	20261028140000_payment_event_provider_keys	\N	\N	2026-11-19 06:13:07.345571+00	1
ffc0c0fa-a129-4d29-b6c7-2aaffb46a830	2d644593ad2b4458c7920f3bda0e22dbe469b5a2bdaf02a82306415814f4e4d1	2026-11-19 06:13:07.370978+00	20261119130000_elvis_vehicle_specs	\N	\N	2026-11-19 06:13:07.369482+00	1
6b645d87-7a79-4573-aefb-217b88d76681	3ef0ff6b4924a9a5b21193123a3fda9fc268558e9dfea77fa1a2b9edcd1c4b3e	2026-11-19 06:13:07.353554+00	20261102170000_vehicle_reservation_deposit	\N	\N	2026-11-19 06:13:07.348217+00	1
314b11f3-b678-4e14-8b8e-648f5c771715	0c1c33f54761f71dd0c1358a3ab877e9505fc407ed3eeeb3e0dbe6366515b73c	2026-11-19 06:13:07.355913+00	20261106040000_vehicle_status_keeps_listing_approval	\N	\N	2026-11-19 06:13:07.353997+00	1
736aa987-d3cf-49c5-a149-d31919de4061	7e664ff2f8f32393768086a5eb1553acd855143bc7f7710e736b10658d3fb4c1	2026-11-19 06:13:07.375738+00	20261119140000_elvis_trade_in_photos	\N	\N	2026-11-19 06:13:07.371366+00	1
827e6273-3924-4e89-bb8a-195783812c04	1d6cb4e2fd505404e0ae58b450a1434c4017a50153a59bd0b7c989c9036eba61	2026-11-19 06:13:07.460859+00	20261119150000_elvis_money_64bit	\N	\N	2026-11-19 06:13:07.376101+00	1
e6e850a4-4f7d-411b-a2b4-e7d5eca24884	95805f414b0771836f23ccccc2f143ef32bd6fa7f688a851c269b294140b64a1	2026-11-19 06:13:07.467526+00	20261119160000_elvis_financing_plans	\N	\N	2026-11-19 06:13:07.461345+00	1
854cd89f-7eb0-4abf-82c1-c8fc94b3026a	61d57623d588a0625adf45606482c3201d2b0815180568ed7029c1ea784289ab	2026-11-19 06:13:07.471991+00	20261119170000_elvis_progressive_offers	\N	\N	2026-11-19 06:13:07.467848+00	1
\.


--
-- Name: AccountingBatch AccountingBatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountingBatch"
    ADD CONSTRAINT "AccountingBatch_pkey" PRIMARY KEY (id);


--
-- Name: AccountingMapping AccountingMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountingMapping"
    ADD CONSTRAINT "AccountingMapping_pkey" PRIMARY KEY (id);


--
-- Name: AccountingProviderResponse AccountingProviderResponse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountingProviderResponse"
    ADD CONSTRAINT "AccountingProviderResponse_pkey" PRIMARY KEY (id);


--
-- Name: ApiKey ApiKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_pkey" PRIMARY KEY (id);


--
-- Name: AuthenticationThrottle AuthenticationThrottle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuthenticationThrottle"
    ADD CONSTRAINT "AuthenticationThrottle_pkey" PRIMARY KEY (id);


--
-- Name: Bank Bank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bank"
    ADD CONSTRAINT "Bank_pkey" PRIMARY KEY (id);


--
-- Name: CustomerContactPreferenceEvent CustomerContactPreferenceEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerContactPreferenceEvent"
    ADD CONSTRAINT "CustomerContactPreferenceEvent_pkey" PRIMARY KEY (id);


--
-- Name: CustomerHousehold CustomerHousehold_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerHousehold"
    ADD CONSTRAINT "CustomerHousehold_pkey" PRIMARY KEY (id);


--
-- Name: CustomerInteraction CustomerInteraction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerInteraction"
    ADD CONSTRAINT "CustomerInteraction_pkey" PRIMARY KEY (id);


--
-- Name: CustomerMergeEvent CustomerMergeEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerMergeEvent"
    ADD CONSTRAINT "CustomerMergeEvent_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: DealApproval DealApproval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealApproval"
    ADD CONSTRAINT "DealApproval_pkey" PRIMARY KEY (id);


--
-- Name: Deal Deal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_pkey" PRIMARY KEY (id);


--
-- Name: DealerGroupMembership DealerGroupMembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealerGroupMembership"
    ADD CONSTRAINT "DealerGroupMembership_pkey" PRIMARY KEY (id);


--
-- Name: DealerGroup DealerGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealerGroup"
    ADD CONSTRAINT "DealerGroup_pkey" PRIMARY KEY (id);


--
-- Name: DealershipProfile DealershipProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealershipProfile"
    ADD CONSTRAINT "DealershipProfile_pkey" PRIMARY KEY (id);


--
-- Name: DeliveryCase DeliveryCase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryCase"
    ADD CONSTRAINT "DeliveryCase_pkey" PRIMARY KEY (id);


--
-- Name: DomainAuditEvent DomainAuditEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DomainAuditEvent"
    ADD CONSTRAINT "DomainAuditEvent_pkey" PRIMARY KEY (id);


--
-- Name: FinanceComplianceCheck FinanceComplianceCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceComplianceCheck"
    ADD CONSTRAINT "FinanceComplianceCheck_pkey" PRIMARY KEY (id);


--
-- Name: FinanceContractPackage FinanceContractPackage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceContractPackage"
    ADD CONSTRAINT "FinanceContractPackage_pkey" PRIMARY KEY (id);


--
-- Name: FinanceFundingCase FinanceFundingCase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceFundingCase"
    ADD CONSTRAINT "FinanceFundingCase_pkey" PRIMARY KEY (id);


--
-- Name: FinanceMenuVersion FinanceMenuVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceMenuVersion"
    ADD CONSTRAINT "FinanceMenuVersion_pkey" PRIMARY KEY (id);


--
-- Name: FinanceProductCancellation FinanceProductCancellation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductCancellation"
    ADD CONSTRAINT "FinanceProductCancellation_pkey" PRIMARY KEY (id);


--
-- Name: FinanceProductQuote FinanceProductQuote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductQuote"
    ADD CONSTRAINT "FinanceProductQuote_pkey" PRIMARY KEY (id);


--
-- Name: FinanceProduct FinanceProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProduct"
    ADD CONSTRAINT "FinanceProduct_pkey" PRIMARY KEY (id);


--
-- Name: FinancingApplication FinancingApplication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinancingApplication"
    ADD CONSTRAINT "FinancingApplication_pkey" PRIMARY KEY (id);


--
-- Name: FinancingPlan FinancingPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinancingPlan"
    ADD CONSTRAINT "FinancingPlan_pkey" PRIMARY KEY (id);


--
-- Name: InventoryAcquisitionEvent InventoryAcquisitionEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisitionEvent"
    ADD CONSTRAINT "InventoryAcquisitionEvent_pkey" PRIMARY KEY (id);


--
-- Name: InventoryAcquisition InventoryAcquisition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisition"
    ADD CONSTRAINT "InventoryAcquisition_pkey" PRIMARY KEY (id);


--
-- Name: InventoryFeedError InventoryFeedError_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryFeedError"
    ADD CONSTRAINT "InventoryFeedError_pkey" PRIMARY KEY (id);


--
-- Name: InventoryFeedRun InventoryFeedRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryFeedRun"
    ADD CONSTRAINT "InventoryFeedRun_pkey" PRIMARY KEY (id);


--
-- Name: InventoryMerchandisingVersion InventoryMerchandisingVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryMerchandisingVersion"
    ADD CONSTRAINT "InventoryMerchandisingVersion_pkey" PRIMARY KEY (id);


--
-- Name: InventoryReconWorkItem InventoryReconWorkItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReconWorkItem"
    ADD CONSTRAINT "InventoryReconWorkItem_pkey" PRIMARY KEY (id);


--
-- Name: InventoryStockEvent InventoryStockEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryStockEvent"
    ADD CONSTRAINT "InventoryStockEvent_pkey" PRIMARY KEY (id);


--
-- Name: InventoryStock InventoryStock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryStock"
    ADD CONSTRAINT "InventoryStock_pkey" PRIMARY KEY (id);


--
-- Name: LeadAssignmentEvent LeadAssignmentEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadAssignmentEvent"
    ADD CONSTRAINT "LeadAssignmentEvent_pkey" PRIMARY KEY (id);


--
-- Name: LeadRoutingRule LeadRoutingRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadRoutingRule"
    ADD CONSTRAINT "LeadRoutingRule_pkey" PRIMARY KEY (id);


--
-- Name: Lead Lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_pkey" PRIMARY KEY (id);


--
-- Name: LenderDecision LenderDecision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderDecision"
    ADD CONSTRAINT "LenderDecision_pkey" PRIMARY KEY (id);


--
-- Name: LenderSubmission LenderSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderSubmission"
    ADD CONSTRAINT "LenderSubmission_pkey" PRIMARY KEY (id);


--
-- Name: Make Make_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Make"
    ADD CONSTRAINT "Make_pkey" PRIMARY KEY (id);


--
-- Name: MembershipAuditEvent MembershipAuditEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MembershipAuditEvent"
    ADD CONSTRAINT "MembershipAuditEvent_pkey" PRIMARY KEY (id);


--
-- Name: Model Model_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Model"
    ADD CONSTRAINT "Model_pkey" PRIMARY KEY (id);


--
-- Name: PartsInventory PartsInventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsInventory"
    ADD CONSTRAINT "PartsInventory_pkey" PRIMARY KEY (id);


--
-- Name: PartsMovement PartsMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsMovement"
    ADD CONSTRAINT "PartsMovement_pkey" PRIMARY KEY (id);


--
-- Name: PartsPurchaseOrder PartsPurchaseOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsPurchaseOrder"
    ADD CONSTRAINT "PartsPurchaseOrder_pkey" PRIMARY KEY (id);


--
-- Name: PaymentProviderEvent PaymentProviderEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentProviderEvent"
    ADD CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY (id);


--
-- Name: PaymentProvider PaymentProvider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentProvider"
    ADD CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY (id);


--
-- Name: PaymentRefund PaymentRefund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRefund"
    ADD CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY (id);


--
-- Name: PaymentTransaction PaymentTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY (id);


--
-- Name: PriceHistory PriceHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_pkey" PRIMARY KEY (id);


--
-- Name: ProgressiveOffer ProgressiveOffer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgressiveOffer"
    ADD CONSTRAINT "ProgressiveOffer_pkey" PRIMARY KEY (id);


--
-- Name: RepairOrderLineItem RepairOrderLineItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairOrderLineItem"
    ADD CONSTRAINT "RepairOrderLineItem_pkey" PRIMARY KEY (id);


--
-- Name: ReportRun ReportRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportRun"
    ADD CONSTRAINT "ReportRun_pkey" PRIMARY KEY (id);


--
-- Name: RetentionPolicy RetentionPolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RetentionPolicy"
    ADD CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY (id);


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: RooftopMembership RooftopMembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RooftopMembership"
    ADD CONSTRAINT "RooftopMembership_pkey" PRIMARY KEY (id);


--
-- Name: Rooftop Rooftop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rooftop"
    ADD CONSTRAINT "Rooftop_pkey" PRIMARY KEY (id);


--
-- Name: SalesVisit SalesVisit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesVisit"
    ADD CONSTRAINT "SalesVisit_pkey" PRIMARY KEY (id);


--
-- Name: SavedReport SavedReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SavedReport"
    ADD CONSTRAINT "SavedReport_pkey" PRIMARY KEY (id);


--
-- Name: ServiceAppointment ServiceAppointment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_pkey" PRIMARY KEY (id);


--
-- Name: ServiceLaborOperation ServiceLaborOperation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceLaborOperation"
    ADD CONSTRAINT "ServiceLaborOperation_pkey" PRIMARY KEY (id);


--
-- Name: ServiceOrder ServiceOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY (id);


--
-- Name: ServicePackage ServicePackage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServicePackage"
    ADD CONSTRAINT "ServicePackage_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TestDrive TestDrive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestDrive"
    ADD CONSTRAINT "TestDrive_pkey" PRIMARY KEY (id);


--
-- Name: TradeInPhoto TradeInPhoto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TradeInPhoto"
    ADD CONSTRAINT "TradeInPhoto_pkey" PRIMARY KEY (id);


--
-- Name: TradeIn TradeIn_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TradeIn"
    ADD CONSTRAINT "TradeIn_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VehicleConditionReport VehicleConditionReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleConditionReport"
    ADD CONSTRAINT "VehicleConditionReport_pkey" PRIMARY KEY (id);


--
-- Name: VehicleHistory VehicleHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleHistory"
    ADD CONSTRAINT "VehicleHistory_pkey" PRIMARY KEY (id);


--
-- Name: VehicleImage VehicleImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleImage"
    ADD CONSTRAINT "VehicleImage_pkey" PRIMARY KEY (id);


--
-- Name: Vehicle Vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vehicle"
    ADD CONSTRAINT "Vehicle_pkey" PRIMARY KEY (id);


--
-- Name: WeOweItem WeOweItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeOweItem"
    ADD CONSTRAINT "WeOweItem_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AccountingBatch_active_source_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AccountingBatch_active_source_key" ON public."AccountingBatch" USING btree (rooftop, "sourceType", "sourceId") WHERE (status <> 'failed'::text);


--
-- Name: AccountingBatch_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AccountingBatch_idempotencyKey_key" ON public."AccountingBatch" USING btree ("idempotencyKey");


--
-- Name: AccountingBatch_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccountingBatch_rooftop_idx" ON public."AccountingBatch" USING btree (rooftop);


--
-- Name: AccountingMapping_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccountingMapping_rooftop_idx" ON public."AccountingMapping" USING btree (rooftop);


--
-- Name: AccountingMapping_rooftop_source_provider_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AccountingMapping_rooftop_source_provider_key" ON public."AccountingMapping" USING btree (rooftop, "sourceType", "sourceCode", "providerKey");


--
-- Name: AccountingProviderResponse_batch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccountingProviderResponse_batch_idx" ON public."AccountingProviderResponse" USING btree (batch);


--
-- Name: AccountingProviderResponse_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AccountingProviderResponse_idempotencyKey_key" ON public."AccountingProviderResponse" USING btree ("idempotencyKey");


--
-- Name: AccountingProviderResponse_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AccountingProviderResponse_rooftop_idx" ON public."AccountingProviderResponse" USING btree (rooftop);


--
-- Name: ApiKey_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiKey_user_idx" ON public."ApiKey" USING btree ("user");


--
-- Name: AuthenticationThrottle_blockedUntil_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuthenticationThrottle_blockedUntil_idx" ON public."AuthenticationThrottle" USING btree ("blockedUntil");


--
-- Name: AuthenticationThrottle_keyHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AuthenticationThrottle_keyHash_key" ON public."AuthenticationThrottle" USING btree ("keyHash");


--
-- Name: AuthenticationThrottle_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuthenticationThrottle_updatedAt_idx" ON public."AuthenticationThrottle" USING btree ("updatedAt");


--
-- Name: CustomerContactPreferenceEvent_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerContactPreferenceEvent_actor_idx" ON public."CustomerContactPreferenceEvent" USING btree (actor);


--
-- Name: CustomerContactPreferenceEvent_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerContactPreferenceEvent_customer_idx" ON public."CustomerContactPreferenceEvent" USING btree (customer);


--
-- Name: CustomerContactPreferenceEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerContactPreferenceEvent_rooftop_idx" ON public."CustomerContactPreferenceEvent" USING btree (rooftop);


--
-- Name: CustomerHousehold_householdKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerHousehold_householdKey_key" ON public."CustomerHousehold" USING btree ("householdKey");


--
-- Name: CustomerHousehold_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerHousehold_rooftop_idx" ON public."CustomerHousehold" USING btree (rooftop);


--
-- Name: CustomerInteraction_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerInteraction_lead_idx" ON public."CustomerInteraction" USING btree (lead);


--
-- Name: CustomerInteraction_performedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerInteraction_performedBy_idx" ON public."CustomerInteraction" USING btree ("performedBy");


--
-- Name: CustomerInteraction_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerInteraction_rooftop_idx" ON public."CustomerInteraction" USING btree (rooftop);


--
-- Name: CustomerMergeEvent_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerMergeEvent_actor_idx" ON public."CustomerMergeEvent" USING btree (actor);


--
-- Name: CustomerMergeEvent_duplicate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerMergeEvent_duplicate_idx" ON public."CustomerMergeEvent" USING btree (duplicate);


--
-- Name: CustomerMergeEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerMergeEvent_rooftop_idx" ON public."CustomerMergeEvent" USING btree (rooftop);


--
-- Name: CustomerMergeEvent_survivor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerMergeEvent_survivor_idx" ON public."CustomerMergeEvent" USING btree (survivor);


--
-- Name: Customer_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_account_idx" ON public."Customer" USING btree (account);


--
-- Name: Customer_household_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_household_idx" ON public."Customer" USING btree (household);


--
-- Name: Customer_identityKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Customer_identityKey_key" ON public."Customer" USING btree ("identityKey");


--
-- Name: Customer_mergedInto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_mergedInto_idx" ON public."Customer" USING btree ("mergedInto");


--
-- Name: Customer_normalizedEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_normalizedEmail_idx" ON public."Customer" USING btree ("normalizedEmail");


--
-- Name: Customer_normalizedPhone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_normalizedPhone_idx" ON public."Customer" USING btree ("normalizedPhone");


--
-- Name: Customer_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_rooftop_idx" ON public."Customer" USING btree (rooftop);


--
-- Name: DealApproval_approver_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealApproval_approver_idx" ON public."DealApproval" USING btree (approver);


--
-- Name: DealApproval_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealApproval_deal_idx" ON public."DealApproval" USING btree (deal);


--
-- Name: DealApproval_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealApproval_rooftop_idx" ON public."DealApproval" USING btree (rooftop);


--
-- Name: Deal_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_lead_idx" ON public."Deal" USING btree (lead);


--
-- Name: Deal_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_rooftop_idx" ON public."Deal" USING btree (rooftop);


--
-- Name: Deal_salesperson_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_salesperson_idx" ON public."Deal" USING btree (salesperson);


--
-- Name: Deal_selectedLenderDecision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_selectedLenderDecision_idx" ON public."Deal" USING btree ("selectedLenderDecision");


--
-- Name: Deal_single_active_per_vehicle_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Deal_single_active_per_vehicle_key" ON public."Deal" USING btree (vehicle) WHERE (status = ANY (ARRAY['submitted'::text, 'approved'::text, 'financed'::text]));


--
-- Name: Deal_tradeInVehicle_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Deal_tradeInVehicle_key" ON public."Deal" USING btree ("tradeInVehicle");


--
-- Name: Deal_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_vehicle_idx" ON public."Deal" USING btree (vehicle);


--
-- Name: DealerGroupMembership_dealerGroup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealerGroupMembership_dealerGroup_idx" ON public."DealerGroupMembership" USING btree ("dealerGroup");


--
-- Name: DealerGroupMembership_invitedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealerGroupMembership_invitedBy_idx" ON public."DealerGroupMembership" USING btree ("invitedBy");


--
-- Name: DealerGroupMembership_membershipKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DealerGroupMembership_membershipKey_key" ON public."DealerGroupMembership" USING btree ("membershipKey");


--
-- Name: DealerGroupMembership_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealerGroupMembership_role_idx" ON public."DealerGroupMembership" USING btree (role);


--
-- Name: DealerGroupMembership_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealerGroupMembership_user_idx" ON public."DealerGroupMembership" USING btree ("user");


--
-- Name: DealerGroup_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DealerGroup_slug_key" ON public."DealerGroup" USING btree (slug);


--
-- Name: DeliveryCase_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryCase_deal_idx" ON public."DeliveryCase" USING btree (deal);


--
-- Name: DeliveryCase_deal_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeliveryCase_deal_key" ON public."DeliveryCase" USING btree (deal);


--
-- Name: DeliveryCase_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeliveryCase_idempotencyKey_key" ON public."DeliveryCase" USING btree ("idempotencyKey");


--
-- Name: DeliveryCase_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryCase_rooftop_idx" ON public."DeliveryCase" USING btree (rooftop);


--
-- Name: DomainAuditEvent_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DomainAuditEvent_actor_idx" ON public."DomainAuditEvent" USING btree (actor);


--
-- Name: DomainAuditEvent_aggregateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DomainAuditEvent_aggregateId_idx" ON public."DomainAuditEvent" USING btree ("aggregateId");


--
-- Name: DomainAuditEvent_aggregateType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DomainAuditEvent_aggregateType_idx" ON public."DomainAuditEvent" USING btree ("aggregateType");


--
-- Name: DomainAuditEvent_eventKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DomainAuditEvent_eventKey_key" ON public."DomainAuditEvent" USING btree ("eventKey");


--
-- Name: DomainAuditEvent_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DomainAuditEvent_occurredAt_idx" ON public."DomainAuditEvent" USING btree ("occurredAt");


--
-- Name: DomainAuditEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DomainAuditEvent_rooftop_idx" ON public."DomainAuditEvent" USING btree (rooftop);


--
-- Name: FinanceComplianceCheck_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceComplianceCheck_deal_idx" ON public."FinanceComplianceCheck" USING btree (deal);


--
-- Name: FinanceComplianceCheck_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceComplianceCheck_idempotencyKey_key" ON public."FinanceComplianceCheck" USING btree ("idempotencyKey");


--
-- Name: FinanceComplianceCheck_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceComplianceCheck_rooftop_idx" ON public."FinanceComplianceCheck" USING btree (rooftop);


--
-- Name: FinanceContractPackage_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceContractPackage_deal_idx" ON public."FinanceContractPackage" USING btree (deal);


--
-- Name: FinanceContractPackage_deal_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceContractPackage_deal_key" ON public."FinanceContractPackage" USING btree (deal);


--
-- Name: FinanceContractPackage_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceContractPackage_idempotencyKey_key" ON public."FinanceContractPackage" USING btree ("idempotencyKey");


--
-- Name: FinanceContractPackage_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceContractPackage_rooftop_idx" ON public."FinanceContractPackage" USING btree (rooftop);


--
-- Name: FinanceFundingCase_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceFundingCase_deal_idx" ON public."FinanceFundingCase" USING btree (deal);


--
-- Name: FinanceFundingCase_deal_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceFundingCase_deal_key" ON public."FinanceFundingCase" USING btree (deal);


--
-- Name: FinanceFundingCase_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceFundingCase_idempotencyKey_key" ON public."FinanceFundingCase" USING btree ("idempotencyKey");


--
-- Name: FinanceFundingCase_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceFundingCase_rooftop_idx" ON public."FinanceFundingCase" USING btree (rooftop);


--
-- Name: FinanceMenuVersion_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceMenuVersion_deal_idx" ON public."FinanceMenuVersion" USING btree (deal);


--
-- Name: FinanceMenuVersion_deal_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceMenuVersion_deal_version_key" ON public."FinanceMenuVersion" USING btree (deal, version);


--
-- Name: FinanceMenuVersion_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceMenuVersion_idempotencyKey_key" ON public."FinanceMenuVersion" USING btree ("idempotencyKey");


--
-- Name: FinanceMenuVersion_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceMenuVersion_rooftop_idx" ON public."FinanceMenuVersion" USING btree (rooftop);


--
-- Name: FinanceProductCancellation_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceProductCancellation_deal_idx" ON public."FinanceProductCancellation" USING btree (deal);


--
-- Name: FinanceProductCancellation_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceProductCancellation_idempotencyKey_key" ON public."FinanceProductCancellation" USING btree ("idempotencyKey");


--
-- Name: FinanceProductCancellation_menu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceProductCancellation_menu_idx" ON public."FinanceProductCancellation" USING btree (menu);


--
-- Name: FinanceProductCancellation_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceProductCancellation_rooftop_idx" ON public."FinanceProductCancellation" USING btree (rooftop);


--
-- Name: FinanceProductCancellation_single_completed_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceProductCancellation_single_completed_key" ON public."FinanceProductCancellation" USING btree (menu, "productCode") WHERE (status = 'completed'::text);


--
-- Name: FinanceProductQuote_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceProductQuote_deal_idx" ON public."FinanceProductQuote" USING btree (deal);


--
-- Name: FinanceProductQuote_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceProductQuote_idempotencyKey_key" ON public."FinanceProductQuote" USING btree ("idempotencyKey");


--
-- Name: FinanceProductQuote_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceProductQuote_product_idx" ON public."FinanceProductQuote" USING btree (product);


--
-- Name: FinanceProductQuote_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceProductQuote_rooftop_idx" ON public."FinanceProductQuote" USING btree (rooftop);


--
-- Name: FinanceProduct_rooftop_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinanceProduct_rooftop_code_key" ON public."FinanceProduct" USING btree (rooftop, code);


--
-- Name: FinanceProduct_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinanceProduct_rooftop_idx" ON public."FinanceProduct" USING btree (rooftop);


--
-- Name: FinancingApplication_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinancingApplication_idempotencyKey_key" ON public."FinancingApplication" USING btree ("idempotencyKey");


--
-- Name: FinancingApplication_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancingApplication_lead_idx" ON public."FinancingApplication" USING btree (lead);


--
-- Name: FinancingApplication_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FinancingApplication_reference_key" ON public."FinancingApplication" USING btree (reference);


--
-- Name: FinancingApplication_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancingApplication_rooftop_idx" ON public."FinancingApplication" USING btree (rooftop);


--
-- Name: FinancingApplication_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancingApplication_vehicle_idx" ON public."FinancingApplication" USING btree (vehicle);


--
-- Name: FinancingPlan_bank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FinancingPlan_bank_idx" ON public."FinancingPlan" USING btree (bank);


--
-- Name: InventoryAcquisitionEvent_acquisition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryAcquisitionEvent_acquisition_idx" ON public."InventoryAcquisitionEvent" USING btree (acquisition);


--
-- Name: InventoryAcquisitionEvent_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryAcquisitionEvent_actor_idx" ON public."InventoryAcquisitionEvent" USING btree (actor);


--
-- Name: InventoryAcquisitionEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryAcquisitionEvent_rooftop_idx" ON public."InventoryAcquisitionEvent" USING btree (rooftop);


--
-- Name: InventoryAcquisition_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryAcquisition_idempotencyKey_key" ON public."InventoryAcquisition" USING btree ("idempotencyKey");


--
-- Name: InventoryAcquisition_lastTransitionedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryAcquisition_lastTransitionedBy_idx" ON public."InventoryAcquisition" USING btree ("lastTransitionedBy");


--
-- Name: InventoryAcquisition_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryAcquisition_reference_key" ON public."InventoryAcquisition" USING btree (reference);


--
-- Name: InventoryAcquisition_requestedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryAcquisition_requestedBy_idx" ON public."InventoryAcquisition" USING btree ("requestedBy");


--
-- Name: InventoryAcquisition_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryAcquisition_rooftop_idx" ON public."InventoryAcquisition" USING btree (rooftop);


--
-- Name: InventoryAcquisition_stock_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryAcquisition_stock_key" ON public."InventoryAcquisition" USING btree (stock);


--
-- Name: InventoryAcquisition_vehicle_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryAcquisition_vehicle_key" ON public."InventoryAcquisition" USING btree (vehicle);


--
-- Name: InventoryFeedError_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryFeedError_rooftop_idx" ON public."InventoryFeedError" USING btree (rooftop);


--
-- Name: InventoryFeedError_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryFeedError_run_idx" ON public."InventoryFeedError" USING btree (run);


--
-- Name: InventoryFeedError_stock_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryFeedError_stock_idx" ON public."InventoryFeedError" USING btree (stock);


--
-- Name: InventoryFeedRun_channelKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryFeedRun_channelKey_idx" ON public."InventoryFeedRun" USING btree ("channelKey");


--
-- Name: InventoryFeedRun_recordedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryFeedRun_recordedBy_idx" ON public."InventoryFeedRun" USING btree ("recordedBy");


--
-- Name: InventoryFeedRun_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryFeedRun_rooftop_idx" ON public."InventoryFeedRun" USING btree (rooftop);


--
-- Name: InventoryFeedRun_runKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryFeedRun_runKey_key" ON public."InventoryFeedRun" USING btree ("runKey");


--
-- Name: InventoryMerchandisingVersion_decidedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryMerchandisingVersion_decidedBy_idx" ON public."InventoryMerchandisingVersion" USING btree ("decidedBy");


--
-- Name: InventoryMerchandisingVersion_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryMerchandisingVersion_rooftop_idx" ON public."InventoryMerchandisingVersion" USING btree (rooftop);


--
-- Name: InventoryMerchandisingVersion_stock_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryMerchandisingVersion_stock_idx" ON public."InventoryMerchandisingVersion" USING btree (stock);


--
-- Name: InventoryMerchandisingVersion_submittedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryMerchandisingVersion_submittedBy_idx" ON public."InventoryMerchandisingVersion" USING btree ("submittedBy");


--
-- Name: InventoryMerchandisingVersion_versionKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryMerchandisingVersion_versionKey_key" ON public."InventoryMerchandisingVersion" USING btree ("versionKey");


--
-- Name: InventoryReconWorkItem_assignedTo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryReconWorkItem_assignedTo_idx" ON public."InventoryReconWorkItem" USING btree ("assignedTo");


--
-- Name: InventoryReconWorkItem_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryReconWorkItem_rooftop_idx" ON public."InventoryReconWorkItem" USING btree (rooftop);


--
-- Name: InventoryReconWorkItem_stock_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryReconWorkItem_stock_idx" ON public."InventoryReconWorkItem" USING btree (stock);


--
-- Name: InventoryStockEvent_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryStockEvent_actor_idx" ON public."InventoryStockEvent" USING btree (actor);


--
-- Name: InventoryStockEvent_eventKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryStockEvent_eventKey_key" ON public."InventoryStockEvent" USING btree ("eventKey");


--
-- Name: InventoryStockEvent_eventType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryStockEvent_eventType_idx" ON public."InventoryStockEvent" USING btree ("eventType");


--
-- Name: InventoryStockEvent_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryStockEvent_occurredAt_idx" ON public."InventoryStockEvent" USING btree ("occurredAt");


--
-- Name: InventoryStockEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryStockEvent_rooftop_idx" ON public."InventoryStockEvent" USING btree (rooftop);


--
-- Name: InventoryStockEvent_stock_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryStockEvent_stock_idx" ON public."InventoryStockEvent" USING btree (stock);


--
-- Name: InventoryStock_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryStock_rooftop_idx" ON public."InventoryStock" USING btree (rooftop);


--
-- Name: InventoryStock_stockKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryStock_stockKey_key" ON public."InventoryStock" USING btree ("stockKey");


--
-- Name: InventoryStock_vehicle_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryStock_vehicle_key" ON public."InventoryStock" USING btree (vehicle);


--
-- Name: LeadAssignmentEvent_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadAssignmentEvent_actor_idx" ON public."LeadAssignmentEvent" USING btree (actor);


--
-- Name: LeadAssignmentEvent_fromUser_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadAssignmentEvent_fromUser_idx" ON public."LeadAssignmentEvent" USING btree ("fromUser");


--
-- Name: LeadAssignmentEvent_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadAssignmentEvent_lead_idx" ON public."LeadAssignmentEvent" USING btree (lead);


--
-- Name: LeadAssignmentEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadAssignmentEvent_rooftop_idx" ON public."LeadAssignmentEvent" USING btree (rooftop);


--
-- Name: LeadAssignmentEvent_toUser_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadAssignmentEvent_toUser_idx" ON public."LeadAssignmentEvent" USING btree ("toUser");


--
-- Name: LeadRoutingRule_assignee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadRoutingRule_assignee_idx" ON public."LeadRoutingRule" USING btree (assignee);


--
-- Name: LeadRoutingRule_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadRoutingRule_rooftop_idx" ON public."LeadRoutingRule" USING btree (rooftop);


--
-- Name: LeadRoutingRule_routeKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeadRoutingRule_routeKey_key" ON public."LeadRoutingRule" USING btree ("routeKey");


--
-- Name: Lead_assignedSalesperson_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_assignedSalesperson_idx" ON public."Lead" USING btree ("assignedSalesperson");


--
-- Name: Lead_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_customer_idx" ON public."Lead" USING btree (customer);


--
-- Name: Lead_interestedVehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_interestedVehicle_idx" ON public."Lead" USING btree ("interestedVehicle");


--
-- Name: Lead_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_rooftop_idx" ON public."Lead" USING btree (rooftop);


--
-- Name: LenderDecision_application_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LenderDecision_application_idx" ON public."LenderDecision" USING btree (application);


--
-- Name: LenderDecision_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LenderDecision_idempotencyKey_key" ON public."LenderDecision" USING btree ("idempotencyKey");


--
-- Name: LenderDecision_recordedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LenderDecision_recordedBy_idx" ON public."LenderDecision" USING btree ("recordedBy");


--
-- Name: LenderDecision_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LenderDecision_rooftop_idx" ON public."LenderDecision" USING btree (rooftop);


--
-- Name: LenderDecision_submission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LenderDecision_submission_idx" ON public."LenderDecision" USING btree (submission);


--
-- Name: LenderSubmission_application_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LenderSubmission_application_idx" ON public."LenderSubmission" USING btree (application);


--
-- Name: LenderSubmission_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LenderSubmission_idempotencyKey_key" ON public."LenderSubmission" USING btree ("idempotencyKey");


--
-- Name: LenderSubmission_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LenderSubmission_rooftop_idx" ON public."LenderSubmission" USING btree (rooftop);


--
-- Name: Make_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Make_name_key" ON public."Make" USING btree (name);


--
-- Name: MembershipAuditEvent_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MembershipAuditEvent_actor_idx" ON public."MembershipAuditEvent" USING btree (actor);


--
-- Name: MembershipAuditEvent_dealerGroup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MembershipAuditEvent_dealerGroup_idx" ON public."MembershipAuditEvent" USING btree ("dealerGroup");


--
-- Name: MembershipAuditEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MembershipAuditEvent_rooftop_idx" ON public."MembershipAuditEvent" USING btree (rooftop);


--
-- Name: MembershipAuditEvent_targetUser_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MembershipAuditEvent_targetUser_idx" ON public."MembershipAuditEvent" USING btree ("targetUser");


--
-- Name: Model_make_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Model_make_idx" ON public."Model" USING btree (make);


--
-- Name: PartsInventory_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartsInventory_rooftop_idx" ON public."PartsInventory" USING btree (rooftop);


--
-- Name: PartsInventory_rooftop_partNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartsInventory_rooftop_partNumber_key" ON public."PartsInventory" USING btree (rooftop, "partNumber");


--
-- Name: PartsMovement_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartsMovement_idempotencyKey_key" ON public."PartsMovement" USING btree ("idempotencyKey");


--
-- Name: PartsMovement_part_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartsMovement_part_idx" ON public."PartsMovement" USING btree (part);


--
-- Name: PartsMovement_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartsMovement_rooftop_idx" ON public."PartsMovement" USING btree (rooftop);


--
-- Name: PartsMovement_serviceOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartsMovement_serviceOrder_idx" ON public."PartsMovement" USING btree ("serviceOrder");


--
-- Name: PartsPurchaseOrder_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartsPurchaseOrder_idempotencyKey_key" ON public."PartsPurchaseOrder" USING btree ("idempotencyKey");


--
-- Name: PartsPurchaseOrder_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartsPurchaseOrder_rooftop_idx" ON public."PartsPurchaseOrder" USING btree (rooftop);


--
-- Name: PartsPurchaseOrder_rooftop_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartsPurchaseOrder_rooftop_reference_key" ON public."PartsPurchaseOrder" USING btree (rooftop, reference);


--
-- Name: PaymentProviderEvent_providerEventId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentProviderEvent_providerEventId_key" ON public."PaymentProviderEvent" USING btree ("providerEventId");


--
-- Name: PaymentProviderEvent_refund_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentProviderEvent_refund_idx" ON public."PaymentProviderEvent" USING btree (refund);


--
-- Name: PaymentProviderEvent_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentProviderEvent_rooftop_idx" ON public."PaymentProviderEvent" USING btree (rooftop);


--
-- Name: PaymentProviderEvent_transaction_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentProviderEvent_transaction_idx" ON public."PaymentProviderEvent" USING btree (transaction);


--
-- Name: PaymentProvider_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentProvider_code_key" ON public."PaymentProvider" USING btree (code);


--
-- Name: PaymentRefund_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON public."PaymentRefund" USING btree ("idempotencyKey");


--
-- Name: PaymentRefund_providerRefundId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentRefund_providerRefundId_key" ON public."PaymentRefund" USING btree ("providerRefundId") WHERE ("providerRefundId" <> ''::text);


--
-- Name: PaymentRefund_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentRefund_rooftop_idx" ON public."PaymentRefund" USING btree (rooftop);


--
-- Name: PaymentRefund_transaction_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentRefund_transaction_idx" ON public."PaymentRefund" USING btree (transaction);


--
-- Name: PaymentTransaction_deal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentTransaction_deal_idx" ON public."PaymentTransaction" USING btree (deal);


--
-- Name: PaymentTransaction_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON public."PaymentTransaction" USING btree ("idempotencyKey");


--
-- Name: PaymentTransaction_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentTransaction_lead_idx" ON public."PaymentTransaction" USING btree (lead);


--
-- Name: PaymentTransaction_paymentProvider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentTransaction_paymentProvider_idx" ON public."PaymentTransaction" USING btree ("paymentProvider");


--
-- Name: PaymentTransaction_providerSessionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentTransaction_providerSessionId_key" ON public."PaymentTransaction" USING btree ("providerSessionId") WHERE ("providerSessionId" <> ''::text);


--
-- Name: PaymentTransaction_providerTransactionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentTransaction_providerTransactionId_key" ON public."PaymentTransaction" USING btree ("providerTransactionId") WHERE ("providerTransactionId" <> ''::text);


--
-- Name: PaymentTransaction_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentTransaction_rooftop_idx" ON public."PaymentTransaction" USING btree (rooftop);


--
-- Name: PaymentTransaction_serviceOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentTransaction_serviceOrder_idx" ON public."PaymentTransaction" USING btree ("serviceOrder");


--
-- Name: PriceHistory_changedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PriceHistory_changedBy_idx" ON public."PriceHistory" USING btree ("changedBy");


--
-- Name: PriceHistory_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PriceHistory_rooftop_idx" ON public."PriceHistory" USING btree (rooftop);


--
-- Name: PriceHistory_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PriceHistory_vehicle_idx" ON public."PriceHistory" USING btree (vehicle);


--
-- Name: ProgressiveOffer_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProgressiveOffer_vehicle_idx" ON public."ProgressiveOffer" USING btree (vehicle);


--
-- Name: RepairOrderLineItem_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairOrderLineItem_rooftop_idx" ON public."RepairOrderLineItem" USING btree (rooftop);


--
-- Name: RepairOrderLineItem_serviceOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairOrderLineItem_serviceOrder_idx" ON public."RepairOrderLineItem" USING btree ("serviceOrder");


--
-- Name: ReportRun_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ReportRun_idempotencyKey_key" ON public."ReportRun" USING btree ("idempotencyKey");


--
-- Name: ReportRun_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportRun_rooftop_idx" ON public."ReportRun" USING btree (rooftop);


--
-- Name: ReportRun_savedReport_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportRun_savedReport_idx" ON public."ReportRun" USING btree ("savedReport");


--
-- Name: RetentionPolicy_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RetentionPolicy_idempotencyKey_key" ON public."RetentionPolicy" USING btree ("idempotencyKey");


--
-- Name: RetentionPolicy_rooftop_category_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RetentionPolicy_rooftop_category_key" ON public."RetentionPolicy" USING btree (rooftop, category);


--
-- Name: RetentionPolicy_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RetentionPolicy_rooftop_idx" ON public."RetentionPolicy" USING btree (rooftop);


--
-- Name: RooftopMembership_invitedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RooftopMembership_invitedBy_idx" ON public."RooftopMembership" USING btree ("invitedBy");


--
-- Name: RooftopMembership_membershipKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RooftopMembership_membershipKey_key" ON public."RooftopMembership" USING btree ("membershipKey");


--
-- Name: RooftopMembership_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RooftopMembership_role_idx" ON public."RooftopMembership" USING btree (role);


--
-- Name: RooftopMembership_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RooftopMembership_rooftop_idx" ON public."RooftopMembership" USING btree (rooftop);


--
-- Name: RooftopMembership_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RooftopMembership_user_idx" ON public."RooftopMembership" USING btree ("user");


--
-- Name: Rooftop_dealerGroup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Rooftop_dealerGroup_idx" ON public."Rooftop" USING btree ("dealerGroup");


--
-- Name: Rooftop_publicSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Rooftop_publicSlug_key" ON public."Rooftop" USING btree ("publicSlug");


--
-- Name: Rooftop_rooftopKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Rooftop_rooftopKey_key" ON public."Rooftop" USING btree ("rooftopKey");


--
-- Name: SalesVisit_assignedSalesperson_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesVisit_assignedSalesperson_idx" ON public."SalesVisit" USING btree ("assignedSalesperson");


--
-- Name: SalesVisit_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesVisit_customer_idx" ON public."SalesVisit" USING btree (customer);


--
-- Name: SalesVisit_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesVisit_lead_idx" ON public."SalesVisit" USING btree (lead);


--
-- Name: SalesVisit_manager_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesVisit_manager_idx" ON public."SalesVisit" USING btree (manager);


--
-- Name: SalesVisit_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesVisit_rooftop_idx" ON public."SalesVisit" USING btree (rooftop);


--
-- Name: SalesVisit_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesVisit_vehicle_idx" ON public."SalesVisit" USING btree (vehicle);


--
-- Name: SavedReport_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SavedReport_idempotencyKey_key" ON public."SavedReport" USING btree ("idempotencyKey");


--
-- Name: SavedReport_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SavedReport_owner_idx" ON public."SavedReport" USING btree (owner);


--
-- Name: SavedReport_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SavedReport_rooftop_idx" ON public."SavedReport" USING btree (rooftop);


--
-- Name: ServiceAppointment_assignedTech_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceAppointment_assignedTech_idx" ON public."ServiceAppointment" USING btree ("assignedTech");


--
-- Name: ServiceAppointment_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceAppointment_customer_idx" ON public."ServiceAppointment" USING btree (customer);


--
-- Name: ServiceAppointment_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceAppointment_lead_idx" ON public."ServiceAppointment" USING btree (lead);


--
-- Name: ServiceAppointment_requestedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceAppointment_requestedBy_idx" ON public."ServiceAppointment" USING btree ("requestedBy");


--
-- Name: ServiceAppointment_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceAppointment_rooftop_idx" ON public."ServiceAppointment" USING btree (rooftop);


--
-- Name: ServiceAppointment_serviceOrder_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ServiceAppointment_serviceOrder_key" ON public."ServiceAppointment" USING btree ("serviceOrder");


--
-- Name: ServiceAppointment_servicePackage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceAppointment_servicePackage_idx" ON public."ServiceAppointment" USING btree ("servicePackage");


--
-- Name: ServiceLaborOperation_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ServiceLaborOperation_idempotencyKey_key" ON public."ServiceLaborOperation" USING btree ("idempotencyKey");


--
-- Name: ServiceLaborOperation_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceLaborOperation_rooftop_idx" ON public."ServiceLaborOperation" USING btree (rooftop);


--
-- Name: ServiceLaborOperation_serviceOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceLaborOperation_serviceOrder_idx" ON public."ServiceLaborOperation" USING btree ("serviceOrder");


--
-- Name: ServiceLaborOperation_technician_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceLaborOperation_technician_idx" ON public."ServiceLaborOperation" USING btree (technician);


--
-- Name: ServiceOrder_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceOrder_rooftop_idx" ON public."ServiceOrder" USING btree (rooftop);


--
-- Name: ServicePackage_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServicePackage_rooftop_idx" ON public."ServicePackage" USING btree (rooftop);


--
-- Name: Task_assignedTo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_assignedTo_idx" ON public."Task" USING btree ("assignedTo");


--
-- Name: Task_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_lead_idx" ON public."Task" USING btree (lead);


--
-- Name: Task_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_rooftop_idx" ON public."Task" USING btree (rooftop);


--
-- Name: TestDrive_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestDrive_lead_idx" ON public."TestDrive" USING btree (lead);


--
-- Name: TestDrive_requestedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestDrive_requestedBy_idx" ON public."TestDrive" USING btree ("requestedBy");


--
-- Name: TestDrive_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestDrive_rooftop_idx" ON public."TestDrive" USING btree (rooftop);


--
-- Name: TestDrive_salesperson_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestDrive_salesperson_idx" ON public."TestDrive" USING btree (salesperson);


--
-- Name: TestDrive_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestDrive_vehicle_idx" ON public."TestDrive" USING btree (vehicle);


--
-- Name: TradeInPhoto_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TradeInPhoto_rooftop_idx" ON public."TradeInPhoto" USING btree (rooftop);


--
-- Name: TradeInPhoto_tradeIn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TradeInPhoto_tradeIn_idx" ON public."TradeInPhoto" USING btree ("tradeIn");


--
-- Name: TradeIn_appraisedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TradeIn_appraisedBy_idx" ON public."TradeIn" USING btree ("appraisedBy");


--
-- Name: TradeIn_lead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TradeIn_lead_idx" ON public."TradeIn" USING btree (lead);


--
-- Name: TradeIn_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TradeIn_rooftop_idx" ON public."TradeIn" USING btree (rooftop);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_employeeId_nonempty_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_employeeId_nonempty_key" ON public."User" USING btree ("employeeId") WHERE ("employeeId" <> ''::text);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: VehicleConditionReport_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VehicleConditionReport_rooftop_idx" ON public."VehicleConditionReport" USING btree (rooftop);


--
-- Name: VehicleConditionReport_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VehicleConditionReport_vehicle_idx" ON public."VehicleConditionReport" USING btree (vehicle);


--
-- Name: VehicleHistory_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VehicleHistory_rooftop_idx" ON public."VehicleHistory" USING btree (rooftop);


--
-- Name: VehicleImage_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VehicleImage_rooftop_idx" ON public."VehicleImage" USING btree (rooftop);


--
-- Name: VehicleImage_single_primary_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VehicleImage_single_primary_key" ON public."VehicleImage" USING btree (vehicle) WHERE "isPrimary";


--
-- Name: VehicleImage_vehicle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VehicleImage_vehicle_idx" ON public."VehicleImage" USING btree (vehicle);


--
-- Name: Vehicle_history_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Vehicle_history_key" ON public."Vehicle" USING btree (history);


--
-- Name: Vehicle_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vehicle_rooftop_idx" ON public."Vehicle" USING btree (rooftop);


--
-- Name: Vehicle_stockNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Vehicle_stockNumber_key" ON public."Vehicle" USING btree ("stockNumber");


--
-- Name: Vehicle_vin_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Vehicle_vin_key" ON public."Vehicle" USING btree (vin);


--
-- Name: WeOweItem_deliveryCase_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WeOweItem_deliveryCase_idx" ON public."WeOweItem" USING btree ("deliveryCase");


--
-- Name: WeOweItem_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WeOweItem_idempotencyKey_key" ON public."WeOweItem" USING btree ("idempotencyKey");


--
-- Name: WeOweItem_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WeOweItem_owner_idx" ON public."WeOweItem" USING btree (owner);


--
-- Name: WeOweItem_rooftop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WeOweItem_rooftop_idx" ON public."WeOweItem" USING btree (rooftop);


--
-- Name: InventoryStock InventoryStock_invalidate_publication_after_identity_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "InventoryStock_invalidate_publication_after_identity_change" AFTER UPDATE OF rooftop, vehicle, "stockNumber" ON public."InventoryStock" FOR EACH ROW EXECUTE FUNCTION public.invalidate_publication_for_inventory_stock_change();


--
-- Name: VehicleImage VehicleImage_invalidate_publication_after_merchandising_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "VehicleImage_invalidate_publication_after_merchandising_change" AFTER INSERT OR DELETE OR UPDATE OF vehicle, rooftop, "imagePath", image_id, image_extension, caption, category, "isPrimary", "sortOrder" ON public."VehicleImage" FOR EACH ROW EXECUTE FUNCTION public.invalidate_publication_for_vehicle_image_change();


--
-- Name: Vehicle Vehicle_invalidate_publication_after_merchandising_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Vehicle_invalidate_publication_after_merchandising_change" AFTER UPDATE OF rooftop, vin, "stockNumber", year, make, model, "trim", "exteriorColor", "interiorColor", mileage, condition, "priceCents", "listPriceCents", description, features ON public."Vehicle" FOR EACH ROW EXECUTE FUNCTION public.invalidate_publication_for_vehicle_change();


--
-- Name: AccountingBatch AccountingBatch_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountingBatch"
    ADD CONSTRAINT "AccountingBatch_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AccountingMapping AccountingMapping_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountingMapping"
    ADD CONSTRAINT "AccountingMapping_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AccountingProviderResponse AccountingProviderResponse_batch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountingProviderResponse"
    ADD CONSTRAINT "AccountingProviderResponse_batch_fkey" FOREIGN KEY (batch) REFERENCES public."AccountingBatch"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AccountingProviderResponse AccountingProviderResponse_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccountingProviderResponse"
    ADD CONSTRAINT "AccountingProviderResponse_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ApiKey ApiKey_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_user_fkey" FOREIGN KEY ("user") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CustomerContactPreferenceEvent CustomerContactPreferenceEvent_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerContactPreferenceEvent"
    ADD CONSTRAINT "CustomerContactPreferenceEvent_actor_fkey" FOREIGN KEY (actor) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerContactPreferenceEvent CustomerContactPreferenceEvent_customer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerContactPreferenceEvent"
    ADD CONSTRAINT "CustomerContactPreferenceEvent_customer_fkey" FOREIGN KEY (customer) REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerContactPreferenceEvent CustomerContactPreferenceEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerContactPreferenceEvent"
    ADD CONSTRAINT "CustomerContactPreferenceEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerHousehold CustomerHousehold_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerHousehold"
    ADD CONSTRAINT "CustomerHousehold_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerInteraction CustomerInteraction_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerInteraction"
    ADD CONSTRAINT "CustomerInteraction_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CustomerInteraction CustomerInteraction_performedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerInteraction"
    ADD CONSTRAINT "CustomerInteraction_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CustomerInteraction CustomerInteraction_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerInteraction"
    ADD CONSTRAINT "CustomerInteraction_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerMergeEvent CustomerMergeEvent_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerMergeEvent"
    ADD CONSTRAINT "CustomerMergeEvent_actor_fkey" FOREIGN KEY (actor) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerMergeEvent CustomerMergeEvent_duplicate_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerMergeEvent"
    ADD CONSTRAINT "CustomerMergeEvent_duplicate_fkey" FOREIGN KEY (duplicate) REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerMergeEvent CustomerMergeEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerMergeEvent"
    ADD CONSTRAINT "CustomerMergeEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerMergeEvent CustomerMergeEvent_survivor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerMergeEvent"
    ADD CONSTRAINT "CustomerMergeEvent_survivor_fkey" FOREIGN KEY (survivor) REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Customer Customer_account_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_account_fkey" FOREIGN KEY (account) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Customer Customer_household_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_household_fkey" FOREIGN KEY (household) REFERENCES public."CustomerHousehold"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Customer Customer_mergedInto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_mergedInto_fkey" FOREIGN KEY ("mergedInto") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Customer Customer_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DealApproval DealApproval_approver_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealApproval"
    ADD CONSTRAINT "DealApproval_approver_fkey" FOREIGN KEY (approver) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DealApproval DealApproval_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealApproval"
    ADD CONSTRAINT "DealApproval_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DealApproval DealApproval_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealApproval"
    ADD CONSTRAINT "DealApproval_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Deal Deal_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Deal Deal_salesperson_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_salesperson_fkey" FOREIGN KEY (salesperson) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_selectedLenderDecision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_selectedLenderDecision_fkey" FOREIGN KEY ("selectedLenderDecision") REFERENCES public."LenderDecision"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_tradeInVehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_tradeInVehicle_fkey" FOREIGN KEY ("tradeInVehicle") REFERENCES public."TradeIn"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DealerGroupMembership DealerGroupMembership_dealerGroup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealerGroupMembership"
    ADD CONSTRAINT "DealerGroupMembership_dealerGroup_fkey" FOREIGN KEY ("dealerGroup") REFERENCES public."DealerGroup"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DealerGroupMembership DealerGroupMembership_invitedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealerGroupMembership"
    ADD CONSTRAINT "DealerGroupMembership_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DealerGroupMembership DealerGroupMembership_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealerGroupMembership"
    ADD CONSTRAINT "DealerGroupMembership_role_fkey" FOREIGN KEY (role) REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DealerGroupMembership DealerGroupMembership_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealerGroupMembership"
    ADD CONSTRAINT "DealerGroupMembership_user_fkey" FOREIGN KEY ("user") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DeliveryCase DeliveryCase_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryCase"
    ADD CONSTRAINT "DeliveryCase_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DeliveryCase DeliveryCase_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryCase"
    ADD CONSTRAINT "DeliveryCase_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DomainAuditEvent DomainAuditEvent_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DomainAuditEvent"
    ADD CONSTRAINT "DomainAuditEvent_actor_fkey" FOREIGN KEY (actor) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DomainAuditEvent DomainAuditEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DomainAuditEvent"
    ADD CONSTRAINT "DomainAuditEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceComplianceCheck FinanceComplianceCheck_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceComplianceCheck"
    ADD CONSTRAINT "FinanceComplianceCheck_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceComplianceCheck FinanceComplianceCheck_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceComplianceCheck"
    ADD CONSTRAINT "FinanceComplianceCheck_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceContractPackage FinanceContractPackage_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceContractPackage"
    ADD CONSTRAINT "FinanceContractPackage_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceContractPackage FinanceContractPackage_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceContractPackage"
    ADD CONSTRAINT "FinanceContractPackage_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceFundingCase FinanceFundingCase_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceFundingCase"
    ADD CONSTRAINT "FinanceFundingCase_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceFundingCase FinanceFundingCase_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceFundingCase"
    ADD CONSTRAINT "FinanceFundingCase_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceMenuVersion FinanceMenuVersion_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceMenuVersion"
    ADD CONSTRAINT "FinanceMenuVersion_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceMenuVersion FinanceMenuVersion_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceMenuVersion"
    ADD CONSTRAINT "FinanceMenuVersion_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceProductCancellation FinanceProductCancellation_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductCancellation"
    ADD CONSTRAINT "FinanceProductCancellation_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceProductCancellation FinanceProductCancellation_menu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductCancellation"
    ADD CONSTRAINT "FinanceProductCancellation_menu_fkey" FOREIGN KEY (menu) REFERENCES public."FinanceMenuVersion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceProductCancellation FinanceProductCancellation_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductCancellation"
    ADD CONSTRAINT "FinanceProductCancellation_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceProductQuote FinanceProductQuote_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductQuote"
    ADD CONSTRAINT "FinanceProductQuote_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceProductQuote FinanceProductQuote_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductQuote"
    ADD CONSTRAINT "FinanceProductQuote_product_fkey" FOREIGN KEY (product) REFERENCES public."FinanceProduct"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceProductQuote FinanceProductQuote_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProductQuote"
    ADD CONSTRAINT "FinanceProductQuote_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinanceProduct FinanceProduct_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinanceProduct"
    ADD CONSTRAINT "FinanceProduct_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinancingApplication FinancingApplication_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinancingApplication"
    ADD CONSTRAINT "FinancingApplication_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FinancingApplication FinancingApplication_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinancingApplication"
    ADD CONSTRAINT "FinancingApplication_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinancingApplication FinancingApplication_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinancingApplication"
    ADD CONSTRAINT "FinancingApplication_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FinancingPlan FinancingPlan_bank_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FinancingPlan"
    ADD CONSTRAINT "FinancingPlan_bank_fkey" FOREIGN KEY (bank) REFERENCES public."Bank"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryAcquisitionEvent InventoryAcquisitionEvent_acquisition_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisitionEvent"
    ADD CONSTRAINT "InventoryAcquisitionEvent_acquisition_fkey" FOREIGN KEY (acquisition) REFERENCES public."InventoryAcquisition"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryAcquisitionEvent InventoryAcquisitionEvent_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisitionEvent"
    ADD CONSTRAINT "InventoryAcquisitionEvent_actor_fkey" FOREIGN KEY (actor) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryAcquisitionEvent InventoryAcquisitionEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisitionEvent"
    ADD CONSTRAINT "InventoryAcquisitionEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryAcquisition InventoryAcquisition_lastTransitionedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisition"
    ADD CONSTRAINT "InventoryAcquisition_lastTransitionedBy_fkey" FOREIGN KEY ("lastTransitionedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryAcquisition InventoryAcquisition_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisition"
    ADD CONSTRAINT "InventoryAcquisition_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryAcquisition InventoryAcquisition_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisition"
    ADD CONSTRAINT "InventoryAcquisition_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryAcquisition InventoryAcquisition_stock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisition"
    ADD CONSTRAINT "InventoryAcquisition_stock_fkey" FOREIGN KEY (stock) REFERENCES public."InventoryStock"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryAcquisition InventoryAcquisition_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAcquisition"
    ADD CONSTRAINT "InventoryAcquisition_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryFeedError InventoryFeedError_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryFeedError"
    ADD CONSTRAINT "InventoryFeedError_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryFeedError InventoryFeedError_run_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryFeedError"
    ADD CONSTRAINT "InventoryFeedError_run_fkey" FOREIGN KEY (run) REFERENCES public."InventoryFeedRun"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryFeedError InventoryFeedError_stock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryFeedError"
    ADD CONSTRAINT "InventoryFeedError_stock_fkey" FOREIGN KEY (stock) REFERENCES public."InventoryStock"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryFeedRun InventoryFeedRun_recordedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryFeedRun"
    ADD CONSTRAINT "InventoryFeedRun_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryFeedRun InventoryFeedRun_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryFeedRun"
    ADD CONSTRAINT "InventoryFeedRun_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryMerchandisingVersion InventoryMerchandisingVersion_decidedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryMerchandisingVersion"
    ADD CONSTRAINT "InventoryMerchandisingVersion_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryMerchandisingVersion InventoryMerchandisingVersion_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryMerchandisingVersion"
    ADD CONSTRAINT "InventoryMerchandisingVersion_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryMerchandisingVersion InventoryMerchandisingVersion_stock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryMerchandisingVersion"
    ADD CONSTRAINT "InventoryMerchandisingVersion_stock_fkey" FOREIGN KEY (stock) REFERENCES public."InventoryStock"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryMerchandisingVersion InventoryMerchandisingVersion_submittedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryMerchandisingVersion"
    ADD CONSTRAINT "InventoryMerchandisingVersion_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryReconWorkItem InventoryReconWorkItem_assignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReconWorkItem"
    ADD CONSTRAINT "InventoryReconWorkItem_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryReconWorkItem InventoryReconWorkItem_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReconWorkItem"
    ADD CONSTRAINT "InventoryReconWorkItem_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryReconWorkItem InventoryReconWorkItem_stock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReconWorkItem"
    ADD CONSTRAINT "InventoryReconWorkItem_stock_fkey" FOREIGN KEY (stock) REFERENCES public."InventoryStock"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryStockEvent InventoryStockEvent_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryStockEvent"
    ADD CONSTRAINT "InventoryStockEvent_actor_fkey" FOREIGN KEY (actor) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryStockEvent InventoryStockEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryStockEvent"
    ADD CONSTRAINT "InventoryStockEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryStockEvent InventoryStockEvent_stock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryStockEvent"
    ADD CONSTRAINT "InventoryStockEvent_stock_fkey" FOREIGN KEY (stock) REFERENCES public."InventoryStock"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryStock InventoryStock_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryStock"
    ADD CONSTRAINT "InventoryStock_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryStock InventoryStock_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryStock"
    ADD CONSTRAINT "InventoryStock_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadAssignmentEvent LeadAssignmentEvent_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadAssignmentEvent"
    ADD CONSTRAINT "LeadAssignmentEvent_actor_fkey" FOREIGN KEY (actor) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadAssignmentEvent LeadAssignmentEvent_fromUser_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadAssignmentEvent"
    ADD CONSTRAINT "LeadAssignmentEvent_fromUser_fkey" FOREIGN KEY ("fromUser") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeadAssignmentEvent LeadAssignmentEvent_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadAssignmentEvent"
    ADD CONSTRAINT "LeadAssignmentEvent_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadAssignmentEvent LeadAssignmentEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadAssignmentEvent"
    ADD CONSTRAINT "LeadAssignmentEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadAssignmentEvent LeadAssignmentEvent_toUser_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadAssignmentEvent"
    ADD CONSTRAINT "LeadAssignmentEvent_toUser_fkey" FOREIGN KEY ("toUser") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadRoutingRule LeadRoutingRule_assignee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadRoutingRule"
    ADD CONSTRAINT "LeadRoutingRule_assignee_fkey" FOREIGN KEY (assignee) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadRoutingRule LeadRoutingRule_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadRoutingRule"
    ADD CONSTRAINT "LeadRoutingRule_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lead Lead_assignedSalesperson_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_assignedSalesperson_fkey" FOREIGN KEY ("assignedSalesperson") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_customer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_customer_fkey" FOREIGN KEY (customer) REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lead Lead_interestedVehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_interestedVehicle_fkey" FOREIGN KEY ("interestedVehicle") REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LenderDecision LenderDecision_application_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderDecision"
    ADD CONSTRAINT "LenderDecision_application_fkey" FOREIGN KEY (application) REFERENCES public."FinancingApplication"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LenderDecision LenderDecision_recordedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderDecision"
    ADD CONSTRAINT "LenderDecision_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LenderDecision LenderDecision_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderDecision"
    ADD CONSTRAINT "LenderDecision_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LenderDecision LenderDecision_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderDecision"
    ADD CONSTRAINT "LenderDecision_submission_fkey" FOREIGN KEY (submission) REFERENCES public."LenderSubmission"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LenderSubmission LenderSubmission_application_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderSubmission"
    ADD CONSTRAINT "LenderSubmission_application_fkey" FOREIGN KEY (application) REFERENCES public."FinancingApplication"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LenderSubmission LenderSubmission_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LenderSubmission"
    ADD CONSTRAINT "LenderSubmission_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MembershipAuditEvent MembershipAuditEvent_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MembershipAuditEvent"
    ADD CONSTRAINT "MembershipAuditEvent_actor_fkey" FOREIGN KEY (actor) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MembershipAuditEvent MembershipAuditEvent_dealerGroup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MembershipAuditEvent"
    ADD CONSTRAINT "MembershipAuditEvent_dealerGroup_fkey" FOREIGN KEY ("dealerGroup") REFERENCES public."DealerGroup"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MembershipAuditEvent MembershipAuditEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MembershipAuditEvent"
    ADD CONSTRAINT "MembershipAuditEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MembershipAuditEvent MembershipAuditEvent_targetUser_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MembershipAuditEvent"
    ADD CONSTRAINT "MembershipAuditEvent_targetUser_fkey" FOREIGN KEY ("targetUser") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Model Model_make_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Model"
    ADD CONSTRAINT "Model_make_fkey" FOREIGN KEY (make) REFERENCES public."Make"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PartsInventory PartsInventory_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsInventory"
    ADD CONSTRAINT "PartsInventory_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartsMovement PartsMovement_part_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsMovement"
    ADD CONSTRAINT "PartsMovement_part_fkey" FOREIGN KEY (part) REFERENCES public."PartsInventory"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartsMovement PartsMovement_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsMovement"
    ADD CONSTRAINT "PartsMovement_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartsMovement PartsMovement_serviceOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsMovement"
    ADD CONSTRAINT "PartsMovement_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PartsPurchaseOrder PartsPurchaseOrder_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartsPurchaseOrder"
    ADD CONSTRAINT "PartsPurchaseOrder_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentProviderEvent PaymentProviderEvent_refund_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentProviderEvent"
    ADD CONSTRAINT "PaymentProviderEvent_refund_fkey" FOREIGN KEY (refund) REFERENCES public."PaymentRefund"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentProviderEvent PaymentProviderEvent_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentProviderEvent"
    ADD CONSTRAINT "PaymentProviderEvent_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentProviderEvent PaymentProviderEvent_transaction_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentProviderEvent"
    ADD CONSTRAINT "PaymentProviderEvent_transaction_fkey" FOREIGN KEY (transaction) REFERENCES public."PaymentTransaction"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentRefund PaymentRefund_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRefund"
    ADD CONSTRAINT "PaymentRefund_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentRefund PaymentRefund_transaction_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRefund"
    ADD CONSTRAINT "PaymentRefund_transaction_fkey" FOREIGN KEY (transaction) REFERENCES public."PaymentTransaction"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentTransaction PaymentTransaction_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_deal_fkey" FOREIGN KEY (deal) REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentTransaction PaymentTransaction_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentTransaction PaymentTransaction_paymentProvider_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES public."PaymentProvider"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentTransaction PaymentTransaction_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentTransaction PaymentTransaction_serviceOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PriceHistory PriceHistory_changedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PriceHistory PriceHistory_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PriceHistory PriceHistory_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ProgressiveOffer ProgressiveOffer_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgressiveOffer"
    ADD CONSTRAINT "ProgressiveOffer_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RepairOrderLineItem RepairOrderLineItem_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairOrderLineItem"
    ADD CONSTRAINT "RepairOrderLineItem_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RepairOrderLineItem RepairOrderLineItem_serviceOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairOrderLineItem"
    ADD CONSTRAINT "RepairOrderLineItem_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReportRun ReportRun_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportRun"
    ADD CONSTRAINT "ReportRun_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ReportRun ReportRun_savedReport_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportRun"
    ADD CONSTRAINT "ReportRun_savedReport_fkey" FOREIGN KEY ("savedReport") REFERENCES public."SavedReport"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RetentionPolicy RetentionPolicy_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RetentionPolicy"
    ADD CONSTRAINT "RetentionPolicy_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RooftopMembership RooftopMembership_invitedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RooftopMembership"
    ADD CONSTRAINT "RooftopMembership_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RooftopMembership RooftopMembership_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RooftopMembership"
    ADD CONSTRAINT "RooftopMembership_role_fkey" FOREIGN KEY (role) REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RooftopMembership RooftopMembership_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RooftopMembership"
    ADD CONSTRAINT "RooftopMembership_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RooftopMembership RooftopMembership_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RooftopMembership"
    ADD CONSTRAINT "RooftopMembership_user_fkey" FOREIGN KEY ("user") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Rooftop Rooftop_dealerGroup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rooftop"
    ADD CONSTRAINT "Rooftop_dealerGroup_fkey" FOREIGN KEY ("dealerGroup") REFERENCES public."DealerGroup"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesVisit SalesVisit_assignedSalesperson_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesVisit"
    ADD CONSTRAINT "SalesVisit_assignedSalesperson_fkey" FOREIGN KEY ("assignedSalesperson") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesVisit SalesVisit_customer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesVisit"
    ADD CONSTRAINT "SalesVisit_customer_fkey" FOREIGN KEY (customer) REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesVisit SalesVisit_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesVisit"
    ADD CONSTRAINT "SalesVisit_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesVisit SalesVisit_manager_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesVisit"
    ADD CONSTRAINT "SalesVisit_manager_fkey" FOREIGN KEY (manager) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesVisit SalesVisit_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesVisit"
    ADD CONSTRAINT "SalesVisit_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SalesVisit SalesVisit_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesVisit"
    ADD CONSTRAINT "SalesVisit_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SavedReport SavedReport_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SavedReport"
    ADD CONSTRAINT "SavedReport_owner_fkey" FOREIGN KEY (owner) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SavedReport SavedReport_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SavedReport"
    ADD CONSTRAINT "SavedReport_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceAppointment ServiceAppointment_assignedTech_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_assignedTech_fkey" FOREIGN KEY ("assignedTech") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceAppointment ServiceAppointment_customer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_customer_fkey" FOREIGN KEY (customer) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceAppointment ServiceAppointment_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceAppointment ServiceAppointment_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceAppointment ServiceAppointment_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceAppointment ServiceAppointment_serviceOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceAppointment ServiceAppointment_servicePackage_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceAppointment"
    ADD CONSTRAINT "ServiceAppointment_servicePackage_fkey" FOREIGN KEY ("servicePackage") REFERENCES public."ServicePackage"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceLaborOperation ServiceLaborOperation_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceLaborOperation"
    ADD CONSTRAINT "ServiceLaborOperation_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceLaborOperation ServiceLaborOperation_serviceOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceLaborOperation"
    ADD CONSTRAINT "ServiceLaborOperation_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceLaborOperation ServiceLaborOperation_technician_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceLaborOperation"
    ADD CONSTRAINT "ServiceLaborOperation_technician_fkey" FOREIGN KEY (technician) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceOrder ServiceOrder_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServicePackage ServicePackage_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServicePackage"
    ADD CONSTRAINT "ServicePackage_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_assignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TestDrive TestDrive_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestDrive"
    ADD CONSTRAINT "TestDrive_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TestDrive TestDrive_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestDrive"
    ADD CONSTRAINT "TestDrive_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TestDrive TestDrive_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestDrive"
    ADD CONSTRAINT "TestDrive_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TestDrive TestDrive_salesperson_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestDrive"
    ADD CONSTRAINT "TestDrive_salesperson_fkey" FOREIGN KEY (salesperson) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TestDrive TestDrive_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestDrive"
    ADD CONSTRAINT "TestDrive_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TradeInPhoto TradeInPhoto_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TradeInPhoto"
    ADD CONSTRAINT "TradeInPhoto_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TradeInPhoto TradeInPhoto_tradeIn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TradeInPhoto"
    ADD CONSTRAINT "TradeInPhoto_tradeIn_fkey" FOREIGN KEY ("tradeIn") REFERENCES public."TradeIn"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TradeIn TradeIn_appraisedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TradeIn"
    ADD CONSTRAINT "TradeIn_appraisedBy_fkey" FOREIGN KEY ("appraisedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TradeIn TradeIn_lead_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TradeIn"
    ADD CONSTRAINT "TradeIn_lead_fkey" FOREIGN KEY (lead) REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TradeIn TradeIn_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TradeIn"
    ADD CONSTRAINT "TradeIn_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_role_fkey" FOREIGN KEY (role) REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VehicleConditionReport VehicleConditionReport_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleConditionReport"
    ADD CONSTRAINT "VehicleConditionReport_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VehicleConditionReport VehicleConditionReport_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleConditionReport"
    ADD CONSTRAINT "VehicleConditionReport_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VehicleHistory VehicleHistory_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleHistory"
    ADD CONSTRAINT "VehicleHistory_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VehicleImage VehicleImage_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleImage"
    ADD CONSTRAINT "VehicleImage_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VehicleImage VehicleImage_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VehicleImage"
    ADD CONSTRAINT "VehicleImage_vehicle_fkey" FOREIGN KEY (vehicle) REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Vehicle Vehicle_history_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vehicle"
    ADD CONSTRAINT "Vehicle_history_fkey" FOREIGN KEY (history) REFERENCES public."VehicleHistory"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Vehicle Vehicle_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vehicle"
    ADD CONSTRAINT "Vehicle_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WeOweItem WeOweItem_deliveryCase_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeOweItem"
    ADD CONSTRAINT "WeOweItem_deliveryCase_fkey" FOREIGN KEY ("deliveryCase") REFERENCES public."DeliveryCase"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WeOweItem WeOweItem_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeOweItem"
    ADD CONSTRAINT "WeOweItem_owner_fkey" FOREIGN KEY (owner) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WeOweItem WeOweItem_rooftop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeOweItem"
    ADD CONSTRAINT "WeOweItem_rooftop_fkey" FOREIGN KEY (rooftop) REFERENCES public."Rooftop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict fHDeEyQUU592fkjGnDNGbKDZFN2zzdr1O0BnxnxEUqFnDPXH5dThxDkTdQAqyw6

