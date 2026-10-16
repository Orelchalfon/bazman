import AuthButton from "@/components/auth/AuthButton";
import AuthField from "@/components/auth/AuthField";
import AuthShell from "@/components/auth/AuthShell";
import CodeField from "@/components/auth/CodeField";
import FormBanner from "@/components/auth/FormBanner";
import ResendCode from "@/components/auth/ResendCode";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import {
  AuthFieldErrors,
  hasErrors,
  maskEmail,
  normalizeEmail,
  parseAuthError,
  validateCode,
  validateEmail,
  validatePasswordPresent,
} from "@/lib/auth";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useSignIn } from "@clerk/expo";
import { Link, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type Step = "credentials" | "verify";
type Pending = "submit" | "verify" | "resend" | null;

export default function SignIn() {
  const { signIn, fetchStatus } = useSignIn();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const cooldown = useResendCooldown();
  const passwordRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [banner, setBanner] = useState<string>();
  const [info, setInfo] = useState<string>();

  // Returning from a password reset that still needs a fresh sign-in.
  useEffect(() => {
    if (reset) setInfo("Password updated. Sign in with your new password.");
  }, [reset]);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const busy = pending !== null || fetchStatus === "fetching";

  const validateCredentials = (next = { email, password }) => ({
    email: validateEmail(next.email),
    password: validatePasswordPresent(next.password),
  });

  const fail = (error: unknown) => {
    const parsed = parseAuthError(error);
    setErrors(parsed.fields);
    setBanner(parsed.message);
    setInfo(undefined);
    hapticError();
  };

  const finalize = async () => {
    const { error } = await signIn.finalize({
      navigate: ({ session }) => {
        if (session?.currentTask) {
          setBanner("Your account needs one more step before you can continue.");
          return;
        }
        // The root navigator's protected routes take over once the session is active.
        hapticSuccess();
      },
    });
    if (error) fail(error);
  };

  const startEmailCheck = async () => {
    const hasEmailFactor = signIn.supportedSecondFactors?.some(
      (factor) => factor.strategy === "email_code",
    );
    if (!hasEmailFactor) {
      setBanner(
        "This account uses an extra verification method that isn't supported in the app yet.",
      );
      hapticError();
      return;
    }

    const { error } = await signIn.mfa.sendEmailCode();
    if (error) return fail(error);

    cooldown.start();
    setCode("");
    setErrors({});
    setBanner(undefined);
    setStep("verify");
  };

  const handleSignIn = async () => {
    if (busy) return;
    setSubmitted(true);

    const fieldErrors = validateCredentials();
    setErrors(fieldErrors);
    setBanner(undefined);
    if (hasErrors(fieldErrors)) {
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

      switch (signIn.status) {
        case "complete":
          await finalize();
          break;
        case "needs_second_factor":
        case "needs_client_trust":
          await startEmailCheck();
          break;
        default:
          setBanner("We couldn't finish signing you in. Please try again.");
          hapticError();
      }
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const handleVerify = async (value = code) => {
    if (busy) return;
    const codeError = validateCode(value);
    setErrors({ code: codeError });
    setBanner(undefined);
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
        setBanner("We couldn't verify this sign-in. Please try again.");
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
    try {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) return fail(error);
      cooldown.start();
      setErrors({});
      setBanner(undefined);
      setInfo("A new code is on its way.");
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const backToCredentials = async () => {
    await signIn.reset();
    setStep("credentials");
    setCode("");
    setErrors({});
    setBanner(undefined);
    setInfo(undefined);
  };

  if (step === "verify") {
    return (
      <AuthShell
        title='Confirm it’s you'
        subtitle={
          <>
            We noticed a new device. Enter the 6-digit code we sent to{" "}
            <Text className='auth-email-highlight'>
              {maskEmail(normalizeEmail(email))}
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
          <FormBanner message={info} tone='info' />
          <CodeField
            value={code}
            onChangeText={(value) => {
              setCode(value);
              if (errors.code) setErrors({});
            }}
            onComplete={handleVerify}
            error={errors.code}
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
            if (submitted) setErrors(validateCredentials({ email: value, password }));
          }}
          error={errors.email}
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
            if (submitted) setErrors(validateCredentials({ email, password: value }));
          }}
          error={errors.password}
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
