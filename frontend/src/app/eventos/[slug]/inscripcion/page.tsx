import { EventReceipt } from '@/components/events/EventRegistration';
export default function Page({params}:{params:{slug:string}}){return <EventReceipt slug={params.slug}/>;}
