import { EventCheckIn } from '@/components/events/EventCheckIn';
export default function Page({params}:{params:{id:string}}){return <EventCheckIn id={params.id}/>;}
