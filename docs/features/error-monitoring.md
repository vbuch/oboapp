# Error Monitoring

This document describes how production failures are observed across Google Cloud Logging, Cloud Monitoring, and Sentry.

## Overview

The production system uses two complementary monitoring layers:

- **Google Cloud Logging / Monitoring** for infrastructure visibility, Cloud Run job logs, scheduler/workflow failures, and alert policies.
- **Sentry** for application-level error grouping, stack traces, and faster investigation of repeated failures.

Use both together. Google Cloud shows whether a job or workflow ran and what it logged. Sentry shows recurring application errors in a grouped, searchable form.

## What Goes Where

### Google Cloud

Google Cloud remains the source of truth for:

- Cloud Run job execution status
- Workflow and scheduler execution history
- Structured application logs
- Alert policies based on job failures or error-level logs

### Sentry

Sentry is used for:

- Unhandled exceptions
- Error-level application logs
- Grouping repeated failures into issues
- Reviewing stack traces without searching raw logs

The application uses separate Sentry projects for the web app, public API, and ingest pipeline.

## Ingest Pipeline Behavior

The ingest pipeline distinguishes between **handled data-quality problems** and **unexpected application failures**.

### Handled Geocoding Misses

Some messages cannot be geocoded into map features even though the pipeline itself is working correctly. Typical examples:

- locations extracted from text but not resolvable by geocoding services
- transient Overpass saturation while resolving street intersections
- messages that finalize without any valid geometry

These messages are finalized without GeoJSON and recorded in `ingestErrors` for later inspection. They do **not** represent a crashed ingest run.

### Unexpected Failures

Unexpected runtime failures still behave as real errors:

- uncaught exceptions
- broken configuration
- code regressions
- downstream service failures that abort job execution

These should appear in both Cloud Logging and Sentry.

## Overpass / Street Geocoding

Street geocoding depends on Overpass. Transient rate limiting or timeouts are treated as recoverable operational noise first, not immediate pipeline crashes.

Current behaviour:

- retryable Overpass failures are logged as warnings
- the ingest pipeline can still finalize a message without geometry
- only true job failures should continue to drive Cloud Monitoring alerts

This avoids alert fatigue during temporary Overpass saturation while preserving an audit trail in logs and `ingestErrors`.

## Operational Checks

When production issues are reported:

1. Check the relevant Cloud Run job or workflow execution in Google Cloud.
2. Check logs for repeated warnings versus real job failures.
3. Check the corresponding Sentry project for grouped application errors.
4. If messages were finalized without GeoJSON, inspect `ingestErrors` instead of treating them as infrastructure failures.

## Configuration

Sentry setup for each runtime is documented separately in the setup guide:

- [Sentry Setup](../setup/sentry-setup.md)

That guide covers:

- required environment variables
- Secret Manager usage for Cloud Run
- Terraform enablement via `sentry_dsn_secret_id`
- source map uploads for the web app