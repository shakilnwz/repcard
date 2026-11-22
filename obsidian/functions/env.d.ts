export interface AuthEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ALLOWED_REPO?: string;
}

export interface CFEventContext<Env = AuthEnv> {
  request: Request;
  env: Env;
}

export type CFPagesFunction<Env = AuthEnv> = (
  context: CFEventContext<Env>,
) => Response | Promise<Response>;
