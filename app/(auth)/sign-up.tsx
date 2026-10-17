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
  validateName,
  validateNewPassword,
} from "@/lib/auth";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { posthog } from "@/lib/posthog";
import { posthogLog } from "@/lib/posthog-logs";
import { useSignUp } from "@clerk/expo";
import { Link } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type Pending = "submit" | "verify" | "resend" | null;

export default function SignUp() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const cooldown = useResendCooldown();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [clientErrors, setClientErrors] = useState<AuthFieldErrors>({});
  const [localBanner, setLocalBanner] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  // The step comes from the sign-up attempt itself, so it survives remounts.
  const needsEmailVerification =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  // Clear a stale attempt (and its errors), unless it's waiting on the email code.
  useEffect(() => {
    if (!needsEmailVerification) signUp.reset();
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = pending !== null || fetchStatus === "fetching";
  const banner = localBanner ?? describeGlobalError(errors.global);
  const fieldErrors = {
    firstName:
      clientErrors.firstName ?? describeFieldError(errors.fields.firstName),
    email: clientErrors.email ?? describeFieldError(errors.fields.emailAddress),
    password:
      clientErrors.password ?? describeFieldError(errors.fields.password),
    code: clientErrors.code ?? describeFieldError(errors.fields.code),
  };

  const validateDetails = (next = { firstName, email, password }) => ({
    firstName: validateName(next.firstName),
    email: validateEmail(next.email),
    password: validateNewPassword(next.password),
  });

  const fail = (error: unknown) => {
    logAuthError(error);
    setLocalBanner(unmappedFieldError(error, Object.keys(errors.fields)));
    setInfo(undefined);
    hapticError();
  };

  const handleSignUp = async () => {
    if (busy) return;
    setSubmitted(true);
    setLocalBanner(undefined);

    const nextErrors = validateDetails();
    setClientErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      hapticError();
      return;
    }

    setPending("submit");
    try {
      const { error } = await signUp.password({
        emailAddress: normalizeEmail(email),
        password,
        firstName: firstName.trim(),
      });
      if (error) return fail(error);

      if (signUp.missingFields.length > 0) {
        setLocalBanner(
          "We need a bit more information to create your account. Please try again later.",
        );
        hapticError();
        return;
      }

      // Switches this screen to the code step via `needsEmailVerification`.
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) return fail(sendError);

      cooldown.start();
      setCode("");
      setClientErrors({});
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
      const { error } = await signUp.verifications.verifyEmailCode({
        code: value,
      });
      if (error) return fail(error);

      if (signUp.status !== "complete") {
        setLocalBanner(
          "Your email is verified, but we need a bit more information to finish creating your account.",
        );
        hapticError();
        return;
      }

      const { error: finalizeError } = await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) {
            setLocalBanner(
              "Your account needs one more step before you can continue.",
            );
            return;
          }
          // The root navigator's protected routes take over once the session is active.
          posthog?.capture("user_signed_up");
          posthogLog.authenticationCompleted("sign_up");
          hapticSuccess();
        },
      });
      if (finalizeError) fail(finalizeError);
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
      const { error } = await signUp.verifications.sendEmailCode();
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

  const editDetails = async () => {
    await signUp.reset();
    setCode("");
    setClientErrors({});
    setLocalBanner(undefined);
    setInfo(undefined);
  };

  if (needsEmailVerification) {
    const sentTo = signUp.emailAddress ?? normalizeEmail(email);

    return (
      <AuthShell
        title='Check your inbox'
        subtitle={
          <>
            We sent a 6-digit code to{" "}
            <Text className='auth-email-highlight'>{sentTo}</Text>. Enter it
            below to activate your account.
          </>
        }
        onBack={editDetails}
        footer={
          <View className='auth-link-row'>
            <Text className='auth-link-copy'>Wrong email?</Text>
            <Pressable onPress={editDetails} hitSlop={8}>
              <Text className='auth-link'>Edit details</Text>
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
            label='Verify email'
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
      title='Create your account'
      subtitle='Track every subscription and never miss a renewal again.'
      footer={
        <View className='auth-link-row'>
          <Text className='auth-link-copy'>Already have an account?</Text>
          <Link href='/sign-in' replace asChild>
            <Pressable hitSlop={8} accessibilityRole='link'>
              <Text className='auth-link'>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      }>
      <View className='auth-form'>
        <FormBanner message={banner} />

        <AuthField
          label='First name'
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            if (submitted)
              setClientErrors(
                validateDetails({ firstName: value, email, password }),
              );
          }}
          error={fieldErrors.firstName}
          placeholder='What should we call you?'
          autoCapitalize='words'
          autoComplete='given-name'
          textContentType='givenName'
          returnKeyType='next'
          submitBehavior='submit'
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!busy}
          style={{ paddingStart: 8 }}
        />

        <AuthField
          ref={emailRef}
          label='Email'
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (submitted)
              setClientErrors(
                validateDetails({ firstName, email: value, password }),
              );
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
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (submitted)
              setClientErrors(
                validateDetails({ firstName, email, password: value }),
              );
          }}
          error={fieldErrors.password}
          helper={<PasswordStrengthMeter password={password} />}
          placeholder='Create a password'
          secureToggle
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='new-password'
          textContentType='newPassword'
          returnKeyType='go'
          onSubmitEditing={handleSignUp}
          editable={!busy}
          ltr
          style={{ paddingStart: 8 }}
        />

        <AuthButton
          label='Create account'
          onPress={handleSignUp}
          loading={pending === "submit"}
          disabled={busy}
        />

        <Text className='auth-legal'>
          We only use your email to secure your account and send important
          updates.
        </Text>

        {/* Bot-protection mount point, used on web only. */}
        <View nativeID='clerk-captcha' />
      </View>
    </AuthShell>
  );
}
