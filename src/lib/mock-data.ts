export const platforms = [
  { id: "instagram", name: "Instagram", color: "var(--pink)", followers: 184230, growth: 12.4 },
  { id: "facebook", name: "Facebook", color: "var(--violet)", followers: 92140, growth: 4.1 },
  { id: "linkedin", name: "LinkedIn", color: "var(--cyan)", followers: 38420, growth: 18.7 },
  { id: "youtube", name: "YouTube", color: "var(--destructive)", followers: 56120, growth: 9.2 },
  { id: "tiktok", name: "TikTok", color: "var(--lime)", followers: 211980, growth: 26.3 },
  { id: "x", name: "X / Twitter", color: "var(--amber)", followers: 47210, growth: -2.1 },
] as const;

export const kpis = [
  { label: "Total Followers", value: "629,9K", delta: 12.8, accent: "violet" },
  { label: "Total Reach", value: "4.82M", delta: 23.1, accent: "cyan" },
  { label: "Impressions", value: "11.2M", delta: 18.4, accent: "pink" },
  { label: "Engagement", value: "8.7%", delta: 3.2, accent: "lime" },
  { label: "Ad Spend", value: "$24,310", delta: -4.6, accent: "amber" },
  { label: "Messages", value: "1,284", delta: 9.7, accent: "violet" },
];

const days = 30;
export const growthSeries = Array.from({ length: days }, (_, i) => {
  const base = 540000;
  return {
    day: `D${i + 1}`,
    followers: Math.round(base + i * 2800 + Math.sin(i / 2) * 4000),
    reach: Math.round(120000 + i * 4200 + Math.cos(i / 3) * 14000),
    engagement: +(5.5 + Math.sin(i / 4) * 1.2 + i * 0.05).toFixed(2),
  };
});

export const platformShare = platforms.map((p) => ({
  name: p.name,
  value: p.followers,
  color: p.color,
}));

export const adSpendSeries = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  spend: Math.round(1500 + Math.random() * 3500),
  roas: +(2 + Math.random() * 4).toFixed(2),
}));

export const topPosts = [
  { platform: "TikTok", title: "Behind the launch — 60s cut", reach: "1.2M", eng: "14.2%", likes: "182K" },
  { platform: "Instagram", title: "Reel: 5 growth hacks that actually work", reach: "742K", eng: "11.8%", likes: "98K" },
  { platform: "YouTube", title: "We rebuilt our funnel in 30 days", reach: "412K", eng: "9.4%", likes: "32K" },
  { platform: "LinkedIn", title: "Why we open-sourced our analytics stack", reach: "188K", eng: "8.1%", likes: "12K" },
  { platform: "X", title: "Thread: 12 lessons from 1M followers", reach: "302K", eng: "6.7%", likes: "21K" },
];

export const messages = [
  { from: "@aria.codes", platform: "Instagram", text: "Loved your last reel — collab?", time: "2m", unread: true },
  { from: "Mason R.", platform: "LinkedIn", text: "Sending over the deck for Q3 partnership.", time: "14m", unread: true },
  { from: "@_marcusx", platform: "X", text: "Where can I grab the dashboard template?", time: "1h", unread: false },
  { from: "Sofia K.", platform: "Facebook", text: "Hi! Question about your pricing tiers.", time: "3h", unread: true },
  { from: "@nova.studio", platform: "TikTok", text: "Stitching your video — credit you?", time: "5h", unread: false },
];
