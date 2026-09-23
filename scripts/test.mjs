import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { MinioContainer } from "@testcontainers/minio";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const root = fileURLToPath(new URL("../", import.meta.url));
const testDirectory = join(root, "tests");
const files = (await readdir(testDirectory))
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => join(testDirectory, name));

// Testcontainers does not inspect the Docker CLI's active context.
if (!process.env.DOCKER_HOST) {
  try {
    process.env.DOCKER_HOST = execFileSync(
      "docker",
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    // Let Testcontainers report the unavailable Docker daemon.
  }
}
if (
  process.env.DOCKER_HOST?.includes("/.colima/") &&
  !process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE
) {
  process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = "/var/run/docker.sock";
}

let container;
let minio;
let child;
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    interrupted = true;
    child?.kill(signal);
  });
}

try {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  if (interrupted) throw new Error("Test run interrupted");
  const connectionString = container.getConnectionUri();
  const pool = new pg.Pool({ connectionString });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: join(root, "drizzle") });
  } finally {
    await pool.end();
  }

  minio = await new MinioContainer("quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z").start();
  if (interrupted) throw new Error("Test run interrupted");
  const endpoint = `http://${minio.getHost()}:${minio.getPort()}`;
  const bucket = "recipi-test";
  const storage = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "minioadmin", secretAccessKey: "minioadmin" },
  });
  try {
    await storage.send(new CreateBucketCommand({ Bucket: bucket }));
  } finally {
    storage.destroy();
  }

  child = spawn(process.execPath, ["--import", "tsx", "--test", ...files], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      S3_BUCKET: bucket,
      S3_ENDPOINT: endpoint,
      S3_REGION: "us-east-1",
      S3_FORCE_PATH_STYLE: "true",
      AWS_ACCESS_KEY_ID: "minioadmin",
      AWS_SECRET_ACCESS_KEY: "minioadmin",
    },
    stdio: "inherit",
  });
  const { code, signal } = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
} catch (error) {
  console.error(error);
  process.exitCode = interrupted ? 130 : 1;
} finally {
  try {
    await minio?.stop();
  } finally {
    await container?.stop();
  }
}
