import {
  ServiceConfigurationError,
  type ServiceResult,
  serviceFailure,
  serviceSuccess,
} from "./errors";

export interface AppPublicEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export type EnvSource = {
  readonly [key: string]: string | undefined;
};

const requiredEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

/* Client bundles cannot read the dynamic `process.env` object at runtime.
   Keep each public key as a direct property access so Next can inline the
   values into browser code during build. */
function bundledPublicEnv(): EnvSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * Validate lazily at service construction time. Import-time validation would
 * make tests, Storybook, and `next build` depend on the developer's shell env
 * even when no Supabase client is being created.
 */
export function validatePublicEnv(
  source: EnvSource = bundledPublicEnv()
): ServiceResult<AppPublicEnv> {
  const missing = requiredEnvKeys.filter((key) => !source[key]?.trim());
  if (missing.length > 0) {
    return serviceFailure(
      new ServiceConfigurationError({
        message: `Missing required public environment variables: ${missing.join(
          ", "
        )}.`,
        operation: "env.validatePublicEnv",
        details: { missing },
      })
    );
  }

  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const supabasePublishableKey =
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim();

  try {
    new URL(supabaseUrl);
  } catch (error) {
    return serviceFailure(
      new ServiceConfigurationError({
        message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL.",
        operation: "env.validatePublicEnv",
        details: { invalid: ["NEXT_PUBLIC_SUPABASE_URL"] },
        cause: error,
      })
    );
  }

  return serviceSuccess({ supabaseUrl, supabasePublishableKey });
}

export function getPublicEnv(source: EnvSource = bundledPublicEnv()): AppPublicEnv {
  const result = validatePublicEnv(source);
  if (!result.ok) {
    throw result.error;
  }
  return result.data;
}

export function isAppPublicEnv(
  value: AppPublicEnv | EnvSource | undefined
): value is AppPublicEnv {
  return (
    typeof value?.supabaseUrl === "string" &&
    typeof value.supabasePublishableKey === "string"
  );
}
