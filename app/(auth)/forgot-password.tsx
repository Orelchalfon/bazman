import AuthButton from "@/components/auth/AuthButton";
import AuthField from "@/components/auth/AuthField";
import AuthShell from "@/components/auth/AuthShell";
import CodeField from "@/components/auth/CodeField";
import FormBanner from "@/components/auth/FormBanner";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import ResendCode from "@/components/auth/ResendCode";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import {
  AuthFieldErrors,
  describeFieldError,
  describeGlobalError,
  hasErrors,
  logAuthError,
  normalizeEmail,
  unmappedFieldError,
  validateCode,
  validateEmail,
  validateNewPassword,
} from "@/lib/auth";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { posthog } from "@/lib/posthog";
import { useSignIn } from "@clerk/expo";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

type Pending = "submit" | "reset" | "resend" | null;

/** Renders email code password recovery and tracks successful password resets. */
export default function ForgotPassword() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const cooldown = useResendCooldown();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [clientErrors, setClientErrors] = useState<AuthFieldErrors>({});
  const [localBanner, setLocalBanner] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [pending, setPending] = useState<Pending>(null);

  // Steps come from the sign-in attempt itself, so they survive remounts.
  const codeVerified = signIn.status === "needs_new_password";
  const resetting =
    codeVerified ||
    (signIn.status === "needs_first_factor" &&
      signIn.firstFactorVerification?.strategy === "reset_password_email_code");

  // Clear a stale sign-in attempt (and its errors), unless a reset is already in progress.
  useEffect(() => {
    if (!resetting) signIn.reset();
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = pending !== null || fetchStatus === "fetching";
  const banner = localBanner ?? describeGlobalError(errors.global);
  const fieldErrors = {
    email: clientErrors.email ?? describeFieldError(errors.fields.identifier),
    code: clientErrors.code ?? describeFieldError(errors.fields.code),
    password:
      clientErrors.password ?? describeFieldError(errors.fields.password),
  };

  const fail = (error: unknown) => {
    logAuthError(error);
    setLocalBanner(unmappedFieldError(error, Object.keys(errors.fields)));
    setInfo(undefined);
    hapticError();
  };

  const goToSignIn = () => {
    signIn.reset();
    if (router.canGoBack()) router.back();
    else router.replace("/sign-in");
  };

  const handleSendCode = async () => {
    if (busy) return;
    setLocalBanner(undefined);
    const emailError = validateEmail(email);
    setClientErrors({ email: emailError });
    if (emailError) {
      hapticError();
      return;
    }

    setPending("submit");
    try {
      const { error } = await signIn.create({
        identifier: normalizeEmail(email),
      });
      if (error) return fail(error);

      // Switches this screen to the reset step via `resetting`.
      const { error: sendError } =
        await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) return fail(sendError);

      cooldown.start();
      setClientErrors({});
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const handleReset = async () => {
    if (busy) return;
    setLocalBanner(undefined);
    const nextErrors: AuthFieldErrors = {
      code: codeVerified ? undefined : validateCode(code),
      password: validateNewPassword(password),
    };
    setClientErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      hapticError();
      return;
    }

    setPending("reset");
    try {
      // Skip re-verifying if the code was accepted and only the password was rejected.
      if (!codeVerified) {
        const { error } = await signIn.resetPasswordEmailCode.verifyCode({
          code,
        });
        if (error) return fail(error);
      }

      const { error: submitError } =
        await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });
      if (submitError) return fail(submitError);

      posthog?.capture("password_reset_completed");

      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({
          navigate: () => hapticSuccess(),
        });
        if (finalizeError) fail(finalizeError);
        return;
      }

      hapticSuccess();
      const needsSecondStep =
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_client_trust";
      const supportsEmail = signIn.supportedSecondFactors?.some(
        (factor) => factor.strategy === "email_code",
      );

      if (needsSecondStep && supportsEmail) {
        // Sign-in derives its code step from this same attempt.
        const { error: sendError } = await signIn.mfa.sendEmailCode();
        if (sendError) return fail(sendError);
        router.dismissTo("/sign-in");
        return;
      }

      // Password changed, but this account needs a fresh sign-in.
      await signIn.reset();
      router.dismissTo({ pathname: "/sign-in", params: { reset: "1" } });
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const handleResend = async () => {
    if (busy || !cooldown.canResend) return;
    setPending("resend");
    setLocalBanner(undefined);
    try {
      const { error } = await signIn.resetPasswordEmailCode.sendCode();
      if (error) return fail(error);
      cooldown.start();
      setClientErrors({});
      setInfo("A new code is on its way.");
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const footer = (
    <View className='auth-link-row'>
      <Text className='auth-link-copy'>Remembered it?</Text>
      <Pressable onPress={goToSignIn} hitSlop={8} accessibilityRole='link'>
        <Text className='auth-link'>Back to sign in</Text>
      </Pressable>
    </View>
  );

  if (resetting) {
    const sentTo = signIn.identifier ?? normalizeEmail(email);

    return (
      <AuthShell
        title='Set a new password'
        subtitle={
          codeVerified ? (
            "Code confirmed. Choose a new password to finish."
          ) : (
            <>
              Enter the code we sent to{" "}
              <Text className='auth-email-highlight'>{sentTo}</Text> and choose
              a new password.
            </>
          )
        }
        onBack={() => {
          signIn.reset();
          setCode("");
          setPassword("");
          setClientErrors({});
          setLocalBanner(undefined);
          setInfo(undefined);
        }}
        footer={footer}>
        <View className='auth-form'>
          <FormBanner message={banner} />
          {!banner && <FormBanner message={info} tone='info' />}

          {!codeVerified && (
            <CodeField
              value={code}
              onChangeText={(value) => {
                setCode(value);
                if (clientErrors.code)
                  setClientErrors((prev) => ({ ...prev, code: undefined }));
              }}
              error={fieldErrors.code}
            />
          )}

          <AuthField
            label='New password'
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (clientErrors.password)
                setClientErrors((prev) => ({
                  ...prev,
                  password: validateNewPassword(value),
                }));
            }}
            error={fieldErrors.password}
            helper={<PasswordStrengthMeter password={password} />}
            placeholder='Create a new password'
            secureToggle
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='new-password'
            textContentType='newPassword'
            returnKeyType='go'
            onSubmitEditing={handleReset}
            editable={!busy}
            ltr
          />

          <AuthButton
            label='Update password'
            onPress={handleReset}
            loading={pending === "reset"}
            disabled={busy}
          />

          {!codeVerified && (
            <ResendCode
              onResend={handleResend}
              secondsLeft={cooldown.secondsLeft}
              loading={pending === "resend"}
            />
          )}
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title='Reset your password'
      subtitle='Enter the email you signed up with and we’ll send you a reset code.'
      onBack={goToSignIn}
      footer={footer}>
      <View className='auth-form'>
        <FormBanner message={banner} />

        <AuthField
          label='Email'
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (clientErrors.email)
              setClientErrors({ email: validateEmail(value) });
          }}
          error={fieldErrors.email}
          placeholder='you@example.com'
          keyboardType='email-address'
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='email'
          textContentType='emailAddress'
          returnKeyType='send'
          onSubmitEditing={handleSendCode}
          editable={!busy}
          autoFocus
          ltr
        />

        <AuthButton
          label='Send reset code'
          onPress={handleSendCode}
          loading={pending === "submit"}
          disabled={busy}
        />
      </View>
    </AuthShell>
  );
}
