export interface CampaignSchedule {
  startDate:string; months:1|12; weekdays:number[]; time:string; timezone:string;
}
const formatters=new Map<string,Intl.DateTimeFormat>();
function dateParts(date:Date,timezone:string) {
  let formatter=formatters.get(timezone);
  if(!formatter){formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});if(formatters.size>=50)formatters.clear();formatters.set(timezone,formatter);}
  const parts=formatter.formatToParts(date);
  return Object.fromEntries(parts.map(part=>[part.type,part.value]));
}
export function zonedTimestamp(day:string,time:string,timezone:string) {
  const desired=Date.parse(`${day}T${time}:00Z`);
  let instant=desired;
  for(let i=0;i<4;i++) {
    const p=dateParts(new Date(instant),timezone);
    const represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    const difference=desired-represented;
    instant+=difference;
    if(!difference) break;
  }
  const p=dateParts(new Date(instant),timezone);
  if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`!==`${day}T${time}`) throw new Error('The selected time does not exist on a daylight-saving transition. Choose another time.');
  return new Date(instant).toISOString();
}
export function campaignSlots(config:CampaignSchedule,now=Date.now()):string[] {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(config.startDate)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.time)||![1,12].includes(config.months)) throw new Error('Choose a valid start date, month/year duration and time');
  new Intl.DateTimeFormat('en',{timeZone:config.timezone}).format();
  if(!Array.isArray(config.weekdays)||!config.weekdays.length||config.weekdays.length>7||config.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)) throw new Error('Select valid posting weekdays');
  const start=new Date(`${config.startDate}T00:00:00Z`);
  if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==config.startDate) throw new Error('Invalid start date');
  if(start.getTime()>now+366*86400000||start.getTime()<now-2*86400000) throw new Error('Start within the next year');
  const endMonth=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+config.months,1));
  const lastDay=new Date(Date.UTC(endMonth.getUTCFullYear(),endMonth.getUTCMonth()+1,0)).getUTCDate();
  const end=new Date(Date.UTC(endMonth.getUTCFullYear(),endMonth.getUTCMonth(),Math.min(start.getUTCDate(),lastDay)));
  const slots:string[]=[];
  for(let date=new Date(start);date<end;date.setUTCDate(date.getUTCDate()+1)) {
    if(!config.weekdays.includes(date.getUTCDay())) continue;
    const instant=zonedTimestamp(date.toISOString().slice(0,10),config.time,config.timezone);
    if(Date.parse(instant)>now+3600000) slots.push(instant);
  }
  if(!slots.length) throw new Error('Choose at least one future publishing slot (more than one hour ahead)');
  return slots;
}
export const CAMPAIGN_PLATFORMS=['facebook','instagram','linkedin','linkedin_page'];
export function campaignAccountIssue(account:{platform:string;is_active?:boolean},withImages:boolean) {
  if(!CAMPAIGN_PLATFORMS.includes(account.platform)) return 'Automatic AI plans support Facebook, professional Instagram and LinkedIn. YouTube requires a real video; WhatsApp requires explicit recipients.';
  if(account.platform==='instagram'&&!withImages) return 'Instagram plans require image generation';
  return null;
}
