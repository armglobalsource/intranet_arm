import { EventAttendees } from '@/components/events/EventAttendees';
export default function Page({params}:{params:{id:string}}){return <EventAttendees id={params.id}/>;}
