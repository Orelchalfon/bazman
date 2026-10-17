import AuthButton from "@/components/auth/AuthButton";
import AuthField from "@/components/auth/AuthField";
import AuthShell from "@/components/auth/AuthShell";
import CodeField from "@/components/auth/CodeField";
import FormBanner from "@/components/auth/FormBanner";
import ResendCode from "@/components/auth/ResendCode";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import {
  AuthFieldErrors,
  describeFieldError,
  describeGlobalError,
  hasErrors,
  logAuthError,
  maskEmail,
  normalizeEmail,
  unmappedFieldError,
  validateCode,
  validateEmail,
  validatePasswordPresent,
} from "@/lib/auth";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { posthog } from "@/lib/posthog";
import { posthogLog } from "@/lib/posthog-logs";
import { useSignIn } from "@clerk/expo";
import { Link, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type Pending = "submit" | "verify" | "resend" | null;

/** Renders password sign-in and email verification, tracking completed sign-ins. */
export default function SignIn() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const cooldown = useResendCooldown();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [clientErrors, setClientErrors] = useState<AuthFieldErrors>({});
  const [localBanner, setLocalBanner] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  // The step comes from the sign-in attempt itself, so it survives remounts.
  const needsEmailCheck =
    (signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust") &&
    !!signIn.supportedSecondFactors?.some(
      (factor) => factor.strategy === "email_code",
    );

  // Clear a stale attempt (and its errors) left by another screen, unless it's mid-verification.
  useEffect(() => {
    if (!needsEmailCheck) signIn.reset();
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Returning from a password reset that still needs a fresh sign-in.
  useEffect(() => {
    if (reset) setInfo("Password updated. Sign in with your new password.");
  }, [reset]);

  const busy = pending !== null || fetchStatus === "fetching";
  const banner = localBanner ?? describeGlobalError(errors.global);
  const fieldErrors = {
    email: clientErrors.email ?? describeFieldError(errors.fields.identifier),
    password:
      clientErrors.password ?? describeFieldError(errors.fields.password),
    code: clientErrors.code ?? describeFieldError(errors.fields.code),
  };

  const validateCredentials = (next = { email, password }) => ({
    email: validateEmail(next.email),
    password: validatePasswordPresent(next.password),
  });

  const fail = (error: unknown) => {
    logAuthError(error);
    setLocalBanner(unmappedFieldError(error, Object.keys(errors.fields)));
    setInfo(undefined);
    hapticError();
  };

  const finalize = async () => {
    const { error } = await signIn.finalize({
      navigate: ({ session }) => {
        if (session?.currentTask) {
          setLocalBanner(
            "Your account needs one more step before you can continue.",
          );
          return;
        }
        // The root navigator's protected routes take over once the session is active.
        posthog?.capture("user_signed_in");
        posthogLog.authenticationCompleted("sign_in");
        hapticSuccess();
      },
    });
    if (error) fail(error);
  };

  const handleSignIn = async () => {
    if (busy) return;
    setSubmitted(true);
    setLocalBanner(undefined);

    const nextErrors = validateCredentials();
    setClientErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      hapticError();
      return;
    }

    setPending("submit");
    try {
      const { error } = await signIn.password({
        emailAddress: normalizeEmail(email),
        password,
      });
      if (error) return fail(error);

      if (signIn.status === "complete") {
        await finalize();
        return;
      }

      const needsSecondStep =
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_client_trust";
      const supportsEmail = signIn.supportedSecondFactors?.some(
        (factor) => factor.strategy === "email_code",
      );

      if (needsSecondStep && supportsEmail) {
        // Switches this screen to the code step via `needsEmailCheck`.
        const { error: sendError } = await signIn.mfa.sendEmailCode();
        if (sendError) return fail(sendError);
        cooldown.start();
        setCode("");
        return;
      }

      setLocalBanner(
        needsSecondStep
          ? "This account uses an extra verification method that isn't supported in the app yet."
          : "We couldn't finish signing you in. Please try again.",
      );
      hapticError();
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const handleVerify = async (value = code) => {
    if (busy) return;
    setLocalBanner(undefined);
    const codeError = validateCode(value);
    setClientErrors({ code: codeError });
    if (codeError) {
      hapticError();
      return;
    }

    setPending("verify");
    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code: value });
      if (error) return fail(error);

      if (signIn.status === "complete") {
        await finalize();
      } else {
        setLocalBanner("We couldn't verify this sign-in. Please try again.");
        hapticError();
      }
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
      const { error } = await signIn.mfa.sendEmailCode();
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

  const backToCredentials = async () => {
    await signIn.reset();
    setCode("");
    setClientErrors({});
    setLocalBanner(undefined);
    setInfo(undefined);
  };

  if (needsEmailCheck) {
    const identifier = signIn.identifier ?? normalizeEmail(email);

    return (
      <AuthShell
        title='Confirm it’s you'
        subtitle={
          <>
            We noticed a new device. Enter the 6-digit code we sent to{" "}
            <Text className='auth-email-highlight'>
              {maskEmail(identifier)}
            </Text>
            .
          </>
        }
        onBack={backToCredentials}
        footer={
          <View className='auth-link-row'>
            <Pressable onPress={backToCredentials} hitSlop={8}>
              <Text className='auth-link'>Use a different account</Text>
            </Pressable>
          </View>
        }>
        <View className='auth-form'>
          <FormBanner message={banner} />
          {!banner && <FormBanner message={info} tone='info' />}
          <CodeField
            value={code}
            onChangeText={(value) => {
              setCode(value);
              if (clientErrors.code) setClientErrors({});
            }}
            onComplete={handleVerify}
            error={fieldErrors.code}
          />
          <AuthButton
            label='Verify and continue'
            onPress={() => handleVerify()}
            loading={pending === "verify"}
            disabled={busy}
          />
          <ResendCode
            onResend={handleResend}
            secondsLeft={cooldown.secondsLeft}
            loading={pending === "resend"}
          />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title='Welcome back'
      subtitle='Sign in to keep every renewal in check.'
      footer={
        <View className='auth-link-row'>
          <Text className='auth-link-copy'>New to BazMan?</Text>
          <Link href='/sign-up' replace asChild>
            <Pressable hitSlop={8} accessibilityRole='link'>
              <Text className='auth-link'>Create an account</Text>
            </Pressable>
          </Link>
        </View>
      }>
      <View className='auth-form'>
        <FormBanner message={banner} />
        {!banner && <FormBanner message={info} tone='info' />}

        <AuthField
          label='Email'
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (submitted)
              setClientErrors(validateCredentials({ email: value, password }));
          }}
          error={fieldErrors.email}
          placeholder='you@example.com'
          keyboardType='email-address'
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='email'
          textContentType='emailAddress'
          returnKeyType='next'
          submitBehavior='submit'
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!busy}
          ltr
          style={{ paddingStart: 8 }}
        />

        <AuthField
          ref={passwordRef}
          label='Password'
          labelAccessory={
            <Link href='/forgot-password' asChild>
              <Pressable hitSlop={8} accessibilityRole='link'>
                <Text className='auth-forgot'>Forgot password?</Text>
              </Pressable>
            </Link>
          }
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (submitted)
              setClientErrors(validateCredentials({ email, password: value }));
          }}
          error={fieldErrors.password}
          placeholder='Enter your password'
          secureToggle
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='current-password'
          textContentType='password'
          returnKeyType='go'
          onSubmitEditing={handleSignIn}
          editable={!busy}
          ltr
          style={{ paddingStart: 8 }}

        />

        <AuthButton
          label='Sign in'
          onPress={handleSignIn}
          loading={pending === "submit"}
          disabled={busy}
        />
      </View>
    </AuthShell>
  );
}
