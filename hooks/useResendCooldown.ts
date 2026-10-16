import { useCallback, useEffect, useState } from "react";

/** Countdown that throttles "resend code" actions. */
export function useResendCooldown(seconds = 30) {
    const [secondsLeft, setSecondsLeft] = useState(0);

    useEffect(() => {
        if (secondsLeft <= 0) return;
        const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [secondsLeft]);

    const start = useCallback(() => setSecondsLeft(seconds), [seconds]);

    return { secondsLeft, canResend: secondsLeft <= 0, start };
}
