import { CampaignAnalytics, StateAnalytics } from "@/types/shopify";

export function getCampaignSearchTerms(searchText: string): string[] {
  return Array.from(
    new Set(
      searchText
        .split(/[\n,;]+/)
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function filterCampaignsBySearch(
  campaigns: CampaignAnalytics[],
  searchText: string
): CampaignAnalytics[] {
  const terms = getCampaignSearchTerms(searchText);
  if (terms.length === 0) return campaigns;

  const isBulkSearch = terms.length > 1;
  return campaigns.filter((campaign) => {
    const campaignId = campaign.campaign.toLowerCase();
    return terms.some((term) => (isBulkSearch ? campaignId === term : campaignId.includes(term)));
  });
}

/**
 * Rebuilds the By State totals using only the selected campaigns. Campaigns are
 * mutually exclusive at order level, so their state order counts can be summed.
 */
export function aggregateStatesForCampaigns(campaigns: CampaignAnalytics[]): StateAnalytics[] {
  const stateMap = new Map<
    string,
    Pick<StateAnalytics, "state" | "stateCode" | "orders" | "units" | "revenue">
  >();

  for (const campaign of campaigns) {
    for (const state of campaign.states || []) {
      const existing = stateMap.get(state.state) || {
        state: state.state,
        stateCode: state.stateCode,
        orders: 0,
        units: 0,
        revenue: 0,
      };

      existing.orders += state.orders;
      existing.units += state.units;
      existing.revenue += state.revenue;
      stateMap.set(state.state, existing);
    }
  }

  const states = Array.from(stateMap.values());
  const totalRevenue = states.reduce((sum, state) => sum + state.revenue, 0);
  const totalUnits = states.reduce((sum, state) => sum + state.units, 0);

  return states
    .map((state) => ({
      ...state,
      revenue: Math.round(state.revenue * 100) / 100,
      percentageOfRevenue: totalRevenue > 0 ? (state.revenue / totalRevenue) * 100 : 0,
      percentageOfUnits: totalUnits > 0 ? (state.units / totalUnits) * 100 : 0,
    }))
    .sort((a, b) => b.orders - a.orders || b.units - a.units);
}
