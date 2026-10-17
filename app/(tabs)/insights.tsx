import ListHeading from "@/components/ListHeading";
import SubscriptionCard from "@/components/SubscriptionCard";
import { INSIGHTS_EXPENSES, INSIGHTS_WEEKLY_SPENDING } from "@/constants/data";
import { icons } from "@/constants/icons";
import { useSubscriptionStore } from "@/lib/subscriptionStore";
import { formatCurrency } from "@/lib/utils";
import clsx from "clsx";
import dayjs from "dayjs";
import { router } from "expo-router";
import { styled } from "nativewind";
import React, { useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
const SafeAreaView = styled(RNSafeAreaView);

const CHART_AXIS = [45, 35, 25, 5, 0];
// Distance between the 0 and 45 gridlines (h-44 grid minus half a row at each end)
const CHART_PLOT_HEIGHT = 160;

const Insights = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { subscriptions } = useSubscriptionStore();

  const totalExpenses = subscriptions.reduce(
    (sum, subscription) => sum + subscription.price,
    0,
  );
  const peakAmount = Math.max(
    ...INSIGHTS_WEEKLY_SPENDING.map((item) => item.amount),
  );

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView className='flex-1 bg-background p-5'>
      <View className='insights-header'>
        <Pressable
          onPress={handleBack}
          className='insights-icon-btn'
          accessibilityLabel='Go back'>
          <Image source={icons.back} className='insights-icon' />
        </Pressable>
        <Text className='insights-title'>Monthly Insights</Text>
        <Pressable className='insights-icon-btn' accessibilityLabel='More'>
          <Image source={icons.menu} className='insights-icon' />
        </Pressable>
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            <ListHeading title='Upcoming' />

            <View className='insights-chart-card'>
              <View className='insights-plot'>
                <View className='insights-grid'>
                  {CHART_AXIS.map((value) => (
                    <View key={value} className='insights-grid-row'>
                      <Text className='insights-axis-text'>{value}</Text>
                      <View className='insights-gridline' />
                    </View>
                  ))}
                </View>

                <View className='insights-bars'>
                  {INSIGHTS_WEEKLY_SPENDING.map((item) => {
                    const isPeak = item.amount === peakAmount;
                    return (
                      <View key={item.day} className='insights-bar-col'>
                        {isPeak && (
                          <Text className='insights-bar-label'>
                            ${item.amount}
                          </Text>
                        )}
                        <View
                          className={clsx(
                            "insights-bar",
                            isPeak && "insights-bar-active",
                          )}
                          style={{
                            height:
                              (item.amount / CHART_AXIS[0]) * CHART_PLOT_HEIGHT,
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>

              <View className='insights-days'>
                {INSIGHTS_WEEKLY_SPENDING.map((item) => (
                  <Text key={item.day} className='insights-day-text'>
                    {item.day}
                  </Text>
                ))}
              </View>
            </View>

            <View className='insights-expenses-card'>
              <View>
                <Text className='insights-expenses-title'>Expenses</Text>
                <Text className='insights-expenses-meta'>
                  {dayjs(INSIGHTS_EXPENSES.month).format("MMMM YYYY")}
                </Text>
              </View>
              <View className='items-end'>
                <Text className='insights-expenses-amount'>
                  -{formatCurrency(totalExpenses)}
                </Text>
                <Text className='insights-expenses-meta'>
                  +{INSIGHTS_EXPENSES.changePercent}%
                </Text>
              </View>
            </View>

            <ListHeading title='History' />
          </>
        }
        data={subscriptions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SubscriptionCard
            {...item}
            meta={
              item.renewalDate
                ? dayjs(item.renewalDate).format("MMMM D, HH:mm")
                : undefined
            }
            billing={item.billing === "Yearly" ? "per year" : "per month"}
            expanded={expandedId === item.id}
            onPress={() =>
              setExpandedId(expandedId === item.id ? null : item.id)
            }
          />
        )}
        extraData={expandedId}
        ItemSeparatorComponent={() => <View className='h-4' />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text className='home-empty-state'>No subscriptions yet.</Text>
        }
        contentContainerClassName='pb-30'
      />
    </SafeAreaView>
  );
};

export default Insights;
