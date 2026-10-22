import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, PenSquare, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrandScope } from "@/contexts/BrandContext";
import { useUpcomingPosts } from "@/hooks/useUpcomingPosts";
import { UpcomingPostsCard } from "@/components/dashboard/UpcomingPostsCard";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import { ALL_BRANDS } from "@/lib/brandScope";

const actions = [
  { title: "Create with AI", text: "Turn an idea into a caption. Add an image when you need one.", href: "/compose", icon: Sparkles, color: "text-violet-600 bg-violet-500/10" },
  { title: "Plan your next post", text: "Choose a page, review its content and set a local publish time.", href: "/calendar", icon: CalendarDays, color: "text-blue-600 bg-blue-500/10" },
  { title: "Explore performance", text: "Compare your connected channels and inspect recent posts.", href: "/analytics", icon: BarChart3, color: "text-teal-600 bg-teal-500/10" },
];

export default function Home() {
  const scope = useBrandScope();
  const upcoming = useUpcomingPosts(5);
  return <div className="mx-auto max-w-6xl space-y-7 p-4 md:p-7">
    <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900 p-7 text-white md:p-10"><p className="text-xs font-semibold uppercase tracking-[.22em] text-teal-200">{scope.brandName} · Your workspace</p><h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">A clear plan.<br/>A consistent presence.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-teal-50/80">Create thoughtful content, organize your publishing calendar and understand the channels behind your brand.</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild className="bg-white text-teal-950 hover:bg-teal-50"><Link to="/compose"><PenSquare className="mr-2 h-4 w-4"/>Create a post</Link></Button><Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/accounts">Manage channels<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div></section>
    {scope.brandId === ALL_BRANDS && <p className="rounded-xl border bg-muted/30 p-4 text-sm">You are viewing the portfolio. Choose an individual brand above before creating or scheduling content.</p>}
    <section className="grid gap-4 md:grid-cols-3">{actions.map(action => <Link key={action.href} to={action.href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className={`inline-flex rounded-xl p-3 ${action.color}`}><action.icon className="h-5 w-5"/></span><h2 className="mt-4 font-semibold">{action.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{action.text}</p><ArrowRight className="mt-4 h-4 w-4 text-primary transition group-hover:translate-x-1"/></Link>)}</section>
    <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary"/>Your channels</h2><Link to="/accounts" className="text-xs font-medium text-primary">Manage</Link></div><div className="mt-4 divide-y">{PLATFORM_CONFIGS.map(config => {const own = scope.accounts.filter(account => account.platform === config.id && account.is_active);return <div key={config.id} className="flex items-center gap-3 py-3"><config.icon className="h-5 w-5" style={{color:config.color}}/><span className="flex-1 text-sm">{config.label}</span>{own.length ? <span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5"/>{own.length} connected</span> : <Link to="/accounts" className="text-xs text-muted-foreground hover:text-primary">Connect</Link>}</div>;})}</div></section><div>{upcoming.error ? <p role="alert">Upcoming posts could not load.</p> : <UpcomingPostsCard posts={upcoming.data ?? []}/>}<p className="mt-3 text-xs leading-5 text-muted-foreground">Review content and destination permissions before publishing. Personal Facebook and Instagram accounts use the manual publishing workflow.</p></div></div>
  </div>;
}
