import { posthog } from "@/lib/posthog";

export const posthogLog = {
  authenticationCompleted(flow: "sign_in" | "sign_up") {
    posthog?.logger.info("authentication_completed", {
      event: "authentication_completed",
      authentication_flow: flow,
    });
  },

  subscriptionExpanded(subscriptionId: string) {
    posthog?.logger.info("subscription_expanded", {
      event: "subscription_expanded",
      subscription_id: subscriptionId,
    });
  },
};
