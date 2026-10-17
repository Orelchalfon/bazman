import { isClerkAPIResponseError } from "@clerk/expo";

export type AuthFieldKey = "firstName" | "email" | "password" | "code";
export type AuthFieldErrors = Partial<Record<AuthFieldKey, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const CODE_LENGTH = 6;

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const validateEmail = (value: string): string | undefined => {
    const email = value.trim();
    if (!email) return "Enter your email address.";
    if (!EMAIL_PATTERN.test(email)) return "That email doesn't look right.";
    return undefined;
};

/** Sign-in only checks presence; strength rules apply when a password is created. */
export const validatePasswordPresent = (value: string): string | undefined =>
    value ? undefined : "Enter your password.";

export const validateNewPassword = (value: string): string | undefined => {
    if (!value) return "Create a password.";
    if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Mix letters and numbers.";
    return undefined;
};

export const validateName = (value: string): string | undefined => {
    const name = value.trim();
    if (!name) return "Tell us what to call you.";
    if (name.length < 2) return "Name is too short.";
    if (name.length > 50) return "Name is too long.";
    return undefined;
};

export const validateCode = (value: string): string | undefined => {
    if (!value) return "Enter the 6-digit code.";
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value)) return "The code has 6 digits.";
    return undefined;
};

export type PasswordStrength = 0 | 1 | 2 | 3;

export const getPasswordStrength = (value: string): PasswordStrength => {
    if (!value) return 0;
    let score = 0;
    if (value.length >= PASSWORD_MIN_LENGTH) score++;
    if (/[A-Za-z]/.test(value) && /\d/.test(value)) score++;
    if (value.length >= 12 || /[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(score, 3) as PasswordStrength;
};

export const hasErrors = (errors: AuthFieldErrors): boolean =>
    Object.values(errors).some(Boolean);

/** Friendly, brand-native copy for known auth error codes. Unknown codes fall back to the server's message. */
const ERROR_COPY: Record<string, string> = {
    form_identifier_not_found: "We couldn't find an account with that email.",
    form_password_incorrect: "That password isn't right. Try again or reset it.",
    form_password_pwned: "This password appeared in a data breach. Please choose a different one.",
    form_password_validation_failed: "That password isn't right.",
    form_identifier_exists: "An account with this email already exists. Sign in instead.",
    form_code_incorrect: "That code isn't right. Check your inbox and try again.",
    verification_expired: "This code has expired. Request a new one.",
    verification_failed: "Too many attempts. Request a new code.",
    too_many_requests: "Too many attempts. Please wait a moment and try again.",
    session_exists: "You're already signed in.",
    strategy_for_user_invalid: "This account can't sign in with a password.",
    network_error: "You appear to be offline. Check your connection and try again.",
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

interface ServerError {
    code: string;
    message: string;
    longMessage?: string;
}

const describe = (error: ServerError): string =>
    ERROR_COPY[error.code] ?? error.longMessage ?? error.message ?? GENERIC_ERROR;

/** Message for one entry of the auth hooks' `errors.fields`. */
export const describeFieldError = (error?: ServerError | null): string | undefined =>
    error ? describe(error) : undefined;

/** Banner message for the auth hooks' `errors.global` (errors not tied to a field, e.g. rate limits or network). */
export const describeGlobalError = (errors?: readonly unknown[] | null): string | undefined => {
    const error = errors?.[0];
    if (!error) return undefined;
    if (isClerkAPIResponseError(error) && error.errors[0]) return describe(error.errors[0]);
    if (error && typeof error === "object" && "code" in error) {
        const code = String((error as { code: unknown }).code);
        if (ERROR_COPY[code]) return ERROR_COPY[code];
    }
    return GENERIC_ERROR;
};

const toCamelCase = (value: string) => value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

/**
 * The hooks drop field errors whose param has no matching key in `errors.fields`
 * (e.g. `email_address` on a sign-in). Returns that message so it can still be shown.
 */
export const unmappedFieldError = (error: unknown, fieldKeys: readonly string[]): string | undefined => {
    if (!isClerkAPIResponseError(error)) return undefined;
    const unmapped = error.errors.find((apiError) => {
        const paramName = apiError.meta?.paramName as string | undefined;
        return paramName !== undefined && !fieldKeys.includes(toCamelCase(paramName));
    });
    return unmapped ? describe(unmapped) : undefined;
};

export const logAuthError = (error: unknown) => {
    if (__DEV__) {
        console.warn("[auth] request failed:", isClerkAPIResponseError(error) ? error.errors : error);
    }
};

export const maskEmail = (email: string): string => {
    const [user, domain] = email.split("@");
    if (!user || !domain) return email;
    const visible = user.length <= 2 ? user[0] : user.slice(0, 2);
    return `${visible}${"•".repeat(Math.max(user.length - visible.length, 1))}@${domain}`;
};
