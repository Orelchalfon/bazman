import type { ReactNode, Ref } from "react";
import type { ImageSourcePropType, TextInput, TextInputProps } from "react-native";

declare global {
    interface AppTab {
        name: string;
        title: string;
        icon: ImageSourcePropType;
    }

    interface TabIconProps {
        focused: boolean;
        icon: ImageSourcePropType;
    }

      interface Subscription {
        id: string;
        icon: ImageSourcePropType;
        name: string;
        plan?: string;
        category?: string;
        paymentMethod?: string;
        status?: string;
        startDate?: string;
        price: number;
        currency?: string;
        billing: string;
        frequency?: string;
        renewalDate?: string;
        color?: string;
    }

    interface SubscriptionCardProps extends Omit<Subscription, "id"> {
        expanded?: boolean;
        /** Overrides the secondary line under the name */
        meta?: string;
        onPress?: () => void;
        onCancelPress?: () => void;
        isCancelling?: boolean;
    }

    interface UpcomingSubscription {
        id: string;
        icon: ImageSourcePropType;
        name: string;
        price: number;
        currency?: string;
        daysLeft: number;
    }

    interface UpcomingSubscriptionCardProps
        extends Omit<UpcomingSubscription, "id"> { }

    interface ListHeadingProps {
        title: string;
    }

    interface AuthShellProps {
        title: string;
        subtitle?: ReactNode;
        onBack?: () => void;
        footer?: ReactNode;
        children: ReactNode;
    }

    interface AuthFieldProps extends Omit<TextInputProps, "className"> {
        label: string;
        error?: string;
        helper?: ReactNode;
        labelAccessory?: ReactNode;
        secureToggle?: boolean;
        ltr?: boolean;
        ref?: Ref<TextInput>;
    }

    interface AuthButtonProps {
        label: string;
        onPress: () => void;
        loading?: boolean;
        disabled?: boolean;
        variant?: "primary" | "secondary";
    }

    interface CodeFieldProps {
        value: string;
        onChangeText: (value: string) => void;
        onComplete?: (code: string) => void;
        error?: string;
        autoFocus?: boolean;
    }

    interface FormBannerProps {
        message?: string;
        tone?: "error" | "info";
    }

    interface ResendCodeProps {
        onResend: () => void;
        secondsLeft: number;
        loading?: boolean;
    }

    interface PasswordStrengthMeterProps {
        password: string;
    }
}

// Keeps this file explicitly marked as a module. The import above already does this,
// so this line is optional here; `declare global` makes these interfaces global.
export { };

