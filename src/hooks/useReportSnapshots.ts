import { useQuery } from "@tanstack/react-query";
import { useBrandScope } from "@/contexts/BrandContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { dateKey, previousRange, type ReportRange } from "@/lib/analyticsReport";
import type { AnalyticsSnapshot } from "@/types/database";
export function useReportSnapshots(range: ReportRange) {
  const scope = useBrandScope();
  const {user} = useAuth();
  const previous = previousRange(range);
  return useQuery({queryKey:["report-snapshots", user?.id, scope.brandId, scope.accountIds, dateKey(previous.from), dateKey(range.to)], enabled: Boolean(user) && scope.ready,
    queryFn: async () => {
      if (!scope.accountIds.length) return [];
      const rows: AnalyticsSnapshot[] = [];
      for(let offset=0;;offset+=500) {
        const {data,error} = await supabase.from("sv_analytics_snapshots").select("*").in("connected_account_id",scope.accountIds).gte("metric_date",dateKey(previous.from)).lte("metric_date",dateKey(range.to)).order("metric_date").order("id").range(offset,offset+499);
        if(error) throw error;
        rows.push(...data);
        if(data.length < 500) break;
      }
      return rows;
    }});
}
