import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postEngagementSeries } from "@/lib/chartMetrics";
import type { PlatformPost } from "@/types/database";

export function PostEngagementChart({posts}:{posts:PlatformPost[]}) {
  const data=postEngagementSeries(posts);
  return <Card><CardHeader><CardTitle className="text-base">Post engagement by publication date</CardTitle><p className="text-xs text-muted-foreground">Latest saved lifetime likes, comments and shares on posts published each day. These are not engagements earned that day; sync coverage may be incomplete.</p></CardHeader><CardContent className="h-72">{!data.length ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No synced posts in this period</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:4,right:8,left:-16,bottom:0}}><CartesianGrid strokeDasharray="3 3" className="stroke-border"/><XAxis dataKey="date" tick={{fontSize:11}} tickFormatter={value=>String(value).slice(5)}/><YAxis allowDecimals={false} tick={{fontSize:11}}/><Tooltip contentStyle={{borderRadius:8,fontSize:12}}/><Legend wrapperStyle={{fontSize:12}}/><Bar dataKey="likes" name="Likes" stackId="engagement" fill="#0d9488"/><Bar dataKey="comments" name="Comments" stackId="engagement" fill="#6366f1"/><Bar dataKey="shares" name="Shares" stackId="engagement" fill="#f59e0b" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>}</CardContent></Card>;
}
