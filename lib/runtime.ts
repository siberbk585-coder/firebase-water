/** Nhận diện môi trường serverless / App Hosting / Cloud Run. */
export function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.K_SERVICE)
  );
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
