#!/usr/bin/env node
/**
 * Gắn Cloud SQL vào Cloud Run backend App Hosting + IAM cloudsql.client.
 * Chạy sau mỗi lần deploy nếu instance bị mất (App Hosting không khai báo trong apphosting.yaml).
 */
import { execFileSync, execSync } from "node:child_process";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "tiennuoc";
const REGION = "asia-southeast1";
const SERVICE = "tiennuoc";
const INSTANCE = "tiennuoc:asia-southeast1:tiennuoc-db";
const SA = `firebase-app-hosting-compute@${PROJECT}.iam.gserviceaccount.com`;

console.log("Gắn Cloud SQL instance vào Cloud Run…");
execFileSync(
  "gcloud",
  [
    "run",
    "services",
    "update",
    SERVICE,
    `--region=${REGION}`,
    `--project=${PROJECT}`,
    `--add-cloudsql-instances=${INSTANCE}`,
    "--quiet",
  ],
  { stdio: "inherit" }
);

console.log("Grant roles/cloudsql.client cho App Hosting compute SA…");
try {
  execFileSync(
    "gcloud",
    [
      "projects",
      "add-iam-policy-binding",
      PROJECT,
      `--member=serviceAccount:${SA}`,
      "--role=roles/cloudsql.client",
      "--quiet",
    ],
    { stdio: "inherit" }
  );
} catch {
  console.warn("(IAM có thể đã được gán trước đó)");
}

function latestRevisionWithCloudSql() {
  const json = execSync(
    `gcloud run revisions list --service=${SERVICE} --region=${REGION} --project=${PROJECT} --format=json --limit=15`,
    { encoding: "utf8" }
  );
  const revisions = JSON.parse(json);
  for (const rev of revisions) {
    const instances =
      rev.metadata?.annotations?.["run.googleapis.com/cloudsql-instances"] ?? "";
    if (instances.includes(INSTANCE)) {
      return rev.metadata?.name ?? null;
    }
  }
  return null;
}

const cloudSqlRevision = latestRevisionWithCloudSql();
if (cloudSqlRevision) {
  console.log(`Chuyển traffic sang revision có Cloud SQL: ${cloudSqlRevision}`);
  execFileSync(
    "gcloud",
    [
      "run",
      "services",
      "update-traffic",
      SERVICE,
      `--region=${REGION}`,
      `--project=${PROJECT}`,
      `--to-revisions=${cloudSqlRevision}=100`,
      "--quiet",
    ],
    { stdio: "inherit" }
  );
} else {
  console.warn("Không tìm thấy revision có Cloud SQL — kiểm tra thủ công.");
}

console.log("Xong. Kiểm tra: gcloud run services describe", SERVICE, "--region", REGION);
