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
  validateNewPassword,
} from "@/lib/auth";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useSignIn } from "@clerk/expo";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

type Step = "email" | "reset";
type Pending = "submit" | "reset" | "resend" | null;

export default function ForgotPassword() {
  const { signIn, fetchStatus } = useSignIn();
  const cooldown = useResendCooldown();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [banner, setBanner] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [pending, setPending] = useState<Pending>(null);

  const busy = pending !== null || fetchStatus === "fetching";

  const fail = (error: unknown) => {
    const parsed = parseAuthError(error);
    setErrors(parsed.fields);
    setBanner(parsed.message);
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
    const emailError = validateEmail(email);
    setErrors({ email: emailError });
    setBanner(undefined);
    if (emailError) {
      hapticError();
      return;
    }

    setPending("submit");
    try {
      const { error } = await signIn.create({ identifier: normalizeEmail(email) });
      if (error) return fail(error);

      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) return fail(sendError);

      cooldown.start();
      setErrors({});
      setStep("reset");
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  };

  const handleReset = async () => {
    if (busy) return;
    const codeVerified = signIn.status === "needs_new_password";
    const fieldErrors: AuthFieldErrors = {
      code: codeVerified ? undefined : validateCode(code),
      password: validateNewPassword(password),
    };
    setErrors(fieldErrors);
    setBanner(undefined);
    if (hasErrors(fieldErrors)) {
      hapticError();
      return;
    }

    setPending("reset");
    try {
      // Skip re-verifying if the code was accepted and only the password was rejected.
      if (!codeVerified) {
        const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
        if (error) return fail(error);
      }

      const { error: submitError } =
        await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });
      if (submitError) return fail(submitError);

      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({
          navigate: () => hapticSuccess(),
        });
        if (finalizeError) fail(finalizeError);
        return;
      }

      // Password changed, but the account needs an extra check: sign in normally.
      hapticSuccess();
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
    try {
      const { error } = await signIn.resetPasswordEmailCode.sendCode();
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

  const footer = (
    <View className='auth-link-row'>
      <Text className='auth-link-copy'>Remembered it?</Text>
      <Pressable onPress={goToSignIn} hitSlop={8} accessibilityRole='link'>
        <Text className='auth-link'>Back to sign in</Text>
      </Pressable>
    </View>
  );

  if (step === "reset") {
    const codeVerified = signIn.status === "needs_new_password";

    return (
      <AuthShell
        title='Set a new password'
        subtitle={
          <>
            Enter the code we sent to{" "}
            <Text className='auth-email-highlight'>{normalizeEmail(email)}</Text>{" "}
            and choose a new password.
          </>
        }
        onBack={() => {
          signIn.reset();
          setStep("email");
          setCode("");
          setPassword("");
          setErrors({});
          setBanner(undefined);
          setInfo(undefined);
        }}
        footer={footer}>
        <View className='auth-form'>
          <FormBanner message={banner} />
          <FormBanner message={info} tone='info' />

          {!codeVerified && (
            <CodeField
              value={code}
              onChangeText={(value) => {
                setCode(value);
                if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
              }}
              error={errors.code}
            />
          )}

          <AuthField
            label='New password'
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (errors.password)
                setErrors((prev) => ({ ...prev, password: validateNewPassword(value) }));
            }}
            error={errors.password}
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
            if (errors.email) setErrors({ email: validateEmail(value) });
          }}
          error={errors.email}
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
