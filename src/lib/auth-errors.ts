export function authErrorMessage(err: unknown) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Erro inesperado";
  const lower = message.toLowerCase();

  if (lower.includes("email rate limit exceeded")) {
    return "Limite de emails do Supabase atingido. Tenta mais tarde.";
  }
  if (lower.includes("user already registered")) {
    return "Este email já está registado. Usa «Entrar».";
  }
  if (lower.includes("invalid login")) {
    return "Email ou password incorretos.";
  }
  if (lower.includes("for security purposes") || lower.includes("only request this after")) {
    return "Aguarda alguns segundos antes de pedir outro email.";
  }
  return message;
}
