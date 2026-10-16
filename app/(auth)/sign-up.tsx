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
  hasErrors,
  normalizeEmail,
  parseAuthError,
  validateCode,
  validateEmail,
  validateName,
  validateNewPassword,
} from "@/lib/auth";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useSignUp } from "@clerk/expo";
import { Link } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type Step = "details" | "verify";
type Pending = "submit" | "verify" | "resend" | null;

export default function SignUp() {
  const { signUp, fetchStatus } = useSignUp();
  const cooldown = useResendCooldown();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>("details");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [banner, setBanner] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const busy = pending !== null || fetchStatus === "fetching";

  const validateDetails = (next = { firstName, email, password }) => ({
    firstName: validateName(next.firstName),
    email: validateEmail(next.email),
    password: validateNewPassword(next.password),
  });

  const fail = (error: unknown) => {
    const parsed = parseAuthError(error);
    setErrors(parsed.fields);
    setBanner(parsed.message);
    setInfo(undefined);
    hapticError();
  };

  const handleSignUp = async () => {
    if (busy) return;
    setSubmitted(true);

    const fieldErrors = validateDetails();
    setErrors(fieldErrors);
    setBanner(undefined);
    if (hasErrors(fieldErrors)) {
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

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) return fail(sendError);

      cooldown.start();
      setCode("");
      setErrors({});
      setStep("verify");
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
      const { error } = await signUp.verifications.verifyEmailCode({
        code: value,
      });
      if (error) return fail(error);

      if (signUp.status !== "complete") {
        setBanner(
          "Your email is verified, but we need a bit more information to finish creating your account.",
        );
        hapticError();
        return;
      }

      const { error: finalizeError } = await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) {
            setBanner("Your account needs one more step before you can continue.");
            return;
          }
          // The root navigator's protected routes take over once the session is active.
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
    try {
      const { error } = await signUp.verifications.sendEmailCode();
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

  const editDetails = () => {
    setStep("details");
    setCode("");
    setErrors({});
    setBanner(undefined);
    setInfo(undefined);
  };

  if (step === "verify") {
    return (
      <AuthShell
        title='Check your inbox'
        subtitle={
          <>
            We sent a 6-digit code to{" "}
            <Text className='auth-email-highlight'>{normalizeEmail(email)}</Text>
            . Enter it below to activate your account.
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
              setErrors(validateDetails({ firstName: value, email, password }));
          }}
          error={errors.firstName}
          placeholder='What should we call you?'
          autoCapitalize='words'
          autoComplete='given-name'
          textContentType='givenName'
          returnKeyType='next'
          submitBehavior='submit'
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!busy}
        />

        <AuthField
          ref={emailRef}
          label='Email'
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (submitted)
              setErrors(validateDetails({ firstName, email: value, password }));
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
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (submitted)
              setErrors(validateDetails({ firstName, email, password: value }));
          }}
          error={errors.password}
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
