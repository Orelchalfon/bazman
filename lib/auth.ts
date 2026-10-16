import { isClerkAPIResponseError } from "@clerk/expo";

export type AuthFieldKey = "firstName" | "email" | "password" | "code";
export type AuthFieldErrors = Partial<Record<AuthFieldKey, string>>;

export interface AuthErrorResult {
    fields: AuthFieldErrors;
    message?: string;
}

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

/** Friendly, brand-native copy for known auth error codes. */
const ERROR_COPY: Record<string, { message: string; field?: AuthFieldKey }> = {
    form_identifier_not_found: { message: "We couldn't find an account with that email.", field: "email" },
    form_password_incorrect: { message: "That password isn't right. Try again or reset it.", field: "password" },
    form_password_pwned: {
        message: "This password appeared in a data breach. Please choose a different one.",
        field: "password",
    },
    form_password_validation_failed: { message: "That password isn't right.", field: "password" },
    form_identifier_exists: { message: "An account with this email already exists. Sign in instead.", field: "email" },
    form_param_format_invalid: { message: "Please check this field." },
    form_code_incorrect: { message: "That code isn't right. Check your inbox and try again.", field: "code" },
    verification_expired: { message: "This code has expired. Request a new one.", field: "code" },
    verification_failed: { message: "Too many attempts. Request a new code.", field: "code" },
    too_many_requests: { message: "Too many attempts. Please wait a moment and try again." },
    session_exists: { message: "You're already signed in." },
    strategy_for_user_invalid: { message: "This account can't sign in with a password." },
    network_error: { message: "You appear to be offline. Check your connection and try again." },
};

const PARAM_TO_FIELD: Record<string, AuthFieldKey> = {
    email_address: "email",
    identifier: "email",
    password: "password",
    code: "code",
    first_name: "firstName",
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Turns an auth API error into per-field messages plus an optional banner message. */
export const parseAuthError = (error: unknown): AuthErrorResult => {
    const result: AuthErrorResult = { fields: {} };

    if (__DEV__) {
        console.warn("[auth] request failed:", isClerkAPIResponseError(error) ? error.errors : error);
    }

    if (isClerkAPIResponseError(error) && error.errors.length > 0) {
        for (const apiError of error.errors) {
            const known = ERROR_COPY[apiError.code];
            const paramName = apiError.meta?.paramName as string | undefined;
            const field = known?.field ?? (paramName ? PARAM_TO_FIELD[paramName] : undefined);
            const message = known?.message ?? apiError.longMessage ?? apiError.message ?? GENERIC_ERROR;

            if (field && !result.fields[field]) {
                result.fields[field] = message;
            } else if (!field && !result.message) {
                result.message = message;
            }
        }
        return result;
    }

    if (error && typeof error === "object" && "code" in error) {
        const code = String((error as { code: unknown }).code);
        const known = ERROR_COPY[code];
        if (known) {
            if (known.field) result.fields[known.field] = known.message;
            else result.message = known.message;
            return result;
        }
    }

    result.message = GENERIC_ERROR;
    return result;
};

export const maskEmail = (email: string): string => {
    const [user, domain] = email.split("@");
    if (!user || !domain) return email;
    const visible = user.length <= 2 ? user[0] : user.slice(0, 2);
    return `${visible}${"•".repeat(Math.max(user.length - visible.length, 1))}@${domain}`;
};
