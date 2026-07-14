import "server-only";

export interface DevLoginCredentials {
  email: string;
  password: string;
}

interface DevLoginEnv {
  NODE_ENV?: string;
  DEV_LOGIN_EMAIL?: string;
  DEV_LOGIN_PASSWORD?: string;
}

export function getDevLoginCredentials(
  env: DevLoginEnv = process.env
): DevLoginCredentials | undefined {
  if (env.NODE_ENV === "production") return undefined;

  const email = env.DEV_LOGIN_EMAIL?.trim();
  const password = env.DEV_LOGIN_PASSWORD;

  if (!email || !password) return undefined;

  return { email, password };
}
